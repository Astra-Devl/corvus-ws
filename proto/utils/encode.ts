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

export interface EncodeOptions {
  /** Key objek yang tidak ada di skema: `error` (default) atau `ignore`. */
  unknownFields?: 'error' | 'ignore'
  /** Lempar error bila lebih dari satu anggota `oneof` terisi (default: true). */
  strictOneof?: boolean
}

export const MAX_DEPTH = 100
const INT32_MIN = -0x80000000
const INT32_MAX = 0x7fffffff
const UINT64_MAX = (1n << 64n) - 1n
const INT64_MIN = -(1n << 63n)
const INT64_MAX = (1n << 63n) - 1n

/** Penulis wire-format protobuf dengan buffer yang tumbuh sendiri. */
export class WireWriter {
  #buf = new Uint8Array(128)
  #view = new DataView(this.#buf.buffer)
  #len = 0

  get length(): number {
    return this.#len
  }

  #reserve(extra: number): void {
    const needed = this.#len + extra
    if (needed <= this.#buf.length) return
    let size = this.#buf.length * 2
    while (size < needed) size *= 2
    const next = new Uint8Array(size)
    next.set(this.#buf.subarray(0, this.#len))
    this.#buf = next
    this.#view = new DataView(next.buffer)
  }

  /** Varint 0..2^64-1. Bilangan negatif ditulis sebagai 64-bit two's complement. */
  varint(value: number | bigint): void {
    this.#reserve(10)
    if (typeof value === 'number') {
      if (value >= 0 && value <= 0xffffffff) {
        let v = value
        while (v > 0x7f) {
          this.#buf[this.#len++] = (v & 0x7f) | 0x80
          v >>>= 7
        }
        this.#buf[this.#len++] = v
        return
      }
      if (value > 0 && Number.isSafeInteger(value)) {
        let v = value
        while (v > 0x7f) {
          this.#buf[this.#len++] = (v % 128) | 0x80
          v = Math.floor(v / 128)
        }
        this.#buf[this.#len++] = v
        return
      }
      value = BigInt(value)
    }
    let v = BigInt.asUintN(64, value)
    while (v > 0x7fn) {
      this.#buf[this.#len++] = Number(v & 0x7fn) | 0x80
      v >>= 7n
    }
    this.#buf[this.#len++] = Number(v)
  }

  tag(field: number, wire: WireType): void {
    this.varint(field * 8 + wire)
  }

  fixed32(value: number): void {
    this.#reserve(4)
    this.#view.setUint32(this.#len, value >>> 0, true)
    this.#len += 4
  }

  fixed64(value: bigint): void {
    this.#reserve(8)
    this.#view.setBigUint64(this.#len, BigInt.asUintN(64, value), true)
    this.#len += 8
  }

  float(value: number): void {
    this.#reserve(4)
    this.#view.setFloat32(this.#len, value, true)
    this.#len += 4
  }

  double(value: number): void {
    this.#reserve(8)
    this.#view.setFloat64(this.#len, value, true)
    this.#len += 8
  }

  raw(bytes: Uint8Array): void {
    this.#reserve(bytes.length)
    this.#buf.set(bytes, this.#len)
    this.#len += bytes.length
  }

  /** Panjang + isi. */
  bytes(bytes: Uint8Array): void {
    this.varint(bytes.length)
    this.raw(bytes)
  }

  string(text: string): void {
    this.bytes(Buffer.from(text, 'utf8'))
  }

  finish(): Uint8Array {
    return this.#buf.slice(0, this.#len)
  }
}

interface Context {
  readonly registry: ProtoRegistry
  readonly unknown: 'error' | 'ignore'
  readonly strictOneof: boolean
}

function fail(owner: string, field: string | undefined, message: string): never {
  const where = field ? `${owner}.${field}` : owner
  throw new ProtocolError(`${where}: ${message}`, { data: { message: owner, field } })
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && !ArrayBuffer.isView(value)

/** Objek mirip `Long` (`{ low, high, unsigned? }`). */
function fromLong(value: unknown): bigint | undefined {
  if (!isObject(value) || typeof value.low !== 'number' || typeof value.high !== 'number') return undefined
  const combined = (BigInt(value.high >>> 0) << 32n) | BigInt(value.low >>> 0)
  return value.unsigned ? combined : BigInt.asIntN(64, combined)
}

function toBigInt(owner: string, name: string, value: unknown): bigint {
  if (typeof value === 'bigint') return value
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) fail(owner, name, `expected a safe integer, got ${value}`)
    return BigInt(value)
  }
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return BigInt(value)
  const long = fromLong(value)
  if (long !== undefined) return long
  return fail(owner, name, `expected an integer, got ${typeof value}`)
}

function toInt32(owner: string, name: string, value: unknown, min: number, max: number): number {
  let n: number
  if (typeof value === 'number') n = value
  else if (typeof value === 'bigint') n = Number(value)
  else return fail(owner, name, `expected a number, got ${typeof value}`)
  if (!Number.isInteger(n) || n < min || n > max) fail(owner, name, `${String(value)} is out of range`)
  return n
}

function enumNumber(ctx: Context, owner: string, field: FieldDescriptor, value: unknown): number {
  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < INT32_MIN || value > INT32_MAX) fail(owner, field.name, `${value} is not a valid enum value`)
    return value
  }
  if (typeof value === 'string') {
    const layout = ctx.registry.cache.enumLayout(ctx.registry.getEnum(field.typeName ?? ''))
    const number = layout.byName.get(value)
    if (number === undefined) fail(owner, field.name, `unknown enum name "${value}"`)
    return number as number
  }
  return fail(owner, field.name, `expected an enum number or name, got ${typeof value}`)
}

function writeScalarPayload(w: WireWriter, owner: string, name: string, type: ScalarType, value: unknown): void {
  switch (type) {
    case 'int32':
      w.varint(toInt32(owner, name, value, INT32_MIN, INT32_MAX))
      return
    case 'uint32':
      w.varint(toInt32(owner, name, value, 0, 0xffffffff))
      return
    case 'sint32': {
      const n = toInt32(owner, name, value, INT32_MIN, INT32_MAX)
      w.varint(((n << 1) ^ (n >> 31)) >>> 0)
      return
    }
    case 'fixed32':
      w.fixed32(toInt32(owner, name, value, 0, 0xffffffff))
      return
    case 'sfixed32':
      w.fixed32(toInt32(owner, name, value, INT32_MIN, INT32_MAX))
      return
    case 'int64': {
      const n = toBigInt(owner, name, value)
      if (n < INT64_MIN || n > INT64_MAX) fail(owner, name, `${n} is out of range for int64`)
      w.varint(n)
      return
    }
    case 'uint64': {
      const n = toBigInt(owner, name, value)
      if (n < 0n || n > UINT64_MAX) fail(owner, name, `${n} is out of range for uint64`)
      w.varint(n)
      return
    }
    case 'sint64': {
      const n = toBigInt(owner, name, value)
      if (n < INT64_MIN || n > INT64_MAX) fail(owner, name, `${n} is out of range for sint64`)
      w.varint((n << 1n) ^ (n >> 63n))
      return
    }
    case 'fixed64': {
      const n = toBigInt(owner, name, value)
      if (n < 0n || n > UINT64_MAX) fail(owner, name, `${n} is out of range for fixed64`)
      w.fixed64(n)
      return
    }
    case 'sfixed64': {
      const n = toBigInt(owner, name, value)
      if (n < INT64_MIN || n > INT64_MAX) fail(owner, name, `${n} is out of range for sfixed64`)
      w.fixed64(n)
      return
    }
    case 'bool':
      if (typeof value !== 'boolean') fail(owner, name, `expected a boolean, got ${typeof value}`)
      w.varint(value ? 1 : 0)
      return
    case 'float':
      if (typeof value !== 'number') fail(owner, name, `expected a number, got ${typeof value}`)
      w.float(value)
      return
    case 'double':
      if (typeof value !== 'number') fail(owner, name, `expected a number, got ${typeof value}`)
      w.double(value)
      return
    case 'string':
      if (typeof value !== 'string') fail(owner, name, `expected a string, got ${typeof value}`)
      w.string(value)
      return
    case 'bytes':
      if (!(value instanceof Uint8Array)) fail(owner, name, `expected a Uint8Array, got ${typeof value}`)
      w.bytes(value)
      return
  }
}

function writePayload(
  ctx: Context,
  w: WireWriter,
  owner: string,
  field: FieldDescriptor,
  type: FieldType,
  typeName: string | undefined,
  value: unknown,
  depth: number,
): void {
  if (type === 'message') {
    const sub = new WireWriter()
    writeMessage(ctx, sub, ctx.registry.getMessage(typeName ?? ''), value, depth + 1)
    w.bytes(sub.finish())
  } else if (type === 'enum') {
    w.varint(enumNumber(ctx, owner, { ...field, typeName }, value))
  } else {
    writeScalarPayload(w, owner, field.name, type, value)
  }
}

function coerceMapKey(owner: string, name: string, type: ScalarType, raw: unknown): unknown {
  if (type === 'string') return raw
  if (type === 'bool') return typeof raw === 'string' ? raw === 'true' : raw
  if (typeof raw !== 'string') return raw
  if (type === 'int64' || type === 'uint64' || type === 'sint64' || type === 'fixed64' || type === 'sfixed64') {
    if (!/^-?\d+$/.test(raw)) fail(owner, name, `invalid map key "${raw}"`)
    return BigInt(raw)
  }
  const n = Number(raw)
  if (!Number.isInteger(n)) fail(owner, name, `invalid map key "${raw}"`)
  return n
}

function writeMap(ctx: Context, w: WireWriter, owner: string, field: FieldDescriptor, value: unknown, depth: number): void {
  const map = field.map!
  let entries: Array<[unknown, unknown]>
  if (value instanceof Map) entries = [...value.entries()]
  else if (isObject(value)) entries = Object.entries(value)
  else return fail(owner, field.name, `expected a map or object, got ${typeof value}`)

  const keyField: FieldDescriptor = { name: `${field.name}.key`, number: 1, type: map.key, label: 'optional', packed: false }
  const valueType = map.value as FieldType
  const valueField: FieldDescriptor = {
    name: `${field.name}.value`,
    number: 2,
    type: valueType,
    label: 'optional',
    packed: false,
    ...(map.valueTypeName && { typeName: map.valueTypeName }),
  }

  for (const [rawKey, entryValue] of entries) {
    if (entryValue === undefined || entryValue === null) continue
    const entry = new WireWriter()
    entry.tag(1, wireTypeOf(map.key))
    writePayload(ctx, entry, owner, keyField, map.key, undefined, coerceMapKey(owner, field.name, map.key, rawKey), depth)
    entry.tag(2, wireTypeOf(valueType))
    writePayload(ctx, entry, owner, valueField, valueType, map.valueTypeName, entryValue, depth)
    w.tag(field.number, WireType.LEN)
    w.bytes(entry.finish())
  }
}

function writeMessage(ctx: Context, w: WireWriter, desc: MessageDescriptor, value: unknown, depth: number): void {
  if (depth > MAX_DEPTH) fail(desc.fullName, undefined, 'message nesting is too deep')
  if (!isObject(value)) fail(desc.fullName, undefined, `expected an object, got ${value === null ? 'null' : typeof value}`)

  const layout = ctx.registry.cache.layout(desc)
  if (ctx.unknown === 'error') {
    for (const key of Object.keys(value)) {
      if (!layout.byName.has(key) && value[key] !== undefined && value[key] !== null) {
        fail(desc.fullName, key, 'unknown field')
      }
    }
  }

  let activeOneofs: Map<string, string> | undefined
  for (const field of layout.fields) {
    const v = value[field.name]
    if (v === undefined || v === null) {
      if (field.label === 'required') fail(desc.fullName, field.name, 'required field is missing')
      continue
    }

    if (field.oneof && ctx.strictOneof) {
      activeOneofs ??= new Map()
      const other = activeOneofs.get(field.oneof)
      if (other !== undefined) fail(desc.fullName, field.name, `oneof "${field.oneof}" already set by "${other}"`)
      activeOneofs.set(field.oneof, field.name)
    }

    if (field.map) {
      writeMap(ctx, w, desc.fullName, field, v, depth)
    } else if (field.label === 'repeated') {
      if (!Array.isArray(v)) fail(desc.fullName, field.name, `expected an array, got ${typeof v}`)
      const items = v.filter((item) => item !== undefined && item !== null)
      if (items.length === 0) continue
      const type = field.type as FieldType
      if (field.packed) {
        const packed = new WireWriter()
        for (const item of items) writePayload(ctx, packed, desc.fullName, field, type, field.typeName, item, depth)
        w.tag(field.number, WireType.LEN)
        w.bytes(packed.finish())
      } else {
        for (const item of items) {
          w.tag(field.number, wireTypeOf(type))
          writePayload(ctx, w, desc.fullName, field, type, field.typeName, item, depth)
        }
      }
    } else {
      const type = field.type as FieldType
      w.tag(field.number, wireTypeOf(type))
      writePayload(ctx, w, desc.fullName, field, type, field.typeName, v, depth)
    }
  }
}

/** Encode objek JS menjadi bytes protobuf menurut skema `name`. */
export function encodeMessage(
  registry: ProtoRegistry,
  name: string | MessageDescriptor,
  value: unknown,
  options: EncodeOptions = {},
): Uint8Array {
  const desc = typeof name === 'string' ? registry.getMessage(name) : name
  const ctx: Context = {
    registry,
    unknown: options.unknownFields ?? 'error',
    strictOneof: options.strictOneof ?? true,
  }
  const w = new WireWriter()
  writeMessage(ctx, w, desc, value, 0)
  return w.finish()
}
