import { ProtocolError } from '../../src/core/errors.js'
import type { FieldDescriptor, FieldType, MessageDescriptor, ProtoRegistry } from '../loader/proto-registry.js'
import { MAX_DEPTH } from './encode.js'

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }

function scalarToJson(registry: ProtoRegistry, type: FieldType, typeName: string | undefined, value: unknown): JsonValue {
  switch (type) {
    case 'int64':
    case 'uint64':
    case 'sint64':
    case 'fixed64':
    case 'sfixed64':
      return String(value)
    case 'bytes':
      return Buffer.from(value as Uint8Array).toString('base64')
    case 'float':
    case 'double': {
      const n = value as number
      return Number.isFinite(n) ? n : String(n)
    }
    case 'enum': {
      const layout = registry.cache.enumLayout(registry.getEnum(typeName ?? ''))
      return layout.byNumber.get(value as number) ?? (value as number)
    }
    default:
      return value as JsonValue
  }
}

function messageToJson(registry: ProtoRegistry, desc: MessageDescriptor, value: unknown, depth: number): JsonValue {
  if (depth > MAX_DEPTH) throw new ProtocolError(`${desc.fullName}: message nesting is too deep`)
  if (typeof value !== 'object' || value === null) {
    throw new ProtocolError(`${desc.fullName}: expected an object`, { data: { message: desc.fullName } })
  }
  const source = value as Record<string, unknown>
  const out: { [key: string]: JsonValue } = {}

  const convert = (type: FieldType, typeName: string | undefined, v: unknown): JsonValue =>
    type === 'message'
      ? messageToJson(registry, registry.getMessage(typeName ?? ''), v, depth + 1)
      : scalarToJson(registry, type, typeName, v)

  for (const field of registry.cache.layout(desc).fields) {
    const v = source[field.name]
    if (v === undefined || v === null) continue
    out[field.name] = fieldToJson(field, v, convert)
  }
  return out
}

function fieldToJson(
  field: FieldDescriptor,
  value: unknown,
  convert: (type: FieldType, typeName: string | undefined, v: unknown) => JsonValue,
): JsonValue {
  if (field.map) {
    const entries = value instanceof Map ? [...value.entries()] : Object.entries(value as object)
    const result: { [key: string]: JsonValue } = {}
    for (const [k, v] of entries) result[String(k)] = convert(field.map.value as FieldType, field.map.valueTypeName, v)
    return result
  }
  const type = field.type as FieldType
  if (field.label === 'repeated') return (value as unknown[]).map((item) => convert(type, field.typeName, item))
  return convert(type, field.typeName, value)
}

/** Objek JS -> struktur JSON (int64 sebagai string, bytes sebagai base64, enum sebagai nama). */
export function toJSON(registry: ProtoRegistry, name: string | MessageDescriptor, value: unknown): JsonValue {
  const desc = typeof name === 'string' ? registry.getMessage(name) : name
  return messageToJson(registry, desc, value, 0)
}

/** Objek JS -> teks JSON. */
export function serialize(registry: ProtoRegistry, name: string | MessageDescriptor, value: unknown, space?: number): string {
  return JSON.stringify(toJSON(registry, name, value), null, space)
}
