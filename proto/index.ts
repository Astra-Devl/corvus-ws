import { descriptors, PROTO_NAMES, type ProtoTypeName, type ProtoTypes } from './generated/index.js'
import { ProtoRegistry, type FileDescriptor } from './loader/proto-registry.js'
import { decodeMessage } from './utils/decode.js'
import { deserialize } from './utils/deserialize.js'
import { encodeMessage, type EncodeOptions } from './utils/encode.js'
import { serialize, toJSON, type JsonValue } from './utils/serialize.js'
import { fromJSON } from './utils/deserialize.js'

export * from './generated/index.js'
export * from './loader/proto-cache.js'
export * from './loader/proto-loader.js'
export * from './loader/proto-registry.js'
export * from './utils/decode.js'
export * from './utils/deserialize.js'
export * from './utils/encode.js'
export * from './utils/serialize.js'

/** Registry baru berisi semua skema bawaan (plus `extra` bila ada). */
export function createRegistry(extra: readonly FileDescriptor[] = []): ProtoRegistry {
  const registry = new ProtoRegistry()
  for (const file of descriptors) registry.add(file)
  for (const file of extra) registry.add(file)
  return registry.link()
}

/** Registry bawaan yang dipakai fungsi `encode` / `decode` / `proto` di bawah. */
export const registry: ProtoRegistry = createRegistry()

export function encode<K extends ProtoTypeName>(name: K, value: ProtoTypes[K], options?: EncodeOptions): Uint8Array {
  return encodeMessage(registry, PROTO_NAMES[name], value, options)
}

export function decode<K extends ProtoTypeName>(name: K, bytes: Uint8Array): ProtoTypes[K] {
  return decodeMessage<ProtoTypes[K]>(registry, PROTO_NAMES[name], bytes)
}

/** Akses per-tipe, mis. `proto.Message.encode({ conversation: 'hi' })`. */
export interface ProtoType<T> {
  readonly name: string
  readonly fullName: string
  encode(value: T, options?: EncodeOptions): Uint8Array
  decode(bytes: Uint8Array): T
  toJSON(value: T): JsonValue
  fromJSON(json: unknown): T
  serialize(value: T, space?: number): string
  deserialize(text: string): T
}

export type ProtoNamespace = { readonly [K in ProtoTypeName]: ProtoType<ProtoTypes[K]> }

export function createNamespace(target: ProtoRegistry = registry): ProtoNamespace {
  const namespace: Record<string, ProtoType<unknown>> = {}
  for (const [name, fullName] of Object.entries(PROTO_NAMES)) {
    namespace[name] = {
      name,
      fullName,
      encode: (value, options) => encodeMessage(target, fullName, value, options),
      decode: (bytes) => decodeMessage(target, fullName, bytes),
      toJSON: (value) => toJSON(target, fullName, value),
      fromJSON: (json) => fromJSON(target, fullName, json),
      serialize: (value, space) => serialize(target, fullName, value, space),
      deserialize: (text) => deserialize(target, fullName, text),
    }
  }
  return Object.freeze(namespace) as unknown as ProtoNamespace
}

export const proto: ProtoNamespace = createNamespace()
