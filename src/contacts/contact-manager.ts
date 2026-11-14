import { noopLogger } from '../core/defaults.js'
import type { TypedEventEmitter } from '../core/event-emitter.js'
import type { CorvusEventMap } from '../core/event-mapping.js'
import type { Logger } from '../core/socket-config.js'
import { getChild, getChildren } from '../protocol/binary-node.js'
import type { BinaryNode } from '../protocol/protocol-types.js'
import { S_WHATSAPP_NET } from '../protocol/stanza-builder.js'
import { jidDecode, jidEncode, jidNormalizedUser } from '../messages/message-utils.js'
import { buildUSyncQuery, parseUSyncResult } from './contact-query.js'
import type {
  BlockAction,
  DeviceInfo,
  OnWhatsAppResult,
  ProfilePictureType,
  StatusResult,
  USyncProtocol,
  USyncUser,
  USyncUserResult,
} from './contact-types.js'

export interface ContactManagerOptions {
  query: (node: BinaryNode, timeoutMs?: number) => Promise<BinaryNode>
  generateTag: () => string
  ev?: TypedEventEmitter<CorvusEventMap>
  /** Masa berlaku cache daftar device (default 5 menit). */
  deviceCacheTtlMs?: number
  logger?: Logger
  now?: () => number
}

export interface GetDevicesOptions {
  /** Lewati cache. */
  force?: boolean
  /** Abaikan device 0 (perangkat utama). */
  ignoreZeroDevices?: boolean
}

interface CacheEntry {
  devices: DeviceInfo[]
  expires: number
}

export class ContactManager {
  readonly #opts: ContactManagerOptions
  readonly #cache = new Map<string, CacheEntry>()
  readonly #ttl: number
  readonly #now: () => number
  readonly #logger: Logger

  constructor(options: ContactManagerOptions) {
    this.#opts = options
    this.#ttl = options.deviceCacheTtlMs ?? 5 * 60_000
    this.#now = options.now ?? Date.now
    this.#logger = options.logger ?? noopLogger
  }

  async #usync(protocols: USyncProtocol[], users: USyncUser[]): Promise<USyncUserResult[]> {
    const result = await this.#opts.query(buildUSyncQuery({ protocols, users, sid: this.#opts.generateTag() }))
    return parseUSyncResult(result)
  }

  /** Cek nomor telepon yang terdaftar di WhatsApp. */
  async onWhatsApp(phones: readonly string[]): Promise<OnWhatsAppResult[]> {
    if (phones.length === 0) return []
    const results = await this.#usync(['contact', 'lid'], phones.map((phone) => ({ phone })))
    return phones.map((phone) => {
      const digits = phone.replace(/\D/g, '')
      const match = results.find((r) => r.query === digits)
      return { query: phone, jid: match?.exists ? match.jid : undefined, exists: match?.exists === true, lid: match?.lid }
    })
  }

  async fetchStatus(jids: readonly string[]): Promise<StatusResult[]> {
    if (jids.length === 0) return []
    const results = await this.#usync(['status'], jids.map((jid) => ({ jid })))
    const out = results.filter((r) => r.status).map((r) => ({ jid: r.jid, status: r.status!.text, setAt: r.status!.setAt }))
    if (out.length > 0) this.#opts.ev?.emit('contacts.update', out.map((s) => ({ id: s.jid, status: s.status })))
    return out
  }

  /**
   * Semua device (JID) milik daftar user. Cocok dipasang sebagai
   * `resolveDevices` pada relay. Device hosted dilewati.
   */
  async getDevices(userJids: readonly string[], options: GetDevicesOptions = {}): Promise<string[]> {
    const users = [...new Set(userJids.map(jidNormalizedUser))]
    const found = new Map<string, DeviceInfo[]>()
    const missing: string[] = []

    for (const user of users) {
      const cached = this.#cache.get(user)
      if (!options.force && cached && cached.expires > this.#now()) found.set(user, cached.devices)
      else missing.push(user)
    }

    if (missing.length > 0) {
      const results = await this.#usync(['devices'], missing.map((jid) => ({ jid })))
      for (const r of results) {
        const key = jidNormalizedUser(r.jid)
        const devices = r.devices ?? []
        this.#cache.set(key, { devices, expires: this.#now() + this.#ttl })
        found.set(key, devices)
      }
      for (const user of missing) if (!found.has(user)) this.#logger.warn({ user }, 'no device list returned')
    }

    return [...found.values()]
      .flat()
      .filter((d) => !d.isHosted && !(options.ignoreZeroDevices && d.id === 0))
      .map((d) => d.jid)
  }

  /** Lupakan cache device (mis. setelah notifikasi perubahan device). */
  invalidateDevices(jid?: string): void {
    if (jid === undefined) this.#cache.clear()
    else this.#cache.delete(jidNormalizedUser(jid))
  }

  /** URL foto profil; `undefined` bila tidak ada / tidak diizinkan. */
  async profilePictureUrl(jid: string, type: ProfilePictureType = 'preview'): Promise<string | undefined> {
    const decoded = jidDecode(jid)
    if (!decoded) return undefined
    try {
      const result = await this.#opts.query({
        tag: 'iq',
        attrs: { target: jidEncode(decoded.user, decoded.server), to: S_WHATSAPP_NET, type: 'get', xmlns: 'w:profile:picture' },
        content: [{ tag: 'picture', attrs: { type, query: 'url' } }],
      })
      return getChild(result, 'picture')?.attrs.url
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode
      if (status === 401 || status === 404 || status === 403) return undefined
      throw error
    }
  }

  async fetchBlocklist(): Promise<string[]> {
    const result = await this.#opts.query({ tag: 'iq', attrs: { xmlns: 'blocklist', to: S_WHATSAPP_NET, type: 'get' } })
    return getChildren(getChild(result, 'list') ?? { tag: '', attrs: {} }, 'item')
      .map((i) => i.attrs.jid)
      .filter((j): j is string => j !== undefined)
  }

  async updateBlockStatus(jid: string, action: BlockAction): Promise<void> {
    await this.#opts.query({
      tag: 'iq',
      attrs: { xmlns: 'blocklist', to: S_WHATSAPP_NET, type: 'set' },
      content: [{ tag: 'item', attrs: { action, jid } }],
    })
  }
}
