/**
 * Token privasi (`tctoken`) untuk pesan 1:1. Logika bucket/kedaluwarsa mengikuti
 * Utils/tc-token-utils milik @whiskeysockets/baileys (MIT).
 */
import type { SignalKeyStore } from '../auth/key-store.js'
import { getChild, getChildren, getContentBytes } from '../protocol/binary-node.js'
import type { BinaryNode } from '../protocol/protocol-types.js'
import { S_WHATSAPP_NET } from '../protocol/stanza-builder.js'
import { jidNormalizedUser } from '../utils/jid.js'

const BUCKET_SECONDS = 604800 // 7 hari
const NUM_BUCKETS = 4 // jendela ~28 hari

export interface TcTokenEntry {
  token: Uint8Array
  timestamp?: string | undefined
  senderTimestamp?: number | undefined
}

export const isTcTokenExpired = (timestamp: string | number | undefined, nowSec = Math.floor(Date.now() / 1000)): boolean => {
  if (timestamp === undefined) return true
  const ts = typeof timestamp === 'string' ? parseInt(timestamp, 10) : timestamp
  if (Number.isNaN(ts)) return true
  const cutoff = (Math.floor(nowSec / BUCKET_SECONDS) - (NUM_BUCKETS - 1)) * BUCKET_SECONDS
  return ts < cutoff
}

/** Perlu kirim token baru bila belum pernah, atau sudah berganti bucket. */
export const shouldSendNewTcToken = (senderTimestamp: number | undefined, nowSec = Math.floor(Date.now() / 1000)): boolean =>
  senderTimestamp === undefined || Math.floor(nowSec / BUCKET_SECONDS) > Math.floor(senderTimestamp / BUCKET_SECONDS)

export interface TcTokenStoreOptions {
  keys: Pick<SignalKeyStore, 'get' | 'set'>
  /** PN -> LID (token disimpan di bawah LID bila ada). */
  toStorageJid?: (jid: string) => Promise<string>
  query: (node: BinaryNode, timeoutMs?: number) => Promise<BinaryNode>
}

export class TcTokenStore {
  readonly #keys: TcTokenStoreOptions['keys']
  readonly #toStorageJid: (jid: string) => Promise<string>
  readonly #query: TcTokenStoreOptions['query']
  readonly #inflight = new Set<string>()

  constructor(options: TcTokenStoreOptions) {
    this.#keys = options.keys
    this.#toStorageJid = options.toStorageJid ?? (async (jid) => jid)
    this.#query = options.query
  }

  async #key(jid: string): Promise<string> {
    return this.#toStorageJid(jidNormalizedUser(jid))
  }

  /** Token yang masih berlaku untuk `jid`, atau `undefined`. */
  async get(jid: string): Promise<Uint8Array | undefined> {
    const key = await this.#key(jid)
    const entry = (await this.#keys.get('tctoken', [key]))[key]
    if (!entry?.token?.length) return undefined
    if (isTcTokenExpired(entry.timestamp)) {
      await this.#keys.set({
        tctoken: { [key]: entry.senderTimestamp !== undefined ? { token: new Uint8Array(), senderTimestamp: entry.senderTimestamp } : null },
      })
      return undefined
    }
    return entry.token
  }

  /** Simpan token dari `<tokens>` (hasil iq atau notifikasi `privacy_token`). */
  async storeFromTokens(container: BinaryNode, fallbackJid?: string): Promise<void> {
    const tokens = getChild(container, 'tokens')
    if (!tokens) return
    for (const token of getChildren(tokens, 'token')) {
      const bytes = getContentBytes(token)
      if (token.attrs.type !== 'trusted_contact' || !bytes) continue
      const rawJid = jidNormalizedUser(fallbackJid ?? token.attrs.jid ?? '')
      if (!rawJid.includes('@')) continue
      const key = await this.#key(rawJid)
      const existing = (await this.#keys.get('tctoken', [key]))[key]
      const incoming = token.attrs.t ? Number(token.attrs.t) : 0
      if (!incoming) continue
      if (existing?.timestamp && Number(existing.timestamp) > incoming) continue
      await this.#keys.set({ tctoken: { [key]: { ...existing, token: Buffer.from(bytes), timestamp: token.attrs.t } } })
    }
  }

  /** Minta server menerbitkan token untuk `jid` (stanza `privacy/tokens`). */
  async issue(jid: string, timestamp = Math.floor(Date.now() / 1000)): Promise<BinaryNode> {
    return this.#query({
      tag: 'iq',
      attrs: { to: S_WHATSAPP_NET, type: 'set', xmlns: 'privacy' },
      content: [{ tag: 'tokens', attrs: {}, content: [{ tag: 'token', attrs: { jid: jidNormalizedUser(jid), t: String(timestamp), type: 'trusted_contact' } }] }],
    })
  }

  /**
   * Setelah mengirim pesan 1:1: terbitkan token bila perlu (sekali per bucket), lalu simpan
   * token balasan dari server. Tidak melempar error (fire-and-forget).
   */
  async issueIfNeeded(jid: string): Promise<void> {
    const key = await this.#key(jid)
    if (this.#inflight.has(key)) return
    this.#inflight.add(key)
    try {
      const entry = (await this.#keys.get('tctoken', [key]))[key]
      if (!shouldSendNewTcToken(entry?.senderTimestamp)) return
      const now = Math.floor(Date.now() / 1000)
      const result = await this.issue(jid, now)
      await this.storeFromTokens(result, jid)
      const latest = (await this.#keys.get('tctoken', [key]))[key]
      await this.#keys.set({ tctoken: { [key]: { token: latest?.token ?? new Uint8Array(), timestamp: latest?.timestamp, senderTimestamp: now } } })
    } catch {
      // diabaikan: token akan dicoba lagi pada pesan berikutnya
    } finally {
      this.#inflight.delete(key)
    }
  }
}
