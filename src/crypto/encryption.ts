import {
  createCipheriv,
  createHash,
  createHmac,
  hkdfSync,
  randomBytes,
} from 'node:crypto'

export { randomBytes }

export const sha256 = (...parts: Uint8Array[]): Buffer => {
  const h = createHash('sha256')
  for (const part of parts) h.update(part)
  return h.digest()
}

export const hmacSha256 = (key: Uint8Array, ...parts: Uint8Array[]): Buffer => {
  const h = createHmac('sha256', key)
  for (const part of parts) h.update(part)
  return h.digest()
}

export interface HkdfOptions {
  salt?: Uint8Array
  info?: Uint8Array | string
}

/** HKDF-SHA256 (RFC 5869). Salt kosong = nol sepanjang hash. */
export function hkdf(ikm: Uint8Array, length: number, options: HkdfOptions = {}): Buffer {
  const info = typeof options.info === 'string' ? Buffer.from(options.info) : (options.info ?? Buffer.alloc(0))
  return Buffer.from(hkdfSync('sha256', ikm, options.salt ?? Buffer.alloc(0), info, length))
}

/** AES-256-GCM; hasil = ciphertext || tag(16). */
export function aesEncryptGCM(
  plaintext: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array,
  aad: Uint8Array = Buffer.alloc(0),
): Buffer {
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(aad)
  return Buffer.concat([cipher.update(plaintext), cipher.final(), cipher.getAuthTag()])
}

/** AES-256-CBC (PKCS#7). */
export function aesEncryptCBC(plaintext: Uint8Array, key: Uint8Array, iv: Uint8Array): Buffer {
  const cipher = createCipheriv('aes-256-cbc', key, iv)
  return Buffer.concat([cipher.update(plaintext), cipher.final()])
}

/** AES-256-CBC dengan IV acak di awal hasil. */
export function aesEncryptCBCWithIV(plaintext: Uint8Array, key: Uint8Array): Buffer {
  const iv = randomBytes(16)
  return Buffer.concat([iv, aesEncryptCBC(plaintext, key, iv)])
}

export function aesEncryptCTR(plaintext: Uint8Array, key: Uint8Array, iv: Uint8Array): Buffer {
  const cipher = createCipheriv('aes-256-ctr', key, iv)
  return Buffer.concat([cipher.update(plaintext), cipher.final()])
}

/** Padding acak 1-15 byte (nilai tiap byte = panjang padding). */
export function padRandomMax16(message: Uint8Array): Buffer {
  let length = randomBytes(1)[0]! & 0x0f
  if (length === 0) length = 0x0f
  return Buffer.concat([message, Buffer.alloc(length, length)])
}

/** IV GCM 12 byte: counter big-endian di 4 byte terakhir. */
export function counterIV(counter: number): Buffer {
  const iv = Buffer.alloc(12)
  iv.writeUInt32BE(counter >>> 0, 8)
  return iv
}
