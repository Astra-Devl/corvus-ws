import { createHash } from 'node:crypto'
import type { EnumDescriptor, FieldDescriptor, FileDescriptor, MessageDescriptor } from './proto-registry.js'

/** Indeks field untuk satu message, dihitung sekali lalu dipakai ulang oleh encoder/decoder. */
export interface MessageLayout {
  readonly descriptor: MessageDescriptor
  /** Terurut menurut nomor field. */
  readonly fields: readonly FieldDescriptor[]
  readonly byNumber: ReadonlyMap<number, FieldDescriptor>
  readonly byName: ReadonlyMap<string, FieldDescriptor>
  readonly oneofs: ReadonlyMap<string, readonly FieldDescriptor[]>
}

export interface EnumLayout {
  readonly byName: ReadonlyMap<string, number>
  readonly byNumber: ReadonlyMap<number, string>
}

const MAX_PARSED_ENTRIES = 64

/**
 * Cache untuk hasil kerja yang mahal: indeks field per message / enum
 * (dikunci pada objek descriptor) dan hasil parse file `.proto` (dikunci pada hash isi).
 */
export class ProtoCache {
  readonly #layouts = new WeakMap<MessageDescriptor, MessageLayout>()
  readonly #enums = new WeakMap<EnumDescriptor, EnumLayout>()
  readonly #parsed = new Map<string, FileDescriptor>()

  layout(descriptor: MessageDescriptor): MessageLayout {
    let layout = this.#layouts.get(descriptor)
    if (layout) return layout

    const fields = [...descriptor.fields].sort((a, b) => a.number - b.number)
    const byNumber = new Map<number, FieldDescriptor>()
    const byName = new Map<string, FieldDescriptor>()
    const oneofs = new Map<string, FieldDescriptor[]>()
    for (const field of fields) {
      byNumber.set(field.number, field)
      byName.set(field.name, field)
      if (field.oneof) {
        const group = oneofs.get(field.oneof)
        if (group) group.push(field)
        else oneofs.set(field.oneof, [field])
      }
    }
    layout = { descriptor, fields, byNumber, byName, oneofs }
    this.#layouts.set(descriptor, layout)
    return layout
  }

  enumLayout(descriptor: EnumDescriptor): EnumLayout {
    let layout = this.#enums.get(descriptor)
    if (layout) return layout

    const byName = new Map<string, number>()
    const byNumber = new Map<number, string>()
    for (const [name, value] of Object.entries(descriptor.values)) {
      byName.set(name, value)
      // Dengan allow_alias, nama pertama menang.
      if (!byNumber.has(value)) byNumber.set(value, name)
    }
    layout = { byName, byNumber }
    this.#enums.set(descriptor, layout)
    return layout
  }

  /** Ambil hasil parse untuk `source`, atau jalankan `parse` bila belum ada. */
  parsed(name: string, source: string, parse: () => FileDescriptor): FileDescriptor {
    const key = `${name}\0${createHash('sha1').update(source).digest('hex')}`
    const hit = this.#parsed.get(key)
    if (hit) return hit

    const file = parse()
    if (this.#parsed.size >= MAX_PARSED_ENTRIES) {
      const oldest = this.#parsed.keys().next().value
      if (oldest !== undefined) this.#parsed.delete(oldest)
    }
    this.#parsed.set(key, file)
    return file
  }

  clear(): void {
    this.#parsed.clear()
  }
}
