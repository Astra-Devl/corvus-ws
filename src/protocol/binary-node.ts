import type { BinaryNode, NodeFilter } from './protocol-types.js'

export function getChild(node: BinaryNode, tag: string): BinaryNode | undefined {
  return Array.isArray(node.content) ? node.content.find((c) => c.tag === tag) : undefined
}

export function getChildren(node: BinaryNode, tag?: string): BinaryNode[] {
  if (!Array.isArray(node.content)) return []
  return tag === undefined ? node.content : node.content.filter((c) => c.tag === tag)
}

export function getAttr(node: BinaryNode | undefined, key: string): string | undefined {
  return node?.attrs[key]
}

/** Isi node sebagai string (UTF-8 jika berupa bytes). */
export function getContentString(node: BinaryNode | undefined): string | undefined {
  const content = node?.content
  if (typeof content === 'string') return content
  if (content instanceof Uint8Array) return Buffer.from(content).toString('utf8')
  return undefined
}

export function getContentBytes(node: BinaryNode | undefined): Uint8Array | undefined {
  const content = node?.content
  if (content instanceof Uint8Array) return content
  if (typeof content === 'string') return Buffer.from(content, 'utf8')
  return undefined
}

export function matchesFilter(node: BinaryNode, filter: NodeFilter): boolean {
  if (filter.tag !== undefined && node.tag !== filter.tag) return false
  if (filter.attrs) {
    for (const [key, value] of Object.entries(filter.attrs)) {
      if (node.attrs[key] !== value) return false
    }
  }
  if (filter.child !== undefined && !getChild(node, filter.child)) return false
  return true
}

/** Representasi mirip XML untuk logging/debug (bytes dipotong). */
export function nodeToString(node: BinaryNode, indent = 0): string {
  const pad = '  '.repeat(indent)
  const attrs = Object.entries(node.attrs)
    .map(([k, v]) => ` ${k}="${v}"`)
    .join('')
  const { content } = node
  if (content === undefined) return `${pad}<${node.tag}${attrs}/>`
  if (typeof content === 'string') return `${pad}<${node.tag}${attrs}>${content}</${node.tag}>`
  if (content instanceof Uint8Array) {
    return `${pad}<${node.tag}${attrs}>[${content.length} bytes]</${node.tag}>`
  }
  const children = content.map((c) => nodeToString(c, indent + 1)).join('\n')
  return `${pad}<${node.tag}${attrs}>\n${children}\n${pad}</${node.tag}>`
}
