import { randomBytes } from 'node:crypto'
import type { BinaryNode, BinaryNodeContent } from './protocol-types.js'

import { S_WHATSAPP_NET } from '../utils/jid.js'

export { S_WHATSAPP_NET }

export function node(
  tag: string,
  attrs: Record<string, string> = {},
  content?: BinaryNodeContent,
): BinaryNode {
  return content === undefined ? { tag, attrs } : { tag, attrs, content }
}

/** Pembuat id unik per-koneksi: `<prefix><counter>`. */
export function createTagGenerator(prefix = `${randomBytes(3).toString('hex')}-`): () => string {
  let counter = 1
  return () => `${prefix}${counter++}`
}

export interface IqOptions {
  type: 'get' | 'set' | 'result' | 'error'
  id?: string
  to?: string
  xmlns?: string
  attrs?: Record<string, string>
}

export function iq(options: IqOptions, content?: BinaryNodeContent): BinaryNode {
  const attrs: Record<string, string> = {
    to: options.to ?? S_WHATSAPP_NET,
    type: options.type,
    ...options.attrs,
  }
  if (options.id !== undefined) attrs.id = options.id
  if (options.xmlns !== undefined) attrs.xmlns = options.xmlns
  return node('iq', attrs, content)
}

/** `<iq type="get" xmlns="w:p"><ping/></iq>` */
export function buildPing(id?: string): BinaryNode {
  return iq({ type: 'get', xmlns: 'w:p', ...(id !== undefined && { id }) }, [node('ping')])
}

/** Jawaban `result` untuk iq dari server. */
export function buildIqResult(request: BinaryNode): BinaryNode {
  const attrs: Record<string, string> = { to: request.attrs.from ?? S_WHATSAPP_NET, type: 'result' }
  if (request.attrs.id !== undefined) attrs.id = request.attrs.id
  return node('iq', attrs)
}

export function buildAck(received: BinaryNode, extra: Record<string, string> = {}): BinaryNode {
  const attrs: Record<string, string> = { class: received.tag, ...extra }
  if (received.attrs.id !== undefined) attrs.id = received.attrs.id
  if (received.attrs.from !== undefined) attrs.to = received.attrs.from
  if (received.attrs.participant !== undefined) attrs.participant = received.attrs.participant
  return node('ack', attrs)
}
