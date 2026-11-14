import { ProtocolError } from '../core/errors.js'
import { getDefaultTokenDictionary, type TokenDictionary } from './token-dictionary.js'
import { JID_DOMAIN_TYPES, PACKED_MAX, TAGS, type BinaryNode } from './protocol-types.js'

class ByteWriter {
  #buf = Buffer.allocUnsafe(256)
  #len = 0

  #ensure(extra: number): void {
    const need = this.#len + extra
    if (need <= this.#buf.length) return
    let size = this.#buf.length * 2
    while (size < need) size *= 2
    const next = Buffer.allocUnsafe(size)
    this.#buf.copy(next, 0, 0, this.#len)
    this.#buf = next
  }

  byte(value: number): void {
    this.#ensure(1)
    this.#buf[this.#len++] = value & 0xff
  }
  int16(value: number): void {
    this.byte(value >> 8)
    this.byte(value)
  }
  int20(value: number): void {
    this.byte((value >> 16) & 0x0f)
    this.byte(value >> 8)
    this.byte(value)
  }
  int32(value: number): void {
    this.#ensure(4)
    this.#buf.writeUInt32BE(value >>> 0, this.#len)
    this.#len += 4
  }
  bytes(data: Uint8Array): void {
    this.#ensure(data.length)
    this.#buf.set(data, this.#len)
    this.#len += data.length
  }
  utf8(text: string, byteLength: number): void {
    this.#ensure(byteLength)
    this.#buf.write(text, this.#len, 'utf8')
    this.#len += byteLength
  }
  toBuffer(): Buffer {
    return Buffer.from(this.#buf.subarray(0, this.#len))
  }
}

function writeByteLength(w: ByteWriter, length: number): void {
  if (length < 256) {
    w.byte(TAGS.BINARY_8)
    w.byte(length)
  } else if (length < 1 << 20) {
    w.byte(TAGS.BINARY_20)
    w.int20(length)
  } else {
    w.byte(TAGS.BINARY_32)
    w.int32(length)
  }
}

function writeListStart(w: ByteWriter, size: number): void {
  if (size === 0) w.byte(TAGS.LIST_EMPTY)
  else if (size < 256) {
    w.byte(TAGS.LIST_8)
    w.byte(size)
  } else {
    w.byte(TAGS.LIST_16)
    w.int16(size)
  }
}

const isNibble = (s: string): boolean => s.length > 0 && s.length <= PACKED_MAX && /^[0-9.-]+$/.test(s)
const isHex = (s: string): boolean => s.length > 0 && s.length <= PACKED_MAX && /^[0-9A-F]+$/.test(s)

function packChar(char: string | undefined, type: 'nibble' | 'hex'): number {
  if (char === undefined) return 15
  if (char >= '0' && char <= '9') return char.charCodeAt(0) - 48
  if (type === 'nibble') {
    if (char === '-') return 10
    if (char === '.') return 11
  } else if (char >= 'A' && char <= 'F') {
    return char.charCodeAt(0) - 55
  }
  throw new ProtocolError(`Cannot pack character "${char}"`)
}

function writePacked(w: ByteWriter, str: string, type: 'nibble' | 'hex'): void {
  w.byte(type === 'nibble' ? TAGS.NIBBLE_8 : TAGS.HEX_8)
  let rounded = Math.ceil(str.length / 2)
  if (str.length % 2 === 1) rounded |= 128
  w.byte(rounded)
  for (let i = 0; i < str.length; i += 2) {
    w.byte((packChar(str[i], type) << 4) | packChar(str[i + 1], type))
  }
}

interface WireJid {
  user: string
  server: string
  device: number | undefined
}

function parseWireJid(str: string): WireJid | undefined {
  const at = str.indexOf('@')
  if (at < 0) return undefined
  const server = str.slice(at + 1)
  if (!server || server.includes('@')) return undefined
  const combined = str.slice(0, at)

  const colon = combined.indexOf(':')
  if (colon < 0) return { user: combined, server, device: undefined }

  const user = combined.slice(0, colon)
  const deviceText = combined.slice(colon + 1)
  if (!user || !/^\d{1,3}$/.test(deviceText)) return undefined
  const device = Number(deviceText)
  // AD_JID hanya bisa memuat domain tertentu dan device 0-255
  if (device > 255 || !(server in JID_DOMAIN_TYPES)) return undefined
  return { user, server, device }
}

function writeString(w: ByteWriter, str: string, dict: TokenDictionary): void {
  const token = dict.lookup(str)
  if (token) {
    if (token.dict !== undefined) w.byte(TAGS.DICTIONARY_0 + token.dict)
    w.byte(token.index)
    return
  }
  if (isNibble(str)) return writePacked(w, str, 'nibble')
  if (isHex(str)) return writePacked(w, str, 'hex')

  const jid = str.length > 0 ? parseWireJid(str) : undefined
  if (jid) {
    if (jid.device !== undefined) {
      w.byte(TAGS.AD_JID)
      w.byte(JID_DOMAIN_TYPES[jid.server as keyof typeof JID_DOMAIN_TYPES])
      w.byte(jid.device)
      writeString(w, jid.user, dict)
    } else {
      w.byte(TAGS.JID_PAIR)
      if (jid.user.length > 0) writeString(w, jid.user, dict)
      else w.byte(TAGS.LIST_EMPTY)
      writeString(w, jid.server, dict)
    }
    return
  }

  const byteLength = Buffer.byteLength(str, 'utf8')
  writeByteLength(w, byteLength)
  w.utf8(str, byteLength)
}

function writeNode(w: ByteWriter, node: BinaryNode, dict: TokenDictionary): void {
  if (!node || typeof node.tag !== 'string' || node.tag.length === 0) {
    throw new ProtocolError('Invalid node: missing tag')
  }
  const attrs = Object.entries(node.attrs ?? {}).filter(([, v]) => v !== undefined && v !== null)
  const { content } = node
  const hasContent = content !== undefined && content !== null

  writeListStart(w, 2 * attrs.length + 1 + (hasContent ? 1 : 0))
  writeString(w, node.tag, dict)

  for (const [key, value] of attrs) {
    if (typeof value !== 'string') {
      throw new ProtocolError(`Attribute "${key}" of <${node.tag}> must be a string`)
    }
    writeString(w, key, dict)
    writeString(w, value, dict)
  }

  if (!hasContent) return
  if (typeof content === 'string') {
    writeString(w, content, dict)
  } else if (content instanceof Uint8Array) {
    writeByteLength(w, content.length)
    w.bytes(content)
  } else if (Array.isArray(content)) {
    const children = content.filter((c) => c !== undefined && c !== null)
    writeListStart(w, children.length)
    for (const child of children) writeNode(w, child, dict)
  } else {
    throw new ProtocolError(`Invalid content type for <${node.tag}>`)
  }
}

/** Encode node menjadi bytes. Byte pertama adalah flags (0 = tidak dikompres). */
export function encodeBinaryNode(
  node: BinaryNode,
  dictionary: TokenDictionary = getDefaultTokenDictionary(),
): Buffer {
  const w = new ByteWriter()
  w.byte(0)
  writeNode(w, node, dictionary)
  return w.toBuffer()
}
