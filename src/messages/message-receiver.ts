import { noopLogger } from '../core/defaults.js'
import type { Logger } from '../core/socket-config.js'
import type { SocketContext, SocketModule } from '../core/socket.js'
import type { CryptoEngine } from '../crypto/crypto-engine.js'
import { getChild } from '../protocol/binary-node.js'
import type { ProtocolEngine } from '../protocol/protocol-engine.js'
import type { BinaryNode } from '../protocol/protocol-types.js'
import { buildAck } from '../protocol/stanza-builder.js'
import { TTLCache } from '../utils/cache.js'
import { jidNormalizedUser } from '../utils/jid.js'
import { decryptMessageNode, parseMessageNode, type MessageCodec } from './message-parser.js'
import { buildReceiptNode, parseReceiptNode, receiptToUpdates } from './message-receipt.js'
import { MessageStatus } from './message-status.js'

export type PresenceKind = 'unavailable' | 'available' | 'composing' | 'recording' | 'paused'

export interface MessageReceiverOptions {
  engine: Pick<ProtocolEngine, 'on' | 'sendNode'>
  crypto: Pick<CryptoEngine, 'sessions' | 'senderKeys'>
  codec: MessageCodec
  /** JID akun sendiri (device-aware); `undefined` bila belum login. */
  getOwnJid: () => string | undefined
  /** Kirim receipt pengiriman untuk pesan masuk (default true). */
  sendReceipts?: boolean
  /** Kirim nack (error) bila dekripsi gagal (default true). */
  nackOnDecryptError?: boolean
  /** Kode error pada nack (belum diverifikasi; default `487`). */
  nackCode?: string
  /** Dipanggil saat daftar device milik user berubah. */
  onDevicesChanged?: (userJid: string) => void
  onDecryptError?: (error: Error, node: BinaryNode) => void
  /** Lama id pesan diingat untuk deteksi duplikat (default 10 menit). */
  dedupeTtlMs?: number
  logger?: Logger
}

/** Parse `<presence>` / `<chatstate>` menjadi payload `presence.update`. */
export function parsePresenceNode(node: BinaryNode, now: () => number = Date.now): { id: string; presences: Record<string, { lastKnownPresence: PresenceKind; lastSeen?: number }> } | undefined {
  const from = node.attrs.from
  if (!from) return undefined
  const who = node.attrs.participant ?? from

  if (node.tag === 'presence') {
    const kind: PresenceKind = node.attrs.type === 'unavailable' ? 'unavailable' : 'available'
    const last = Number(node.attrs.last)
    return {
      id: from,
      presences: { [who]: { lastKnownPresence: kind, ...(node.attrs.last !== undefined && Number.isFinite(last) && { lastSeen: last }) } },
    }
  }

  const child = Array.isArray(node.content) ? node.content[0] : undefined
  if (!child) return undefined
  const kind: PresenceKind | undefined =
    child.tag === 'composing' ? (child.attrs.media === 'audio' ? 'recording' : 'composing') : child.tag === 'paused' ? 'paused' : undefined
  return kind ? { id: from, presences: { [who]: { lastKnownPresence: kind, lastSeen: Math.floor(now() / 1000) } } } : undefined
}

/**
 * Modul penerima: dekripsi `<message>`, emit `messages.upsert`, kirim ack/receipt,
 * serta olah `<receipt>`, `<ack>`, `<notification>`, `<presence>`, dan `<chatstate>`.
 */
export class MessageReceiver implements SocketModule {
  readonly name = 'message-receiver'

  readonly #opts: MessageReceiverOptions
  readonly #logger: Logger
  readonly #seen: TTLCache<string, true>
  #ctx: SocketContext | undefined
  #offs: Array<() => void> = []

  constructor(options: MessageReceiverOptions) {
    this.#opts = options
    this.#logger = options.logger ?? noopLogger
    this.#seen = new TTLCache({ ttlMs: options.dedupeTtlMs ?? 10 * 60_000, maxSize: 10_000 })
  }

  setup(ctx: SocketContext): void {
    this.#ctx = ctx
    if (this.#offs.length > 0) return
    const { engine } = this.#opts
    const safe = (fn: (node: BinaryNode) => Promise<void> | void) => (node: BinaryNode) =>
      Promise.resolve(fn(node)).catch((error: unknown) => this.#logger.error({ err: error, tag: node.tag }, 'receiver handler failed'))

    this.#offs = [
      engine.on({ tag: 'message' }, safe((n) => this.#onMessage(n))),
      engine.on({ tag: 'receipt' }, safe((n) => this.#onReceipt(n))),
      engine.on({ tag: 'ack', attrs: { class: 'message' } }, safe((n) => this.#onMessageAck(n))),
      engine.on({ tag: 'notification' }, safe((n) => this.#onNotification(n))),
      engine.on({ tag: 'presence' }, safe((n) => this.#onPresence(n))),
      engine.on({ tag: 'chatstate' }, safe((n) => this.#onPresence(n))),
    ]
  }

  dispose(): void {
    for (const off of this.#offs.splice(0)) off()
    this.#ctx = undefined
  }

  async #onMessage(node: BinaryNode): Promise<void> {
    const { engine, crypto, codec } = this.#opts
    const ctx = this.#ctx
    const ownJid = this.#opts.getOwnJid()

    const parsed = parseMessageNode(node, ownJid)
    const dedupeKey = `${parsed.from}|${parsed.participant ?? ''}|${parsed.id}`
    if (this.#seen.has(dedupeKey)) {
      await engine.sendNode(buildAck(node))
      return
    }

    let message
    try {
      message = await decryptMessageNode(parsed, { crypto, codec })
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      this.#logger.warn({ err, id: parsed.id, from: parsed.from }, 'failed to decrypt message')
      this.#opts.onDecryptError?.(err, node)
      await engine.sendNode(
        buildAck(node, this.#opts.nackOnDecryptError === false ? {} : { error: this.#opts.nackCode ?? '487' }),
      )
      return
    }

    this.#seen.set(dedupeKey, true)
    if (message.message && ctx) {
      ctx.ev.emit('messages.upsert', { messages: [message], type: node.attrs.offline !== undefined ? 'append' : 'notify' })
    }

    await engine.sendNode(buildAck(node))
    if (this.#opts.sendReceipts !== false && !parsed.isFromMe && node.attrs.category !== 'peer') {
      await engine.sendNode(
        buildReceiptNode({ jid: parsed.from, messageIds: [parsed.id], ...(parsed.participant && { participant: parsed.participant }) }),
      )
    }
  }

  async #onReceipt(node: BinaryNode): Promise<void> {
    const ctx = this.#ctx
    const updates = receiptToUpdates(parseReceiptNode(node))
    if (ctx && updates.statusUpdates.length > 0) ctx.ev.emit('messages.update', updates.statusUpdates)
    if (ctx && updates.receipts.length > 0) ctx.ev.emit('message-receipt.update', updates.receipts)
    await this.#opts.engine.sendNode(buildAck(node, node.attrs.type ? { type: node.attrs.type } : {}))
  }

  /** Ack server untuk pesan yang kita kirim -> status SERVER_ACK (atau ERROR). */
  #onMessageAck(node: BinaryNode): void {
    const { id, from } = node.attrs
    if (!id || !from || !this.#ctx) return
    this.#ctx.ev.emit('messages.update', [
      {
        key: { remoteJid: from, fromMe: true, id, ...(node.attrs.participant && { participant: node.attrs.participant }) },
        update: { status: node.attrs.error ? MessageStatus.ERROR : MessageStatus.SERVER_ACK },
      },
    ])
  }

  async #onNotification(node: BinaryNode): Promise<void> {
    // notifikasi grup (w:gp2) di-ack oleh GroupEventsModule
    if (node.attrs.type === 'w:gp2') return
    if (node.attrs.type === 'devices' && node.attrs.from) {
      const device = getChild(node, 'add') ?? getChild(node, 'remove') ?? getChild(node, 'update')
      this.#opts.onDevicesChanged?.(jidNormalizedUser(device?.attrs.jid ?? node.attrs.from))
    }
    if (node.attrs.id && node.attrs.from) {
      await this.#opts.engine.sendNode(buildAck(node, node.attrs.type ? { type: node.attrs.type } : {}))
    }
  }

  #onPresence(node: BinaryNode): void {
    const update = parsePresenceNode(node)
    if (update && this.#ctx) this.#ctx.ev.emit('presence.update', update as unknown as Record<string, unknown>)
  }
}
