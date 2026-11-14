import { BusinessError } from '../core/errors.js'
import type { TypedEventEmitter } from '../core/event-emitter.js'
import { getChild, getChildren, getContentString } from '../protocol/binary-node.js'
import type { BinaryNode } from '../protocol/protocol-types.js'
import { S_WHATSAPP_NET } from '../protocol/stanza-builder.js'
import { buildCatalogQuery, buildCollectionsQuery, parseCatalog, parseCollections } from './business-catalog.js'
import type { BusinessProfile, BusinessProfileUpdate, Catalog, CatalogQueryOptions, Collection } from './business-types.js'

const num = (v: string | undefined): number | undefined => (v !== undefined && Number.isFinite(Number(v)) ? Number(v) : undefined)
const leaf = (tag: string, value: string): BinaryNode => ({ tag, attrs: {}, content: Buffer.from(value, 'utf8') })

export function buildBusinessProfileQuery(jid: string): BinaryNode {
  return {
    tag: 'iq',
    attrs: { to: S_WHATSAPP_NET, xmlns: 'w:biz', type: 'get' },
    content: [{ tag: 'business_profile', attrs: { v: '244' }, content: [{ tag: 'profile', attrs: { jid } }] }],
  }
}

export function parseBusinessProfile(result: BinaryNode): BusinessProfile | undefined {
  const profile = getChild(getChild(result, 'business_profile') ?? { tag: '', attrs: {} }, 'profile')
  if (!profile) return undefined

  const hours = getChild(profile, 'business_hours')
  const categories = getChild(profile, 'categories')
  return {
    jid: profile.attrs.jid ?? '',
    address: getContentString(getChild(profile, 'address')),
    description: getContentString(getChild(profile, 'description')),
    email: getContentString(getChild(profile, 'email')),
    websites: getChildren(profile, 'website').map((w) => getContentString(w)).filter((w): w is string => !!w),
    categories: categories
      ? getChildren(categories, 'category').map((c) => ({ id: c.attrs.id ?? '', name: getContentString(c) }))
      : [],
    hours: hours
      ? {
          timezone: hours.attrs.timezone,
          config: getChildren(hours, 'business_hours_config').map((h) => ({
            day: h.attrs.day_of_week ?? '',
            mode: h.attrs.mode,
            openTime: num(h.attrs.open_time),
            closeTime: num(h.attrs.close_time),
          })),
        }
      : undefined,
  }
}

/** Ubah profil bisnis milik sendiri (bentuk node belum diverifikasi terhadap server). */
export function buildBusinessProfileUpdate(update: BusinessProfileUpdate): BinaryNode {
  const content: BinaryNode[] = []
  if (update.address !== undefined) content.push(leaf('address', update.address))
  if (update.email !== undefined) content.push(leaf('email', update.email))
  if (update.description !== undefined) content.push(leaf('description', update.description))
  for (const site of update.websites ?? []) {
    if (!/^https?:\/\//.test(site)) throw new BusinessError(`Website must start with http(s)://: ${site}`)
    content.push(leaf('website', site))
  }
  if (update.categories) {
    content.push({ tag: 'categories', attrs: {}, content: update.categories.map((id) => ({ tag: 'category', attrs: { id } })) })
  }
  if (content.length === 0) throw new BusinessError('Nothing to update')
  return {
    tag: 'iq',
    attrs: { to: S_WHATSAPP_NET, type: 'set', xmlns: 'w:biz' },
    content: [{ tag: 'business_profile', attrs: { v: '3', mutation: 'true' }, content }],
  }
}

export interface BusinessManagerOptions {
  query: (node: BinaryNode, timeoutMs?: number) => Promise<BinaryNode>
  ev?: TypedEventEmitter<Record<string, unknown>>
}

export class BusinessManager {
  readonly #opts: BusinessManagerOptions

  constructor(options: BusinessManagerOptions) {
    this.#opts = options
  }

  /** Profil bisnis; `undefined` bila akun bukan akun bisnis. */
  async profile(jid: string): Promise<BusinessProfile | undefined> {
    return parseBusinessProfile(await this.#opts.query(buildBusinessProfileQuery(jid)))
  }

  async updateProfile(update: BusinessProfileUpdate): Promise<void> {
    await this.#opts.query(buildBusinessProfileUpdate(update))
  }

  async catalog(jid: string, options?: CatalogQueryOptions): Promise<Catalog> {
    return parseCatalog(await this.#opts.query(buildCatalogQuery(jid, options)))
  }

  /** Semua produk dengan menelusuri halaman (dibatasi `maxPages`). */
  async allProducts(jid: string, maxPages = 10): Promise<Catalog['products']> {
    const all: Catalog['products'] = []
    let cursor: string | undefined
    for (let page = 0; page < maxPages; page++) {
      const result = await this.catalog(jid, { limit: 50, ...(cursor && { cursor }) })
      all.push(...result.products)
      cursor = result.nextCursor
      if (!cursor) break
    }
    return all
  }

  async collections(jid: string, limit?: number): Promise<Collection[]> {
    return parseCollections(await this.#opts.query(buildCollectionsQuery(jid, limit)))
  }
}
