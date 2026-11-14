import { createDecipheriv, timingSafeEqual } from 'node:crypto'
import { CryptoError } from '../core/errors.js'

export function aesDecryptGCM(
  ciphertextWithTag: Uint8Array,
  key: Uint8Array,
  iv: Uint8Array,
  aad: Uint8Array = Buffer.alloc(0),
): Buffer {
  if (ciphertextWithTag.length < 16) throw new CryptoError('Ciphertext too short')
  const split = ciphertextWithTag.length - 16
  try {
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAAD(aad)
    decipher.setAuthTag(ciphertextWithTag.subarray(split))
    return Buffer.concat([decipher.update(ciphertextWithTag.subarray(0, split)), decipher.final()])
  } catch (cause) {
    throw new CryptoError('GCM authentication failed', { code: 'ERR_CRYPTO_AUTH', cause })
  }
}

export function aesDecryptCBC(ciphertext: Uint8Array, key: Uint8Array, iv: Uint8Array): Buffer {
  try {
    const decipher = createDecipheriv('aes-256-cbc', key, iv)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()])
  } catch (cause) {
    throw new CryptoError('CBC decryption failed', { code: 'ERR_CRYPTO_DECRYPT', cause })
  }
}

/** Kebalikan `aesEncryptCBCWithIV`. */
export function aesDecryptCBCWithIV(data: Uint8Array, key: Uint8Array): Buffer {
  if (data.length < 16) throw new CryptoError('Ciphertext too short')
  return aesDecryptCBC(data.subarray(16), key, data.subarray(0, 16))
}

export function aesDecryptCTR(ciphertext: Uint8Array, key: Uint8Array, iv: Uint8Array): Buffer {
  const decipher = createDecipheriv('aes-256-ctr', key, iv)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()])
}

/** Perbandingan waktu-konstan; `false` bila panjang berbeda. */
export function safeEqual(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && timingSafeEqual(a, b)
}

export function unpadRandomMax16(data: Uint8Array): Buffer {
  const length = data[data.length - 1]
  if (length === undefined || length === 0 || length > data.length) {
    throw new CryptoError('Invalid padding')
  }
  return Buffer.from(data.subarray(0, data.length - length))
}
