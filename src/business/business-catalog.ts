import { BusinessError } from '../core/errors.js'
import { getChild, getChildren, getContentString } from '../protocol/binary-node.js'
import type { BinaryNode } from '../protocol/protocol-types.js'
import { S_WHATSAPP_NET } from '../protocol/stanza-builder.js'
import type { Catalog, CatalogQueryOptions, Collection, Product } from './business-types.js'

const text = (node: BinaryNode, tag: string): string | undefined => getContentString(getChild(node, tag))
const leaf = (tag: string, value: string | number): BinaryNode => ({ tag, attrs: {}, content: String(value) })

/** `<product>` -> `Product` (nama child mengikuti respons server). */
export function parseProduct(node: BinaryNode): Product | undefined {
  const id = text(node, 'id')
  if (!id) return undefined
  const image = getChild(getChild(node, 'media') ?? { tag: '', attrs: {} }, 'image')
  return {
    id,
    name: text(node, 'name'),
    description: text(node, 'description'),
    price: text(node, 'price'),
    currency: text(node, 'currency'),
    url: text(node, 'url'),
    retailerId: text(node, 'retailer_id'),
    isHidden: node.attrs.is_hidden === 'true',
    availability: text(getChild(node, 'status_info') ?? { tag: '', attrs: {} }, 'status'),
    image: image ? { requestUrl: text(image, 'request_image_url'), originalUrl: text(image, 'original_image_url') } : undefined,
  }
}

export function buildCatalogQuery(jid: string, options: CatalogQueryOptions = {}): BinaryNode {
  const limit = options.limit ?? 10
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new BusinessError('limit must be between 1 and 100')
  return {
    tag: 'iq',
    attrs: { to: S_WHATSAPP_NET, type: 'get', xmlns: 'w:biz:catalog' },
    content: [
      {
        tag: 'product_catalog',
        attrs: { jid, allow_shop_source: 'true' },
        content: [
          leaf('limit', limit),
          leaf('width', options.imageWidth ?? 100),
          leaf('height', options.imageHeight ?? 100),
          ...(options.cursor ? [leaf('after', options.cursor)] : []),
        ],
      },
    ],
  }
}

export function parseCatalog(result: BinaryNode): Catalog {
  const catalog = getChild(result, 'product_catalog')
  if (!catalog) return { products: [], nextCursor: undefined }
  return {
    products: getChildren(catalog, 'product').map(parseProduct).filter((p): p is Product => p !== undefined),
    nextCursor: text(getChild(catalog, 'paging') ?? { tag: '', attrs: {} }, 'after'),
  }
}

export function buildCollectionsQuery(jid: string, limit = 51, imageWidth = 100, imageHeight = 100): BinaryNode {
  return {
    tag: 'iq',
    attrs: { to: S_WHATSAPP_NET, type: 'get', xmlns: 'w:biz:catalog' },
    content: [
      {
        tag: 'collections',
        attrs: { biz_jid: jid },
        content: [leaf('collection_limit', limit), leaf('item_limit', limit), leaf('width', imageWidth), leaf('height', imageHeight)],
      },
    ],
  }
}

export function parseCollections(result: BinaryNode): Collection[] {
  const container = getChild(result, 'collections')
  return container
    ? getChildren(container, 'collection').map((c) => ({
        id: text(c, 'id') ?? '',
        name: text(c, 'name'),
        products: getChildren(c, 'product').map(parseProduct).filter((p): p is Product => p !== undefined),
      }))
    : []
}
