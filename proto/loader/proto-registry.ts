import { ProtocolError } from '../../src/core/errors.js'
import { ProtoCache } from './proto-cache.js'

export const SCALAR_TYPES = [
  'double',
  'float',
  'int32',
  'int64',
  'uint32',
  'uint64',
  'sint32',
  'sint64',
  'fixed32',
  'fixed64',
  'sfixed32',
  'sfixed64',
  'bool',
  'string',
  'bytes',
] as const

export type ScalarType = (typeof SCALAR_TYPES)[number]
export type FieldType = ScalarType | 'message' | 'enum'
/** `unresolved` hanya muncul sesaat setelah parsing, sebelum `registry.link()`. */
export type RawFieldType = FieldType | 'unresolved'

const SCALAR_SET: ReadonlySet<string> = new Set(SCALAR_TYPES)
export const isScalarType = (type: string): type is ScalarType => SCALAR_SET.has(type)

export const WireType = { VARINT: 0, FIXED64: 1, LEN: 2, START_GROUP: 3, END_GROUP: 4, FIXED32: 5 } as const
export type WireType = (typeof WireType)[keyof typeof WireType]

const PACKABLE: ReadonlySet<string> = new Set([
  'double',
  'float',
  'int32',
  'int64',
  'uint32',
  'uint64',
  'sint32',
  'sint64',
  'fixed32',
  'fixed64',
  'sfixed32',
  'sfixed64',
  'bool',
  'enum',
])

export const isPackableType = (type: RawFieldType): boolean => PACKABLE.has(type)
export const is64BitType = (type: RawFieldType): boolean =>
  type === 'int64' || type === 'uint64' || type === 'sint64' || type === 'fixed64' || type === 'sfixed64'

export function wireTypeOf(type: FieldType): WireType {
  switch (type) {
    case 'double':
    case 'fixed64':
    case 'sfixed64':
      return WireType.FIXED64
    case 'float':
    case 'fixed32':
    case 'sfixed32':
      return WireType.FIXED32
    case 'string':
    case 'bytes':
    case 'message':
      return WireType.LEN
    default:
      return WireType.VARINT
  }
}

export interface MapInfo {
  key: ScalarType
  value: RawFieldType
  /** Nama tipe value (message/enum). Berisi nama mentah sebelum link, nama lengkap sesudahnya. */
  valueTypeName?: string
}

export interface FieldDescriptor {
  name: string
  number: number
  type: RawFieldType
  /** Nama tipe (message/enum). Berisi nama mentah sebelum link, nama lengkap sesudahnya. */
  typeName?: string
  label: 'optional' | 'required' | 'repeated'
  packed: boolean
  oneof?: string
  map?: MapInfo
}

export interface MessageDescriptor {
  /** Nama lengkap, mis. `corvus.ClientPayload.UserAgent`. */
  fullName: string
  name: string
  fields: FieldDescriptor[]
  oneofs: string[]
}

export interface EnumDescriptor {
  fullName: string
  name: string
  values: Record<string, number>
}

export interface FileDescriptor {
  name: string
  package: string
  syntax: 'proto2' | 'proto3'
  imports: string[]
  messages: MessageDescriptor[]
  enums: EnumDescriptor[]
}

const normalize = (name: string): string => (name.startsWith('.') ? name.slice(1) : name)

/**
 * Kumpulan file `.proto` yang sudah di-parse. Semua file berbagi satu namespace global,
 * sehingga referensi antar-file di-resolve lewat nama lengkap.
 */
export class ProtoRegistry {
  readonly cache = new ProtoCache()
  readonly #files = new Map<string, FileDescriptor>()
  readonly #messages = new Map<string, MessageDescriptor>()
  readonly #enums = new Map<string, EnumDescriptor>()
  #dirty = false

  /** Daftarkan file. File dengan nama yang sama menggantikan versi sebelumnya. */
  add(file: FileDescriptor): this {
    const previous = this.#files.get(file.name)
    if (previous) this.#remove(previous)

    for (const message of file.messages) this.#define(this.#messages, message.fullName, message, file.name)
    for (const en of file.enums) this.#define(this.#enums, en.fullName, en, file.name)
    this.#files.set(file.name, file)
    this.#dirty = true
    return this
  }

  #define<T>(table: Map<string, T>, fullName: string, value: T, fileName: string): void {
    if (table.has(fullName) || this.#messages.has(fullName) || this.#enums.has(fullName)) {
      // Nama bentrok dengan file lain (nama yang sama dari file ini sendiri sudah dihapus lebih dulu).
      throw new ProtocolError(`Duplicate definition of "${fullName}" (in ${fileName})`, {
        data: { fullName, file: fileName },
      })
    }
    table.set(fullName, value)
  }

  #remove(file: FileDescriptor): void {
    for (const message of file.messages) this.#messages.delete(message.fullName)
    for (const en of file.enums) this.#enums.delete(en.fullName)
    this.#files.delete(file.name)
  }

  /** Resolve semua referensi tipe yang belum terselesaikan. Idempoten. */
  link(): this {
    if (!this.#dirty) return this
    for (const message of this.#messages.values()) {
      for (const field of message.fields) {
        if (field.type === 'unresolved') {
          this.#resolveRef(message, field, field.typeName ?? '', (type, fullName) => {
            field.type = type
            field.typeName = fullName
          })
        }
        const map = field.map
        if (map?.value === 'unresolved') {
          this.#resolveRef(message, field, map.valueTypeName ?? '', (type, fullName) => {
            map.value = type
            map.valueTypeName = fullName
          })
        }
        if (field.packed && !field.map && !isPackableType(field.type)) field.packed = false
      }
    }
    this.#dirty = false
    return this
  }

  #resolveRef(
    scope: MessageDescriptor,
    field: FieldDescriptor,
    ref: string,
    assign: (type: 'message' | 'enum', fullName: string) => void,
  ): void {
    const hit = this.#lookupRef(scope.fullName, ref)
    if (!hit) {
      throw new ProtocolError(`Unresolved type "${ref}" for ${scope.fullName}.${field.name}`, {
        data: { message: scope.fullName, field: field.name, type: ref },
      })
    }
    assign(hit.type, hit.fullName)
  }

  #lookupRef(scope: string, ref: string): { type: 'message' | 'enum'; fullName: string } | undefined {
    const find = (candidate: string) => {
      if (this.#messages.has(candidate)) return { type: 'message' as const, fullName: candidate }
      if (this.#enums.has(candidate)) return { type: 'enum' as const, fullName: candidate }
      return undefined
    }
    if (ref.startsWith('.')) return find(ref.slice(1))
    const parts = scope.split('.')
    for (let i = parts.length; i >= 0; i--) {
      const hit = find([...parts.slice(0, i), ref].join('.'))
      if (hit) return hit
    }
    return undefined
  }

  hasMessage(name: string): boolean {
    return this.#find(this.#messages, name) !== undefined
  }

  hasEnum(name: string): boolean {
    return this.#find(this.#enums, name) !== undefined
  }

  getMessage(name: string): MessageDescriptor {
    this.link()
    const found = this.#find(this.#messages, name)
    if (!found) throw new ProtocolError(`Unknown message type "${name}"`, { data: { name } })
    return found
  }

  getEnum(name: string): EnumDescriptor {
    this.link()
    const found = this.#find(this.#enums, name)
    if (!found) throw new ProtocolError(`Unknown enum type "${name}"`, { data: { name } })
    return found
  }

  /** Cari berdasarkan nama lengkap, atau sufiks unik (mis. `ClientPayload.UserAgent`). */
  #find<T>(table: Map<string, T>, name: string): T | undefined {
    const key = normalize(name)
    const exact = table.get(key)
    if (exact) return exact
    const suffix = `.${key}`
    let match: T | undefined
    for (const [fullName, value] of table) {
      if (!fullName.endsWith(suffix)) continue
      if (match !== undefined) {
        throw new ProtocolError(`Ambiguous type name "${name}"`, { data: { name } })
      }
      match = value
    }
    return match
  }

  getFile(name: string): FileDescriptor | undefined {
    return this.#files.get(name)
  }

  files(): FileDescriptor[] {
    return [...this.#files.values()]
  }

  messageNames(): string[] {
    return [...this.#messages.keys()]
  }

  enumNames(): string[] {
    return [...this.#enums.keys()]
  }
}
