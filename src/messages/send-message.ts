import { MessageError } from '../core/errors.js'
import type { TypedEventEmitter } from '../core/event-emitter.js'
import type { CorvusEventMap } from '../core/event-mapping.js'
import type { BinaryNode } from '../protocol/protocol-types.js'
import { generateWAMessage, type GenerateOptions, type MessageInput } from './generate-message.js'
import type { MessageKey } from './message-key.js'
import { buildReadReceipts } from './message-receipt.js'
import { getBizNodes, relayMessage, type RelayDeps, type RelayResult } from './relay-message.js'
import type { WAMessage } from './message-utils.js'

export interface MessageSenderOptions {
  deps: RelayDeps
  /** Dipakai untuk memancarkan `messages.upsert` bagi pesan keluar. */
  ev?: TypedEventEmitter<CorvusEventMap>
  /** Sumber pesan untuk quote berdasarkan key. */
  loadMessage?: (key: MessageKey) => WAMessage | undefined
  emitOwnEvents?: boolean
}

export interface SendOptions extends Omit<GenerateOptions, 'quoted' | 'userJid'> {
  quoted?: WAMessage
  /** Quote berdasarkan key (membutuhkan `loadMessage`). */
  quotedKey?: MessageKey
  additionalNodes?: BinaryNode[]
  /** Sertakan node `<biz>` untuk pesan list/interaktif (belum diverifikasi; lihat `getBizNodes`). */
  bizNodes?: boolean
  participants?: string[]
}

export interface SendResult {
  message: WAMessage
  relay: RelayResult
}

/** Menggabungkan pembuatan pesan dan relay, plus helper umum. */
export class MessageSender {
  readonly #deps: RelayDeps
  readonly #ev: TypedEventEmitter<CorvusEventMap> | undefined
  readonly #load: ((key: MessageKey) => WAMessage | undefined) | undefined
  readonly #emitOwn: boolean

  constructor(options: MessageSenderOptions) {
    this.#deps = options.deps
    this.#ev = options.ev
    this.#load = options.loadMessage
    this.#emitOwn = options.emitOwnEvents ?? true
  }

  async send(jid: string, input: MessageInput, options: SendOptions = {}): Promise<SendResult> {
    let quoted = options.quoted
    if (!quoted && options.quotedKey) {
      quoted = this.#load?.(options.quotedKey)
      if (!quoted) throw new MessageError('Quoted message not found', { data: { key: options.quotedKey } })
    }

    const message = generateWAMessage(jid, input, {
      ...options,
      userJid: this.#deps.ownJid,
      ...(quoted && { quoted }),
    })
    const content = message.message!
    const additionalNodes = [
      ...(options.bizNodes ? getBizNodes(content) : []),
      ...(options.additionalNodes ?? []),
    ]

    const relay = await relayMessage(this.#deps, jid, content, {
      messageId: message.key.id,
      additionalNodes,
      ...(options.participants && { participants: options.participants }),
    })

    if (this.#emitOwn && this.#ev) this.#emitOutgoing(message)
    return { message, relay }
  }

  react(jid: string, key: MessageKey, emoji: string): Promise<SendResult> {
    return this.send(jid, { react: key, emoji } as MessageInput)
  }

  delete(jid: string, key: MessageKey): Promise<SendResult> {
    return this.send(jid, { delete: key })
  }

  edit(jid: string, key: MessageKey, text: string): Promise<SendResult> {
    return this.send(jid, { edit: key, text })
  }

  forward(jid: string, message: WAMessage, force = false): Promise<SendResult> {
    return this.send(jid, { forward: message, force })
  }

  /** Tandai pesan sebagai sudah dibaca. */
  async readMessages(keys: readonly MessageKey[]): Promise<void> {
    for (const node of buildReadReceipts(keys)) await this.#deps.engine.sendNode(node)
  }

  #emitOutgoing(message: WAMessage): void {
    const content = message.message!
    if (content.reactionMessage) {
      this.#ev!.emit('messages.reaction', [
        { key: content.reactionMessage.key, reaction: { key: message.key, text: content.reactionMessage.text } },
      ])
    } else if (!content.protocolMessage) {
      this.#ev!.emit('messages.upsert', { messages: [message], type: 'append' })
    }
  }
}
