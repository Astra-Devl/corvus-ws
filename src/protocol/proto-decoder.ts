import { decodeMessage } from '../../proto/index.js'
import { protoRegistry, resolveProtoName, type ProtoTypeName, type ProtoTypes } from './proto-registry.js'

/** Decode bytes protobuf menjadi objek. Melempar `ProtocolError` bila data rusak. */
export function decodeProto<K extends ProtoTypeName>(name: K, bytes: Uint8Array): ProtoTypes[K]
export function decodeProto(name: string, bytes: Uint8Array): unknown
export function decodeProto(name: string, bytes: Uint8Array): unknown {
  return decodeMessage(protoRegistry, resolveProtoName(name), bytes)
}

/** Seperti `decodeProto`, tetapi mengembalikan `undefined` bila data rusak. */
export function tryDecodeProto<K extends ProtoTypeName>(name: K, bytes: Uint8Array): ProtoTypes[K] | undefined
export function tryDecodeProto(name: string, bytes: Uint8Array): unknown
export function tryDecodeProto(name: string, bytes: Uint8Array): unknown {
  try {
    return decodeProto(name, bytes)
  } catch {
    return undefined
  }
}
