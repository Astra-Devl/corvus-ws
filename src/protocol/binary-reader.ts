import { inflateSync } from 'node:zlib'
import { ProtocolError } from '../core/errors.js'
import { getDefaultTokenDictionary, type TokenDictionary } from './token-dictionary.js'
import {
  JID_DOMAIN_TYPES,
  MAX_NODE_DEPTH,
  TAGS,
  type BinaryNode,
  type BinaryNodeContent,
} from './protocol-types.js'

export interface DecodeOptions {
  /** Batas ukuran hasil dekompresi (byte). Default 16 MiB. */
  maxDecompressedSize?: number
}

const DEFAULT_MAX_DECOMPRESSED = 16 * 1024 * 1024

class ByteReader {
  #pos = 0
  readonly #buf: Buffer

  constructor(buf: Buffer) {
    this.#buf = buf
  }

  get remaining(): number {
    return this.#buf.length - this.#pos
  }

  #need(n: number): void {
    if (n < 0 || this.remaining < n) throw new ProtocolError('Unexpected end of data')
  }

  byte(): number {
    this.#need(1)
    return this.#buf[this.#pos++]!
  }

  int(bytes: number): number {
    this.#need(bytes)
    let value = 0
    for (let i = 0; i < bytes; i++) value = value * 256 + this.#buf[this.#pos++]!
    return value
  }

  int20(): number {
    this.#need(3)
    return ((this.byte() & 0x0f) << 16) | (this.byte() << 8) | this.byte()
  }

  bytes(n: number): Buffer {
    this.#need(n)
    const out = Buffer.from(this.#buf.subarray(this.#pos, this.#pos + n))
    this.#pos += n
    return out
  }

  utf8(n: number): string {
    this.#need(n)
    const out = this.#buf.toString('utf8', this.#pos, this.#pos + n)
    this.#pos += n
    return out
  }
}

const isListTag = (tag: number): boolean =>
  tag === TAGS.LIST_EMPTY || tag === TAGS.LIST_8 || tag === TAGS.LIST_16

function readListSize(r: ByteReader, tag: number): number {
  switch (tag) {
    case TAGS.LIST_EMPTY:
      return 0
    case TAGS.LIST_8:
      return r.byte()
    case TAGS.LIST_16:
      return r.int(2)
    default:
      throw new ProtocolError(`Invalid list tag: ${tag}`)
  }
}

function unpack(tag: number, value: number): string {
  if (value >= 0 && value <= 9) return String(value)
  if (tag === TAGS.NIBBLE_8) {
    if (value === 10) return '-'
    if (value === 11) return '.'
    if (value === 15) return '\0'
  } else if (tag === TAGS.HEX_8 && value >= 10 && value <= 15) {
    return String.fromCharCode(55 + value)
  }
  throw new ProtocolError(`Invalid packed value ${value} for tag ${tag}`)
}

function readPacked(r: ByteReader, tag: number): string {
  const start = r.byte()
  let out = ''
  for (let i = 0; i < (start & 127); i++) {
    const b = r.byte()
    out += unpack(tag, (b & 0xf0) >> 4) + unpack(tag, b & 0x0f)
  }
  if (start >> 7 !== 0) out = out.slice(0, -1)
  return out
}

const DOMAIN_NAMES = new Map<number, string>(
  Object.entries(JID_DOMAIN_TYPES).map(([name, type]) => [type, name]),
)

function readString(r: ByteReader, tag: number, dict: TokenDictionary): string {
  if (tag >= 1 && tag < dict.single.length) return dict.getSingle(tag)

  switch (tag) {
    case TAGS.DICTIONARY_0:
    case TAGS.DICTIONARY_1:
    case TAGS.DICTIONARY_2:
    case TAGS.DICTIONARY_3:
      return dict.getDouble(tag - TAGS.DICTIONARY_0, r.byte())
    case TAGS.LIST_EMPTY:
      return ''
    case TAGS.BINARY_8:
      return r.utf8(r.byte())
    case TAGS.BINARY_20:
      return r.utf8(r.int20())
    case TAGS.BINARY_32:
      return r.utf8(r.int(4))
    case TAGS.JID_PAIR: {
      const user = readString(r, r.byte(), dict)
      const server = readString(r, r.byte(), dict)
      if (!server) throw new ProtocolError('Invalid JID pair: empty server')
      return `${user}@${server}`
    }
    case TAGS.AD_JID: {
      const domainType = r.byte()
      const device = r.byte()
      const user = readString(r, r.byte(), dict)
      const server = DOMAIN_NAMES.get(domainType) ?? 's.whatsapp.net'
      return `${user}${device ? `:${device}` : ''}@${server}`
    }
    case TAGS.HEX_8:
    case TAGS.NIBBLE_8:
      return readPacked(r, tag)
    default:
      throw new ProtocolError(`Unsupported or unknown string tag: ${tag}`)
  }
}

function readList(r: ByteReader, tag: number, dict: TokenDictionary, depth: number): BinaryNode[] {
  const size = readListSize(r, tag)
  // setiap node butuh minimal 1 byte; cegah alokasi berlebih dari data palsu
  if (size > r.remaining) throw new ProtocolError('List size exceeds available data')
  const items: BinaryNode[] = []
  for (let i = 0; i < size; i++) items.push(readNode(r, dict, depth + 1))
  return items
}

function readNode(r: ByteReader, dict: TokenDictionary, depth: number): BinaryNode {
  if (depth > MAX_NODE_DEPTH) throw new ProtocolError('Node nesting too deep')

  const listSize = readListSize(r, r.byte())
  const descr = r.byte()
  if (descr === TAGS.STREAM_END) throw new ProtocolError('Unexpected stream end')

  const tag = readString(r, descr, dict)
  if (listSize === 0 || tag.length === 0) throw new ProtocolError('Invalid node')

  const attrCount = (listSize - 1) >> 1
  const entries: Array<[string, string]> = []
  for (let i = 0; i < attrCount; i++) {
    const key = readString(r, r.byte(), dict)
    entries.push([key, readString(r, r.byte(), dict)])
  }
  const attrs = Object.fromEntries(entries)

  let content: BinaryNodeContent | undefined
  if (listSize % 2 === 0) {
    const contentTag = r.byte()
    if (isListTag(contentTag)) {
      content = readList(r, contentTag, dict, depth)
    } else if (contentTag === TAGS.BINARY_8) {
      content = r.bytes(r.byte())
    } else if (contentTag === TAGS.BINARY_20) {
      content = r.bytes(r.int20())
    } else if (contentTag === TAGS.BINARY_32) {
      content = r.bytes(r.int(4))
    } else {
      content = readString(r, contentTag, dict)
    }
  }

  return content === undefined ? { tag, attrs } : { tag, attrs, content }
}

/**
 * Decode bytes menjadi node. Byte pertama = flags (bit 2 = zlib).
 * Catatan: isi berupa teks biasa yang bukan token/packed/JID dikembalikan
 * sebagai `Uint8Array`; gunakan `getContentString()` untuk membacanya.
 */
export function decodeBinaryNode(
  data: Uint8Array,
  dictionary: TokenDictionary = getDefaultTokenDictionary(),
  options: DecodeOptions = {},
): BinaryNode {
  if (data.length < 2) throw new ProtocolError('Frame too short')
  const buf = Buffer.from(data.buffer, data.byteOffset, data.length)

  let payload = buf.subarray(1)
  if (buf[0]! & 2) {
    try {
      payload = inflateSync(payload, {
        maxOutputLength: options.maxDecompressedSize ?? DEFAULT_MAX_DECOMPRESSED,
      })
    } catch (cause) {
      throw new ProtocolError('Failed to decompress frame', { cause })
    }
  }
  return readNode(new ByteReader(payload), dictionary, 0)
}
