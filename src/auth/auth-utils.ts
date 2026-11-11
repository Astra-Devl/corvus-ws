import { generateKeyPairSync, randomBytes } from 'node:crypto'
import { AuthError } from '../core/errors.js'
import type { AuthCreds, KeyPair, SignedKeyPair } from './credentials.js'

// ---- key pair provider ---------------------------------------------------

/**
 * Abstraksi operasi kurva 25519. `crypto/key-utils.ts` akan menyediakan
 * implementasi lengkap (termasuk tanda tangan XEdDSA).
 */
export interface KeyPairProvider {
  generateKeyPair(): KeyPair
  /** Tanda tangan curve25519 (XEdDSA) atas `message`. */
  sign(privateKey: Uint8Array, message: Uint8Array): Uint8Array
}

/** Buat pasangan kunci X25519 (private key di-clamp). */
export function generateX25519KeyPair(): KeyPair {
  const { privateKey } = generateKeyPairSync('x25519')
  const jwk = privateKey.export({ format: 'jwk' })
  if (!jwk.x || !jwk.d) throw new AuthError('Failed to export X25519 key pair')

  const priv = Buffer.from(jwk.d, 'base64url')
  priv[0] = priv[0]! & 248
  priv[31] = (priv[31]! & 127) | 64

  return { public: Buffer.from(jwk.x, 'base64url'), private: priv }
}

export const nodeKeyPairProvider: KeyPairProvider = {
  generateKeyPair: generateX25519KeyPair,
  sign() {
    throw new AuthError(
      'No XEdDSA signer configured. Pass a KeyPairProvider (see crypto/key-utils) ' +
        'or call setDefaultKeyPairProvider().',
    )
  },
}

let defaultProvider: KeyPairProvider = nodeKeyPairProvider

export function setDefaultKeyPairProvider(provider: KeyPairProvider): void {
  defaultProvider = provider
}

export function getDefaultKeyPairProvider(): KeyPairProvider {
  return defaultProvider
}

// ---- credential generation ----------------------------------------------

/** Tambah prefix 0x05 (tipe kunci Signal) bila public key 32 byte. */
export function toSignalPubKey(pubKey: Uint8Array): Uint8Array {
  if (pubKey.length === 33) return pubKey
  return Buffer.concat([Buffer.from([5]), pubKey])
}

export function generateRegistrationId(): number {
  return randomBytes(2).readUInt16LE(0) & 16383
}

export function generateSignedPreKey(
  identityKey: KeyPair,
  keyId: number,
  provider: KeyPairProvider = defaultProvider,
): SignedKeyPair {
  const keyPair = provider.generateKeyPair()
  const signature = provider.sign(identityKey.private, toSignalPubKey(keyPair.public))
  return { keyPair, signature, keyId }
}

/** Buat kredensial baru untuk session yang belum pernah login. */
export function initAuthCreds(provider: KeyPairProvider = defaultProvider): AuthCreds {
  const signedIdentityKey = provider.generateKeyPair()

  return {
    noiseKey: provider.generateKeyPair(),
    pairingEphemeralKeyPair: provider.generateKeyPair(),
    signedIdentityKey,
    signedPreKey: generateSignedPreKey(signedIdentityKey, 1, provider),
    registrationId: generateRegistrationId(),
    advSecretKey: randomBytes(32).toString('base64'),
    nextPreKeyId: 1,
    firstUnuploadedPreKeyId: 1,
    accountSyncCounter: 0,
    accountSettings: { unarchiveChats: false },
    processedHistoryMessages: [],
    registered: false,
    pairingCode: undefined,
  }
}

export function isRegistered(creds: Pick<AuthCreds, 'me' | 'registered'>): boolean {
  return creds.registered || creds.me !== undefined
}

/** Pemeriksaan bentuk minimal untuk data yang dibaca dari penyimpanan. */
export function isAuthCreds(value: unknown): value is AuthCreds {
  if (value === null || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  const isKeyPair = (k: unknown): boolean =>
    k !== null &&
    typeof k === 'object' &&
    (k as KeyPair).public instanceof Uint8Array &&
    (k as KeyPair).private instanceof Uint8Array

  return (
    isKeyPair(v.noiseKey) &&
    isKeyPair(v.signedIdentityKey) &&
    isKeyPair(v.pairingEphemeralKeyPair) &&
    typeof v.registrationId === 'number' &&
    typeof v.advSecretKey === 'string'
  )
}

// ---- serialisasi JSON (kompatibel dengan format `{type:'Buffer', data}`) ---

export function authJsonReplacer(this: unknown, key: string, value: unknown): unknown {
  // JSON.stringify memanggil toJSON() Buffer lebih dulu; baca nilai aslinya.
  const original = (this as Record<string, unknown> | undefined)?.[key]
  if (original instanceof Uint8Array) {
    return { type: 'Buffer', data: Buffer.from(original).toString('base64') }
  }
  return value
}

export function authJsonReviver(_key: string, value: unknown): unknown {
  if (value !== null && typeof value === 'object' && (value as { type?: unknown }).type === 'Buffer') {
    const data = (value as { data?: unknown }).data
    if (typeof data === 'string') return Buffer.from(data, 'base64')
    if (Array.isArray(data)) return Buffer.from(data as number[])
  }
  return value
}

export function serializeAuthData(value: unknown): string {
  return JSON.stringify(value, authJsonReplacer, 2)
}

export function parseAuthData<T = unknown>(text: string): T {
  return JSON.parse(text, authJsonReviver) as T
}

// ---- mutex per key ---------------------------------------------------------

/** Menjalankan task berurutan untuk key yang sama. */
export class KeyedMutex {
  readonly #tails = new Map<string, Promise<void>>()

  async run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.#tails.get(key) ?? Promise.resolve()
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const tail = previous.then(() => gate)
    this.#tails.set(key, tail)

    await previous
    try {
      return await task()
    } finally {
      release()
      if (this.#tails.get(key) === tail) this.#tails.delete(key)
    }
  }
}
