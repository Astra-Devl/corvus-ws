import type { MessageCodec } from '../messages/message-parser.js'
import type { MessageContent } from '../messages/message-utils.js'
import { decodeProto } from './proto-decoder.js'
import { encodeProto, type ProtoEncodeOptions } from './proto-encoder.js'

export type ProtoMessageCodecOptions = ProtoEncodeOptions

/**
 * `MessageCodec` berbasis skema protobuf `Message`: konten (JSON bergaya WAProto)
 * <-> bytes yang dienkripsi dan dikirim sebagai isi pesan.
 * Field di luar skema ditolak saat encode (ubah lewat `unknownFields: 'ignore'`).
 */
export function createProtoMessageCodec(options: ProtoMessageCodecOptions = {}): MessageCodec {
  return {
    encode: (content: MessageContent) => encodeProto('Message', content as never, options),
    decode: (bytes: Uint8Array) => decodeProto('Message', bytes) as MessageContent,
  }
}
