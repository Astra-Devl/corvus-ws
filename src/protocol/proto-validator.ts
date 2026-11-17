import { ValidationError } from '../core/errors.js'
import type { FieldType, MessageDescriptor, ScalarType } from '../../proto/index.js'
import { protoRegistry, resolveProtoName } from './proto-registry.js'

export type ProtoIssueCode = 'type' | 'range' | 'unknown' | 'required' | 'oneof' | 'enum'

export interface ProtoIssue {
  /** Mis. `ExtendedTextMessage.contextInfo.mentionedJid[1]`. */
  path: string
  code: ProtoIssueCode
  message: string
}

const MAX_DEPTH = 100
const I32 = [-0x80000000, 0x7fffffff] as const
const U32 = [0, 0xffffffff] as const
const I64 = [-(1n << 63n), (1n << 63n) - 1n] as const
const U64 = [0n, (1n << 64n) - 1n] as const

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && !ArrayBuffer.isView(v)

const isLong = (v: unknown): boolean => isObject(v) && typeof v.low === 'number' && typeof v.high === 'number'

function checkInt32(v: unknown, [min, max]: readonly [number, number]): { code: ProtoIssueCode; message: string } | undefined {
  if (typeof v !== 'number' && typeof v !== 'bigint') return { code: 'type', message: `expected a number, got ${typeof v}` }
  const n = Number(v)
  return Number.isInteger(n) && n >= min && n <= max ? undefined : { code: 'range', message: `${String(v)} is out of range` }
}

function checkInt64(v: unknown, [min, max]: readonly [bigint, bigint]): { code: ProtoIssueCode; message: string } | undefined {
  let n: bigint
  if (typeof v === 'bigint') n = v
  else if (typeof v === 'number') {
    if (!Number.isSafeInteger(v)) return { code: 'range', message: `${v} is not a safe integer` }
    n = BigInt(v)
  } else if (typeof v === 'string' && /^-?\d+$/.test(v)) n = BigInt(v)
  else if (isLong(v)) return undefined
  else return { code: 'type', message: `expected an integer, got ${typeof v}` }
  return n >= min && n <= max ? undefined : { code: 'range', message: `${n} is out of range` }
}

function checkScalar(type: ScalarType, v: unknown): { code: ProtoIssueCode; message: string } | undefined {
  switch (type) {
    case 'int32':
    case 'sint32':
    case 'sfixed32':
      return checkInt32(v, I32)
    case 'uint32':
    case 'fixed32':
      return checkInt32(v, U32)
    case 'int64':
    case 'sint64':
    case 'sfixed64':
      return checkInt64(v, I64)
    case 'uint64':
    case 'fixed64':
      return checkInt64(v, U64)
    case 'bool':
      return typeof v === 'boolean' ? undefined : { code: 'type', message: `expected a boolean, got ${typeof v}` }
    case 'string':
      return typeof v === 'string' ? undefined : { code: 'type', message: `expected a string, got ${typeof v}` }
    case 'bytes':
      return v instanceof Uint8Array ? undefined : { code: 'type', message: `expected a Uint8Array, got ${typeof v}` }
    case 'float':
    case 'double':
      return typeof v === 'number' ? undefined : { code: 'type', message: `expected a number, got ${typeof v}` }
  }
}

function validate(desc: MessageDescriptor, value: unknown, path: string, issues: ProtoIssue[], depth: number): void {
  if (!isObject(value)) {
    issues.push({ path, code: 'type', message: `expected an object, got ${value === null ? 'null' : typeof value}` })
    return
  }
  if (depth > MAX_DEPTH) {
    issues.push({ path, code: 'range', message: 'message nesting is too deep' })
    return
  }

  const layout = protoRegistry.cache.layout(desc)
  for (const key of Object.keys(value)) {
    if (!layout.byName.has(key) && value[key] !== undefined && value[key] !== null) {
      issues.push({ path: `${path}.${key}`, code: 'unknown', message: 'unknown field' })
    }
  }

  const setInOneof = new Map<string, string[]>()
  for (const field of layout.fields) {
    const v = value[field.name]
    const here = `${path}.${field.name}`
    if (v === undefined || v === null) {
      if (field.label === 'required') issues.push({ path: here, code: 'required', message: 'required field is missing' })
      continue
    }
    if (field.oneof) setInOneof.set(field.oneof, [...(setInOneof.get(field.oneof) ?? []), field.name])

    if (field.map) {
      const entries = v instanceof Map ? [...v.entries()] : isObject(v) ? Object.entries(v) : undefined
      if (!entries) {
        issues.push({ path: here, code: 'type', message: `expected a map or object, got ${typeof v}` })
        continue
      }
      for (const [k, item] of entries) checkValue(field.map.value, field.map.valueTypeName, item, `${here}[${String(k)}]`, issues, depth)
    } else if (field.label === 'repeated') {
      if (!Array.isArray(v)) {
        issues.push({ path: here, code: 'type', message: `expected an array, got ${typeof v}` })
        continue
      }
      v.forEach((item, i) => {
        if (item !== undefined && item !== null) checkValue(field.type as FieldType, field.typeName, item, `${here}[${i}]`, issues, depth)
      })
    } else {
      checkValue(field.type as FieldType, field.typeName, v, here, issues, depth)
    }
  }

  for (const [group, names] of setInOneof) {
    if (names.length > 1) {
      issues.push({ path: `${path}.${group}`, code: 'oneof', message: `oneof "${group}" has several members set: ${names.join(', ')}` })
    }
  }
}

function checkValue(
  type: FieldType | 'unresolved',
  typeName: string | undefined,
  value: unknown,
  path: string,
  issues: ProtoIssue[],
  depth: number,
): void {
  if (type === 'message') {
    validate(protoRegistry.getMessage(typeName ?? ''), value, path, issues, depth + 1)
  } else if (type === 'enum') {
    if (typeof value === 'number') {
      if (!Number.isInteger(value)) issues.push({ path, code: 'enum', message: `${value} is not a valid enum value` })
    } else if (typeof value === 'string') {
      if (!protoRegistry.cache.enumLayout(protoRegistry.getEnum(typeName ?? '')).byName.has(value)) {
        issues.push({ path, code: 'enum', message: `unknown enum name "${value}"` })
      }
    } else {
      issues.push({ path, code: 'type', message: `expected an enum number or name, got ${typeof value}` })
    }
  } else if (type !== 'unresolved') {
    const problem = checkScalar(type, value)
    if (problem) issues.push({ path, ...problem })
  }
}

/** Periksa objek terhadap skema tanpa meng-encode. Mengembalikan semua masalah yang ditemukan. */
export function validateProto(name: string, value: unknown): ProtoIssue[] {
  const desc = protoRegistry.getMessage(resolveProtoName(name))
  const issues: ProtoIssue[] = []
  validate(desc, value, name, issues, 0)
  return issues
}

export function isValidProto(name: string, value: unknown): boolean {
  return validateProto(name, value).length === 0
}

export function assertValidProto(name: string, value: unknown): void {
  const issues = validateProto(name, value)
  if (issues.length === 0) return
  const summary = issues.slice(0, 5).map((i) => `${i.path}: ${i.message}`).join('; ')
  throw new ValidationError(`Invalid ${name}: ${summary}${issues.length > 5 ? ` (+${issues.length - 5} more)` : ''}`, {
    data: { issues },
  })
}

