/**
 * Pemetaan nomor telepon (PN) <-> LID. WhatsApp kini mengalamatkan sesi Signal dan token
 * lewat LID; pemetaan ini dipakai agar JID PN dan LID menunjuk ke sesi yang sama.
 * Format penyimpanan mengikuti LIDMappingStore milik @whiskeysockets/baileys (MIT).
 */
import type { SignalKeyStore } from '../auth/key-store.js'
import { noopLogger } from '../core/defaults.js'
import type { Logger } from '../core/socket-config.js'
import { jidDecode, jidEncode, LID_SERVER, S_WHATSAPP_NET } from '../utils/jid.js'

export interface LidPnPair {
  lid: string
  pn: string
}

export interface LidMappingOptions {
  keys: Pick<SignalKeyStore, 'get' | 'set'>
  /** Ambil LID dari server (usync) untuk PN yang belum dipetakan. */
  fetchLids?: (pnJids: string[]) => Promise<LidPnPair[]>
  logger?: Logger
}

const isPn = (server: string): boolean => server === S_WHATSAPP_NET || server === 'c.us'

export class LidMappingStore {
  readonly #keys: LidMappingOptions['keys']
  readonly #fetchLids: LidMappingOptions['fetchLids']
  readonly #logger: Logger
  /** `pn:<user>` -> lidUser dan `lid:<user>` -> pnUser. */
  readonly #cache = new Map<string, string>()

  constructor(options: LidMappingOptions) {
    this.#keys = options.keys
    this.#fetchLids = options.fetchLids
    this.#logger = options.logger ?? noopLogger
  }

  /** Simpan pasangan LID/PN (urutan argumen boleh terbalik). */
  async store(pairs: readonly LidPnPair[]): Promise<void> {
    const batch: Record<string, string> = {}
    for (const { lid, pn } of pairs) {
      const a = jidDecode(lid)
      const b = jidDecode(pn)
      if (!a || !b) continue
      const [lidPart, pnPart] = a.server === LID_SERVER ? [a, b] : [b, a]
      if (lidPart.server !== LID_SERVER || !isPn(pnPart.server)) {
        this.#logger.debug({ lid, pn }, 'pasangan LID/PN diabaikan (bukan pasangan PN/LID)')
        continue
      }
      if (this.#cache.get(`pn:${pnPart.user}`) === lidPart.user) continue
      this.#cache.set(`pn:${pnPart.user}`, lidPart.user)
      this.#cache.set(`lid:${lidPart.user}`, pnPart.user)
      batch[pnPart.user] = lidPart.user
      batch[`${lidPart.user}_reverse`] = pnPart.user
    }
    if (Object.keys(batch).length > 0) await this.#keys.set({ 'lid-mapping': batch })
  }

  async #lookup(kind: 'pn' | 'lid', user: string): Promise<string | undefined> {
    const cached = this.#cache.get(`${kind}:${user}`)
    if (cached) return cached
    const key = kind === 'pn' ? user : `${user}_reverse`
    const stored = (await this.#keys.get('lid-mapping', [key]))[key]
    if (stored) {
      this.#cache.set(`${kind}:${user}`, stored)
      this.#cache.set(`${kind === 'pn' ? 'lid' : 'pn'}:${stored}`, user)
    }
    return stored
  }

  /** `62812:3@s.whatsapp.net` -> `<lid>:3@lid` bila sudah dipetakan. */
  async getLid(pnJid: string, options: { fetch?: boolean } = {}): Promise<string | undefined> {
    const d = jidDecode(pnJid)
    if (!d || !isPn(d.server)) return undefined
    let lidUser = await this.#lookup('pn', d.user)
    if (!lidUser && options.fetch && this.#fetchLids) {
      try {
        await this.store(await this.#fetchLids([jidEncode(d.user, S_WHATSAPP_NET)]))
        lidUser = await this.#lookup('pn', d.user)
      } catch (error) {
        this.#logger.debug({ err: error, jid: pnJid }, 'gagal mengambil LID dari server')
      }
    }
    return lidUser ? jidEncode(lidUser, LID_SERVER, d.device) : undefined
  }

  /** `<lid>:3@lid` -> `62812:3@s.whatsapp.net` bila sudah dipetakan. */
  async getPn(lidJid: string): Promise<string | undefined> {
    const d = jidDecode(lidJid)
    if (!d || d.server !== LID_SERVER) return undefined
    const pnUser = await this.#lookup('lid', d.user)
    return pnUser ? jidEncode(pnUser, S_WHATSAPP_NET, d.device) : undefined
  }

  /**
   * JID yang dipakai untuk alamat sesi Signal dan pengambilan pre-key: PN dipetakan ke LID
   * bila ada, selain itu JID apa adanya.
   */
  async resolveSignalJid(jid: string, options: { fetch?: boolean } = {}): Promise<string> {
    return (await this.getLid(jid, options)) ?? jid
  }
}
