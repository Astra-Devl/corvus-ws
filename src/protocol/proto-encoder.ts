import { encodeMessage, type EncodeOptions } from '../../proto/index.js'
import { protoRegistry, resolveProtoName, type ProtoTypeName, type ProtoTypes } from './proto-registry.js'

export type { EncodeOptions as ProtoEncodeOptions }

/** Encode objek menjadi bytes protobuf. `name` = nama pendek (`Message`) atau nama lengkap skema. */
export function encodeProto<K extends ProtoTypeName>(name: K, value: ProtoTypes[K], options?: EncodeOptions): Uint8Array
export function encodeProto(name: string, value: unknown, options?: EncodeOptions): Uint8Array
export function encodeProto(name: string, value: unknown, options?: EncodeOptions): Uint8Array {
  return encodeMessage(protoRegistry, resolveProtoName(name), value, options)
}
