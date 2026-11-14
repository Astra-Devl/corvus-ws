import { PrivacyError } from '../core/errors.js'
import { getChild, getChildren } from '../protocol/binary-node.js'
import type { BinaryNode } from '../protocol/protocol-types.js'
import { S_WHATSAPP_NET } from '../protocol/stanza-builder.js'
import { DISAPPEARING_DURATIONS, PRIVACY_OPTIONS, type PrivacyCategory, type PrivacySettings, type PrivacyValue } from './privacy-types.js'

export const buildPrivacyQuery = (): BinaryNode => ({
  tag: 'iq',
  attrs: { xmlns: 'privacy', to: S_WHATSAPP_NET, type: 'get' },
  content: [{ tag: 'privacy', attrs: {} }],
})

/** `<iq><privacy><category name= value=/>...` -> `{ last: 'all', ... }` */
export function parsePrivacySettings(result: BinaryNode): PrivacySettings {
  const privacy = getChild(result, 'privacy')
  const out: PrivacySettings = {}
  if (!privacy) return out
  for (const category of getChildren(privacy, 'category')) {
    if (category.attrs.name && category.attrs.value !== undefined) out[category.attrs.name] = category.attrs.value
  }
  return out
}

export function buildPrivacyUpdate(category: PrivacyCategory, value: PrivacyValue): BinaryNode {
  const allowed = PRIVACY_OPTIONS[category]
  if (!allowed) throw new PrivacyError(`Unknown privacy category: ${String(category)}`)
  if (!allowed.includes(value)) {
    throw new PrivacyError(`Invalid value "${String(value)}" for "${category}" (allowed: ${allowed.join(', ')})`)
  }
  return {
    tag: 'iq',
    attrs: { xmlns: 'privacy', to: S_WHATSAPP_NET, type: 'set' },
    content: [{ tag: 'privacy', attrs: {}, content: [{ tag: 'category', attrs: { name: category, value } }] }],
  }
}

export function buildDisappearingModeUpdate(durationSeconds: number, nowSeconds = Math.floor(Date.now() / 1000)): BinaryNode {
  if (!(DISAPPEARING_DURATIONS as readonly number[]).includes(durationSeconds)) {
    throw new PrivacyError(`Duration must be one of ${DISAPPEARING_DURATIONS.join(', ')} seconds`)
  }
  return {
    tag: 'iq',
    attrs: { xmlns: 'disappearing_mode', to: S_WHATSAPP_NET, type: 'set' },
    content: [{ tag: 'disappearing_mode', attrs: { duration: String(durationSeconds), t: String(nowSeconds) } }],
  }
}

export interface PrivacyManagerOptions {
  query: (node: BinaryNode, timeoutMs?: number) => Promise<BinaryNode>
  now?: () => number
}

export class PrivacyManager {
  readonly #opts: PrivacyManagerOptions
  #cache: PrivacySettings | undefined

  constructor(options: PrivacyManagerOptions) {
    this.#opts = options
  }

  async fetch(force = false): Promise<PrivacySettings> {
    if (!force && this.#cache) return { ...this.#cache }
    this.#cache = parsePrivacySettings(await this.#opts.query(buildPrivacyQuery()))
    return { ...this.#cache }
  }

  async update(category: PrivacyCategory, value: PrivacyValue): Promise<PrivacySettings> {
    await this.#opts.query(buildPrivacyUpdate(category, value))
    this.#cache = { ...(this.#cache ?? (await this.fetch(true))), [category]: value }
    return { ...this.#cache }
  }

  setLastSeen = (v: PrivacyValue): Promise<PrivacySettings> => this.update('last', v)
  setOnline = (v: PrivacyValue): Promise<PrivacySettings> => this.update('online', v)
  setProfilePicture = (v: PrivacyValue): Promise<PrivacySettings> => this.update('profile', v)
  setStatus = (v: PrivacyValue): Promise<PrivacySettings> => this.update('status', v)
  setReadReceipts = (v: PrivacyValue): Promise<PrivacySettings> => this.update('readreceipts', v)
  setGroupAdd = (v: PrivacyValue): Promise<PrivacySettings> => this.update('groupadd', v)
  setCallAdd = (v: PrivacyValue): Promise<PrivacySettings> => this.update('calladd', v)

  /** Durasi pesan sementara bawaan untuk chat baru. */
  async setDefaultDisappearing(durationSeconds: number): Promise<void> {
    await this.#opts.query(buildDisappearingModeUpdate(durationSeconds, Math.floor((this.#opts.now ?? Date.now)() / 1000)))
  }
}
