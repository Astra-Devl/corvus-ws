import { randomBytes } from 'node:crypto'
import { curveKeyPairProvider, generateKeyPair, toSignalPubKey } from '../crypto/key-utils.js'
import type { AuthCreds, KeyPair, SignedKeyPair } from './credentials.js'

// ---- key pair provider ---------------------------------------------------

/**
 * Abstraksi operasi kurva 25519; implementasi bawaan ada di `crypto/key-utils.ts`.
 */
export interface KeyPairProvider {
  generateKeyPair(): KeyPair
  /** Tanda tangan curve25519 (XEdDSA) atas `message`. */
  sign(privateKey: Uint8Array, message: Uint8Array): Uint8Array
}

/** Buat pasangan kunci X25519 (private key di-clamp). */
export const generateX25519KeyPair = generateKeyPair

/** Provider bawaan: kurva 25519 + tanda tangan XEdDSA dari `crypto/key-utils`. */
export const nodeKeyPairProvider: KeyPairProvider = curveKeyPairProvider

let defaultProvider: KeyPairProvider = nodeKeyPairProvider

export function setDefaultKeyPairProvider(provider: KeyPairProvider): void {
  defaultProvider = provider
}

export function getDefaultKeyPairProvider(): KeyPairProvider {
  return defaultProvider
}

// ---- credential generation ----------------------------------------------

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

export { KeyedMutex } from '../utils/mutex.js'
