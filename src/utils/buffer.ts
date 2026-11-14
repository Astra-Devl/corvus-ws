import { timingSafeEqual } from 'node:crypto'

export type BytesLike = Uint8Array | ArrayBuffer | string

export function toBuffer(data: BytesLike): Buffer {
  if (typeof data === 'string') return Buffer.from(data, 'utf8')
  if (data instanceof ArrayBuffer) return Buffer.from(data)
  return Buffer.from(data.buffer, data.byteOffset, data.byteLength)
}

export function concatBytes(...parts: Uint8Array[]): Buffer {
  return Buffer.concat(parts)
}

/** Perbandingan waktu-konstan; `false` bila panjang berbeda. */
export function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && timingSafeEqual(a, b)
}

export const bytesToHex = (data: Uint8Array): string => toBuffer(data).toString('hex')

export function hexToBytes(hex: string): Buffer {
  if (hex.length % 2 !== 0 || /[^0-9a-f]/i.test(hex)) throw new RangeError('Invalid hex string')
  return Buffer.from(hex, 'hex')
}

export const toBase64Url = (data: Uint8Array): string => toBuffer(data).toString('base64url')
export const fromBase64Url = (text: string): Buffer => Buffer.from(text, 'base64url')

/** Integer big-endian tak bertanda dengan panjang tetap. */
export function uintToBytes(value: number, length: number): Buffer {
  if (!Number.isInteger(value) || value < 0 || value >= 2 ** (8 * length)) {
    throw new RangeError(`${value} does not fit in ${length} byte(s)`)
  }
  const out = Buffer.alloc(length)
  out.writeUIntBE(value, 0, length)
  return out
}

export function bytesToUint(data: Uint8Array): number {
  if (data.length === 0 || data.length > 6) throw new RangeError('Length must be 1-6 bytes')
  return toBuffer(data).readUIntBE(0, data.length)
}

export const isUint8Array = (value: unknown): value is Uint8Array => value instanceof Uint8Array
