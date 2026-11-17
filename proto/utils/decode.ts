import { ProtocolError } from '../../src/core/errors.js'
import {
  WireType,
  wireTypeOf,
  type FieldDescriptor,
  type FieldType,
  type MessageDescriptor,
  type ProtoRegistry,
  type ScalarType,
} from '../loader/proto-registry.js'
import { MAX_DEPTH } from './encode.js'

/** Nilai 64-bit: `number` bila aman, selain itu `bigint`. */
export type Int64 = number | bigint

function normalize64(value: bigint): Int64 {
  return value >= BigInt(Number.MIN_SAFE_INTEGER) && value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : value
}

/** Pembaca wire-format protobuf di atas buffer. */
export class WireReader {
  readonly #buf: Uint8Array
  readonly #view: DataView
  pos: number
  end: number

  constructor(buf: Uint8Array, start = 0, end = buf.length) {
    this.#buf = buf
    this.#view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
    this.pos = start
    this.end = end
  }

  get eof(): boolean {
    return this.pos >= this.end
  }

  #need(n: number): void {
    if (this.pos + n > this.end) throw new ProtocolError('Truncated protobuf data')
  }

  /** Varint hingga 64-bit: `number` bila aman, selain itu `bigint` (mentah, tanpa tanda). */
  varint(): number | bigint {
    let result = 0
    for (let i = 0; i < 7; i++) {
      this.#need(1)
      const byte = this.#buf[this.pos++]!
      result += (byte & 0x7f) * 2 ** (7 * i)
      if (!(byte & 0x80)) return result
    }
    let big = BigInt(result)
    for (let i = 7; i < 10; i++) {
      this.#need(1)
      const byte = this.#buf[this.pos++]!
      big |= BigInt(byte & 0x7f) << BigInt(7 * i)
      if (!(byte & 0x80)) {
        big = BigInt.asUintN(64, big)
        return big <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(big) : big
      }
    }
    throw new ProtocolError('Protobuf varint is too long')
  }

  /** Varint untuk panjang/tag: harus muat di uint32. */
  length(): number {
    const v = this.varint()
    if (typeof v !== 'number' || v > 0xffffffff) throw new ProtocolError('Invalid protobuf length')
    return v
  }

  fixed32(): number {
    this.#need(4)
    const v = this.#view.getUint32(this.pos, true)
    this.pos += 4
    return v
  }

  sfixed32(): number {
    this.#need(4)
    const v = this.#view.getInt32(this.pos, true)
    this.pos += 4
    return v
  }

  fixed64(signed: boolean): Int64 {
    this.#need(8)
    const v = signed ? this.#view.getBigInt64(this.pos, true) : this.#view.getBigUint64(this.pos, true)
    this.pos += 8
    return normalize64(v)
  }

  float(): number {
    this.#need(4)
    const v = this.#view.getFloat32(this.pos, true)
    this.pos += 4
    return v
  }

  double(): number {
    this.#need(8)
    const v = this.#view.getFloat64(this.pos, true)
    this.pos += 8
    return v
  }

  /** Salinan `len` byte berikutnya. */
  bytes(len: number): Buffer {
    this.#need(len)
    const out = Buffer.from(this.#buf.subarray(this.pos, this.pos + len))
    this.pos += len
    return out
  }

  string(len: number): string {
    this.#need(len)
    const out = Buffer.from(this.#buf.buffer, this.#buf.byteOffset + this.pos, len).toString('utf8')
    this.pos += len
    return out
  }

  skip(wire: number): void {
    switch (wire) {
      case WireType.VARINT:
        this.varint()
        return
      case WireType.FIXED64:
        this.#need(8)
        this.pos += 8
        return
      case WireType.LEN: {
        const len = this.length()
        this.#need(len)
        this.pos += len
        return
      }
      case WireType.FIXED32:
        this.#need(4)
        this.pos += 4
        return
      default:
        throw new ProtocolError(`Unsupported protobuf wire type ${wire}`)
    }
  }
}

interface Context {
  readonly registry: ProtoRegistry
}

function fail(owner: string, field: string | undefined, message: string): never {
  const where = field ? `${owner}.${field}` : owner
  throw new ProtocolError(`${where}: ${message}`, { data: { message: owner, field } })
}

const toInt32 = (v: number | bigint): number => (typeof v === 'number' ? v | 0 : Number(BigInt.asIntN(32, v)))
const toUint32 = (v: number | bigint): number => (typeof v === 'number' ? v >>> 0 : Number(BigInt.asUintN(32, v)))

function readScalar(r: WireReader, type: ScalarType | 'enum'): unknown {
  switch (type) {
    case 'int32':
    case 'enum':
      return toInt32(r.varint())
    case 'uint32':
      return toUint32(r.varint())
    case 'sint32': {
      const u = toUint32(r.varint())
      return (u >>> 1) ^ -(u & 1)
    }
    case 'int64': {
      const v = r.varint()
      return typeof v === 'number' ? v : normalize64(BigInt.asIntN(64, v))
    }
    case 'uint64': {
      return r.varint()
    }
    case 'sint64': {
      const b = BigInt(r.varint())
      return normalize64((b >> 1n) ^ -(b & 1n))
    }
    case 'bool': {
      const v = r.varint()
      return v !== 0 && v !== 0n
    }
    case 'fixed32':
      return r.fixed32()
    case 'sfixed32':
      return r.sfixed32()
    case 'fixed64':
      return r.fixed64(false)
    case 'sfixed64':
      return r.fixed64(true)
    case 'float':
      return r.float()
    case 'double':
      return r.double()
    case 'string':
      return r.string(r.length())
    case 'bytes':
      return r.bytes(r.length())
  }
}

function readValue(
  ctx: Context,
  r: WireReader,
  type: FieldType,
  typeName: string | undefined,
  depth: number,
): unknown {
  if (type !== 'message') return readScalar(r, type)
  const len = r.length()
  const end = r.pos + len
  if (end > r.end) throw new ProtocolError('Truncated protobuf data')
  const value = readMessage(ctx, r, ctx.registry.getMessage(typeName ?? ''), end, depth + 1)
  r.pos = end
  return value
}

function defaultFor(type: FieldType | 'unresolved'): unknown {
  switch (type) {
    case 'string':
      return ''
    case 'bytes':
      return Buffer.alloc(0)
    case 'bool':
      return false
    case 'message':
      return {}
    default:
      return 0
  }
}

function readMapEntry(ctx: Context, r: WireReader, owner: string, field: FieldDescriptor, depth: number): [string, unknown] {
  const map = field.map!
  const len = r.length()
  const end = r.pos + len
  if (end > r.end) throw new ProtocolError('Truncated protobuf data')

  let key: unknown = defaultFor(map.key)
  let value: unknown = defaultFor(map.value)
  const valueType = map.value as FieldType
  while (r.pos < end) {
    const tag = r.length()
    const number = tag >>> 3
    const wire = tag & 7
    if (number === 1 && wire === wireTypeOf(map.key)) key = readScalar(r, map.key)
    else if (number === 2 && wire === wireTypeOf(valueType)) value = readValue(ctx, r, valueType, map.valueTypeName, depth)
    else r.skip(wire)
  }
  if (r.pos !== end) fail(owner, field.name, 'malformed map entry')
  return [String(key), value]
}

function readMessage(ctx: Context, r: WireReader, desc: MessageDescriptor, end: number, depth: number): Record<string, unknown> {
  if (depth > MAX_DEPTH) fail(desc.fullName, undefined, 'message nesting is too deep')
  const layout = ctx.registry.cache.layout(desc)
  const out: Record<string, unknown> = {}
  const outerEnd = r.end
  r.end = end

  try {
    while (r.pos < end) {
      const tag = r.length()
      const number = tag >>> 3
      const wire = tag & 7
      const field = layout.byNumber.get(number)
      if (!field) {
        r.skip(wire)
        continue
      }

      if (field.map) {
        if (wire !== WireType.LEN) fail(desc.fullName, field.name, `unexpected wire type ${wire}`)
        const [key, value] = readMapEntry(ctx, r, desc.fullName, field, depth)
        const bucket = (out[field.name] ??= {}) as Record<string, unknown>
        bucket[key] = value
        continue
      }

      const type = field.type as FieldType
      const expected = wireTypeOf(type)

      if (field.label === 'repeated') {
        const list = (out[field.name] ??= []) as unknown[]
        // Skalar numerik boleh datang packed (LEN) maupun satuan, apa pun deklarasinya.
        if (wire === WireType.LEN && expected !== WireType.LEN) {
          const len = r.length()
          const packedEnd = r.pos + len
          if (packedEnd > end) throw new ProtocolError('Truncated protobuf data')
          while (r.pos < packedEnd) list.push(readScalar(r, type as ScalarType | 'enum'))
          if (r.pos !== packedEnd) fail(desc.fullName, field.name, 'malformed packed field')
        } else if (wire === expected) {
          list.push(readValue(ctx, r, type, field.typeName, depth))
        } else {
          fail(desc.fullName, field.name, `unexpected wire type ${wire}`)
        }
        continue
      }

      if (wire !== expected) fail(desc.fullName, field.name, `unexpected wire type ${wire}`)
      if (field.oneof) {
        for (const sibling of layout.oneofs.get(field.oneof) ?? []) {
          if (sibling !== field) delete out[sibling.name]
        }
      }
      out[field.name] = readValue(ctx, r, type, field.typeName, depth)
    }
    if (r.pos !== end) fail(desc.fullName, undefined, 'message overruns its length')
  } finally {
    r.end = outerEnd
  }
  return out
}

/** Decode bytes protobuf menjadi objek JS menurut skema `name`. */
export function decodeMessage<T = Record<string, unknown>>(
  registry: ProtoRegistry,
  name: string | MessageDescriptor,
  bytes: Uint8Array,
): T {
  const desc = typeof name === 'string' ? registry.getMessage(name) : name
  const reader = new WireReader(bytes)
  return readMessage({ registry }, reader, desc, bytes.length, 0) as T
}
