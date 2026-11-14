import { CryptoError } from '../core/errors.js'

/** Penulis protobuf minimal (varint + length-delimited). */
export class ProtoWriter {
  readonly #chunks: Buffer[] = []

  #varint(value: number): void {
    const bytes: number[] = []
    let v = value
    while (v > 0x7f) {
      bytes.push((v & 0x7f) | 0x80)
      v = Math.floor(v / 128)
    }
    bytes.push(v)
    this.#chunks.push(Buffer.from(bytes))
  }

  uint(field: number, value: number): this {
    this.#varint((field << 3) | 0)
    this.#varint(value)
    return this
  }

  bytes(field: number, data: Uint8Array): this {
    this.#varint((field << 3) | 2)
    this.#varint(data.length)
    this.#chunks.push(Buffer.from(data))
    return this
  }

  toBuffer(): Buffer {
    return Buffer.concat(this.#chunks)
  }
}

export type ProtoFields = Map<number, Array<number | Buffer>>

/** Baca pesan protobuf datar (field varint => number, length-delimited => Buffer). */
export function readProto(data: Uint8Array): ProtoFields {
  const buf = Buffer.from(data.buffer, data.byteOffset, data.length)
  const fields: ProtoFields = new Map()
  let pos = 0

  const varint = (): number => {
    let result = 0
    for (let shift = 0; shift < 70; shift += 7) {
      if (pos >= buf.length) throw new CryptoError('Truncated protobuf varint')
      const byte = buf[pos++]!
      result += (byte & 0x7f) * 2 ** shift
      if (!(byte & 0x80)) return result
    }
    throw new CryptoError('Protobuf varint too long')
  }

  while (pos < buf.length) {
    const key = varint()
    const field = Math.floor(key / 8)
    const wire = key & 7
    let value: number | Buffer
    if (wire === 0) value = varint()
    else if (wire === 2) {
      const len = varint()
      if (pos + len > buf.length) throw new CryptoError('Truncated protobuf field')
      value = Buffer.from(buf.subarray(pos, pos + len))
      pos += len
    } else if (wire === 1 || wire === 5) {
      const len = wire === 1 ? 8 : 4
      if (pos + len > buf.length) throw new CryptoError('Truncated protobuf field')
      pos += len
      continue
    } else {
      throw new CryptoError(`Unsupported protobuf wire type ${wire}`)
    }
    const list = fields.get(field)
    if (list) list.push(value)
    else fields.set(field, [value])
  }
  return fields
}

export const protoBytes = (f: ProtoFields, n: number): Buffer | undefined => {
  const v = f.get(n)?.[0]
  return Buffer.isBuffer(v) ? v : undefined
}

export const protoUint = (f: ProtoFields, n: number): number | undefined => {
  const v = f.get(n)?.[0]
  return typeof v === 'number' ? v : undefined
}
