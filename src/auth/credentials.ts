/** Bentuk data kredensial sebuah session. */

export interface KeyPair {
  readonly public: Uint8Array
  readonly private: Uint8Array
}

export interface SignedKeyPair {
  readonly keyPair: KeyPair
  readonly signature: Uint8Array
  readonly keyId: number
  readonly timestampS?: number | undefined
}

export interface AccountContact {
  id: string
  lid?: string | undefined
  name?: string | undefined
}

export interface SignalIdentity {
  identifier: { name: string; deviceId: number }
  identifierKey: Uint8Array
}

export interface AccountSettings {
  unarchiveChats: boolean
}

export interface AuthCreds {
  noiseKey: KeyPair
  pairingEphemeralKeyPair: KeyPair
  signedIdentityKey: KeyPair
  signedPreKey: SignedKeyPair
  registrationId: number
  /** Base64, 32 byte. Dipakai pada QR dan proses pairing. */
  advSecretKey: string

  nextPreKeyId: number
  firstUnuploadedPreKeyId: number
  accountSyncCounter: number
  accountSettings: AccountSettings
  processedHistoryMessages: Array<{ key: Record<string, unknown>; messageTimestamp?: number }>

  /** `true` setelah pairing berhasil. */
  registered: boolean
  /** Kode pairing yang sedang aktif (mode pairing code). */
  pairingCode?: string | undefined

  me?: AccountContact | undefined
  /** Signed device identity dari server (placeholder sampai modul protocol dibuat). */
  account?: Record<string, unknown> | undefined
  signalIdentities?: SignalIdentity[] | undefined
  platform?: string | undefined
  lastAccountSyncTimestamp?: number | undefined
  myAppStateKeyId?: string | undefined
  routingInfo?: Uint8Array | undefined
}

export type CredsUpdate = Partial<AuthCreds>
