import { createCipheriv, createDecipheriv, pbkdf2, randomBytes } from 'node:crypto'
import { promisify } from 'node:util'
import { PairingError } from '../core/errors.js'

const pbkdf2Async = promisify(pbkdf2)

/** Alfabet Crockford base32 tanpa 0, I, O, U. */
const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTVWXYZ'
const CODE_REGEX = /^[1-9A-HJ-NP-TV-Z]{8}$/
const KDF_ITERATIONS = 2 << 16
const SALT_LENGTH = 32
const IV_LENGTH = 16

/** Data yang dikirim ke server saat meminta pairing code. */
export interface CodePairingRequest {
  phoneNumber: string
  pairingCode: string
  /** salt(32) | iv(16) | AES-256-CTR(ephemeral public key). */
  wrappedEphemeralKey: Uint8Array
  noiseKeyPublic: Uint8Array
  platformDisplay: string
}

/** Buat kode acak 8 karakter (40 bit). */
export function generatePairingCode(): string {
  const bytes = randomBytes(5)
  let acc = 0
  let bits = 0
  let out = ''
  for (const byte of bytes) {
    acc = (acc << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += ALPHABET[(acc >>> (bits - 5)) & 31]
      bits -= 5
    }
    acc &= (1 << bits) - 1
  }
  return out
}

/** Validasi kode buatan sendiri (8 karakter dari alfabet di atas). */
export function normalizeCustomCode(code: string): string {
  const normalized = code.trim().toUpperCase()
  if (!CODE_REGEX.test(normalized)) {
    throw new PairingError('Custom pairing code must be 8 characters from [1-9A-HJ-NP-TV-Z]')
  }
  return normalized
}

/** Nomor telepon format internasional tanpa "+" (7-15 digit). */
export function normalizePhoneNumber(input: string): string {
  const digits = input.replace(/\D/g, '')
  if (digits.length < 7 || digits.length > 15 || digits.startsWith('0')) {
    throw new PairingError(
      'Phone number must be in international format (e.g. 6281234567890), without leading 0',
    )
  }
  return digits
}

export function derivePairingCodeKey(code: string, salt: Uint8Array): Promise<Buffer> {
  return pbkdf2Async(code, salt, KDF_ITERATIONS, 32, 'sha256')
}

export async function wrapEphemeralPublicKey(
  ephemeralPublicKey: Uint8Array,
  code: string,
): Promise<Buffer> {
  const salt = randomBytes(SALT_LENGTH)
  const iv = randomBytes(IV_LENGTH)
  const key = await derivePairingCodeKey(code, salt)

  const cipher = createCipheriv('aes-256-ctr', key, iv)
  const encrypted = Buffer.concat([cipher.update(ephemeralPublicKey), cipher.final()])
  return Buffer.concat([salt, iv, encrypted])
}

export async function unwrapEphemeralPublicKey(wrapped: Uint8Array, code: string): Promise<Buffer> {
  if (wrapped.length <= SALT_LENGTH + IV_LENGTH) {
    throw new PairingError('Wrapped key is too short')
  }
  const buf = Buffer.from(wrapped)
  const salt = buf.subarray(0, SALT_LENGTH)
  const iv = buf.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
  const data = buf.subarray(SALT_LENGTH + IV_LENGTH)

  const key = await derivePairingCodeKey(code, salt)
  const decipher = createDecipheriv('aes-256-ctr', key, iv)
  return Buffer.concat([decipher.update(data), decipher.final()])
}
