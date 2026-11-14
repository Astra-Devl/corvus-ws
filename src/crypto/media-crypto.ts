import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'node:crypto'
import { Transform, type TransformCallback } from 'node:stream'
import { CryptoError } from '../core/errors.js'
import { hkdf } from './encryption.js'
import { safeEqual } from './decryption.js'

export type MediaType =
  | 'image' | 'video' | 'audio' | 'document' | 'sticker' | 'ptt' | 'gif'
  | 'thumbnail-link' | 'product' | 'history' | 'md-app-state' | 'md-msg-hist'

const HKDF_INFO: Record<MediaType, string> = {
  image: 'WhatsApp Image Keys',
  sticker: 'WhatsApp Image Keys',
  product: 'WhatsApp Image Keys',
  video: 'WhatsApp Video Keys',
  gif: 'WhatsApp Video Keys',
  audio: 'WhatsApp Audio Keys',
  ptt: 'WhatsApp Audio Keys',
  document: 'WhatsApp Document Keys',
  'thumbnail-link': 'WhatsApp Link Thumbnail Keys',
  history: 'WhatsApp History Keys',
  'md-msg-hist': 'WhatsApp History Keys',
  'md-app-state': 'WhatsApp App State Keys',
}

const MAC_LENGTH = 10

export interface MediaKeys {
  iv: Buffer
  cipherKey: Buffer
  macKey: Buffer
}

export function generateMediaKey(): Buffer {
  return randomBytes(32)
}

/** Turunkan iv, cipherKey, macKey dari mediaKey (HKDF 112 byte). */
export function getMediaKeys(mediaKey: Uint8Array, type: MediaType): MediaKeys {
  if (mediaKey.length !== 32) throw new CryptoError('mediaKey must be 32 bytes')
  const okm = hkdf(mediaKey, 112, { info: HKDF_INFO[type] })
  return { iv: okm.subarray(0, 16), cipherKey: okm.subarray(16, 48), macKey: okm.subarray(48, 80) }
}

export interface EncryptedMedia {
  mediaKey: Buffer
  /** ciphertext || mac(10) */
  encrypted: Buffer
  fileSha256: Buffer
  fileEncSha256: Buffer
  fileLength: number
}

export function encryptMedia(data: Uint8Array, type: MediaType, mediaKey: Buffer = generateMediaKey()): EncryptedMedia {
  const { iv, cipherKey, macKey } = getMediaKeys(mediaKey, type)
  const cipher = createCipheriv('aes-256-cbc', cipherKey, iv)
  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()])
  const mac = createHmac('sha256', macKey).update(iv).update(ciphertext).digest().subarray(0, MAC_LENGTH)
  const encrypted = Buffer.concat([ciphertext, mac])
  return {
    mediaKey,
    encrypted,
    fileSha256: createHash('sha256').update(data).digest(),
    fileEncSha256: createHash('sha256').update(encrypted).digest(),
    fileLength: data.length,
  }
}

export function decryptMedia(encrypted: Uint8Array, mediaKey: Uint8Array, type: MediaType): Buffer {
  if (encrypted.length <= MAC_LENGTH) throw new CryptoError('Encrypted media too short')
  const { iv, cipherKey, macKey } = getMediaKeys(mediaKey, type)
  const ciphertext = encrypted.subarray(0, encrypted.length - MAC_LENGTH)
  const mac = encrypted.subarray(encrypted.length - MAC_LENGTH)

  const expected = createHmac('sha256', macKey).update(iv).update(ciphertext).digest().subarray(0, MAC_LENGTH)
  if (!safeEqual(expected, mac)) throw new CryptoError('Media MAC mismatch', { code: 'ERR_CRYPTO_MAC' })

  try {
    const decipher = createDecipheriv('aes-256-cbc', cipherKey, iv)
    return Buffer.concat([decipher.update(ciphertext), decipher.final()])
  } catch (cause) {
    throw new CryptoError('Media decryption failed', { code: 'ERR_CRYPTO_DECRYPT', cause })
  }
}

export interface MediaEncryptStream extends Transform {
  /** Tersedia setelah stream selesai (`finish`). */
  readonly result: Omit<EncryptedMedia, 'encrypted'> | undefined
}

/** Enkripsi media secara streaming; MAC ditambahkan di akhir. */
export function createMediaEncryptStream(type: MediaType, mediaKey: Buffer = generateMediaKey()): MediaEncryptStream {
  const { iv, cipherKey, macKey } = getMediaKeys(mediaKey, type)
  const cipher = createCipheriv('aes-256-cbc', cipherKey, iv)
  const hmac = createHmac('sha256', macKey).update(iv)
  const plainHash = createHash('sha256')
  const encHash = createHash('sha256')
  let length = 0
  let result: MediaEncryptStream['result']

  const emit = (stream: Transform, chunk: Buffer): void => {
    if (chunk.length === 0) return
    hmac.update(chunk)
    encHash.update(chunk)
    stream.push(chunk)
  }

  const stream = new Transform({
    transform(chunk: Buffer, _enc, callback: TransformCallback) {
      plainHash.update(chunk)
      length += chunk.length
      emit(this, cipher.update(chunk))
      callback()
    },
    flush(callback: TransformCallback) {
      emit(this, cipher.final())
      const mac = hmac.digest().subarray(0, MAC_LENGTH)
      encHash.update(mac)
      this.push(mac)
      result = { mediaKey, fileSha256: plainHash.digest(), fileEncSha256: encHash.digest(), fileLength: length }
      callback()
    },
  }) as Transform & { result: MediaEncryptStream['result'] }

  Object.defineProperty(stream, 'result', { get: () => result })
  return stream as MediaEncryptStream
}

/**
 * Dekripsi media secara streaming. MAC baru bisa diperiksa di akhir, jadi
 * konsumen HARUS membuang output bila stream berakhir dengan error.
 */
export function createMediaDecryptStream(type: MediaType, mediaKey: Uint8Array): Transform {
  const { iv, cipherKey, macKey } = getMediaKeys(mediaKey, type)
  const decipher = createDecipheriv('aes-256-cbc', cipherKey, iv)
  const hmac = createHmac('sha256', macKey).update(iv)
  let tail: Buffer = Buffer.alloc(0)

  return new Transform({
    transform(chunk: Buffer, _enc, callback: TransformCallback) {
      const data = Buffer.concat([tail, chunk])
      if (data.length <= MAC_LENGTH) {
        tail = data
        return callback()
      }
      const body = data.subarray(0, data.length - MAC_LENGTH)
      tail = data.subarray(data.length - MAC_LENGTH)
      hmac.update(body)
      try {
        this.push(decipher.update(body))
        callback()
      } catch (error) {
        callback(error as Error)
      }
    },
    flush(callback: TransformCallback) {
      if (tail.length !== MAC_LENGTH) return callback(new CryptoError('Encrypted media too short'))
      const expected = hmac.digest().subarray(0, MAC_LENGTH)
      if (!safeEqual(expected, tail)) return callback(new CryptoError('Media MAC mismatch', { code: 'ERR_CRYPTO_MAC' }))
      try {
        this.push(decipher.final())
        callback()
      } catch (cause) {
        callback(new CryptoError('Media decryption failed', { code: 'ERR_CRYPTO_DECRYPT', cause }))
      }
    },
  })
}
