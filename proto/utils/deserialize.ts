import { ProtocolError } from '../../src/core/errors.js'
import type { FieldDescriptor, FieldType, MessageDescriptor, ProtoRegistry } from '../loader/proto-registry.js'
import type { Int64 } from './decode.js'
import { MAX_DEPTH } from './encode.js'

const normalize64 = (v: bigint): Int64 =>
  v >= BigInt(Number.MIN_SAFE_INTEGER) && v <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(v) : v

function fail(owner: string, field: string, message: string): never {
  throw new ProtocolError(`${owner}.${field}: ${message}`, { data: { message: owner, field } })
}

function scalarFromJson(registry: ProtoRegistry, owner: string, field: FieldDescriptor, type: FieldType, typeName: string | undefined, v: unknown): unknown {
  switch (type) {
    case 'int64':
    case 'uint64':
    case 'sint64':
    case 'fixed64':
    case 'sfixed64': {
      if (typeof v === 'number' && Number.isSafeInteger(v)) return v
      if (typeof v === 'string' && /^-?\d+$/.test(v)) return normalize64(BigInt(v))
      return fail(owner, field.name, 'expected an integer or integer string')
    }
    case 'int32':
    case 'uint32':
    case 'sint32':
    case 'fixed32':
    case 'sfixed32': {
      const n = typeof v === 'string' ? Number(v) : v
      if (typeof n !== 'number' || !Number.isInteger(n)) fail(owner, field.name, 'expected an integer')
      return n
    }
    case 'float':
    case 'double': {
      if (typeof v === 'number') return v
      if (v === 'NaN' || v === 'Infinity' || v === '-Infinity') return Number(v)
      if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v)
      return fail(owner, field.name, 'expected a number')
    }
    case 'bool':
      if (typeof v !== 'boolean') fail(owner, field.name, 'expected a boolean')
      return v
    case 'string':
      if (typeof v !== 'string') fail(owner, field.name, 'expected a string')
      return v
    case 'bytes':
      if (typeof v !== 'string') fail(owner, field.name, 'expected a base64 string')
      return Buffer.from(v.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
    case 'enum': {
      if (typeof v === 'number') return v
      if (typeof v === 'string') {
        const n = registry.cache.enumLayout(registry.getEnum(typeName ?? '')).byName.get(v)
        if (n === undefined) fail(owner, field.name, `unknown enum name "${v}"`)
        return n
      }
      return fail(owner, field.name, 'expected an enum name or number')
    }
    default:
      return fail(owner, field.name, `unsupported type ${type}`)
  }
}

function messageFromJson(registry: ProtoRegistry, desc: MessageDescriptor, json: unknown, depth: number): Record<string, unknown> {
  if (depth > MAX_DEPTH) throw new ProtocolError(`${desc.fullName}: message nesting is too deep`)
  if (typeof json !== 'object' || json === null || Array.isArray(json)) {
    throw new ProtocolError(`${desc.fullName}: expected a JSON object`, { data: { message: desc.fullName } })
  }
  const source = json as Record<string, unknown>
  const out: Record<string, unknown> = {}

  for (const field of registry.cache.layout(desc).fields) {
    const v = source[field.name]
    if (v === undefined || v === null) continue

    const convert = (type: FieldType, typeName: string | undefined, item: unknown): unknown =>
      type === 'message'
        ? messageFromJson(registry, registry.getMessage(typeName ?? ''), item, depth + 1)
        : scalarFromJson(registry, desc.fullName, field, type, typeName, item)

    if (field.map) {
      if (typeof v !== 'object' || Array.isArray(v)) fail(desc.fullName, field.name, 'expected a JSON object')
      const bucket: Record<string, unknown> = {}
      for (const [k, item] of Object.entries(v)) bucket[k] = convert(field.map.value as FieldType, field.map.valueTypeName, item)
      out[field.name] = bucket
    } else if (field.label === 'repeated') {
      if (!Array.isArray(v)) fail(desc.fullName, field.name, 'expected a JSON array')
      out[field.name] = v.map((item) => convert(field.type as FieldType, field.typeName, item))
    } else {
      out[field.name] = convert(field.type as FieldType, field.typeName, v)
    }
  }
  return out
}

/** Struktur JSON (hasil `toJSON`) -> objek JS siap di-encode. */
export function fromJSON<T = Record<string, unknown>>(registry: ProtoRegistry, name: string | MessageDescriptor, json: unknown): T {
  const desc = typeof name === 'string' ? registry.getMessage(name) : name
  return messageFromJson(registry, desc, json, 0) as T
}

/** Teks JSON -> objek JS. */
export function deserialize<T = Record<string, unknown>>(registry: ProtoRegistry, name: string | MessageDescriptor, text: string): T {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch (cause) {
    throw new ProtocolError('Invalid JSON text', { cause })
  }
  return fromJSON<T>(registry, name, json)
}
