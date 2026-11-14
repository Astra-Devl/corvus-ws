import { CryptoError } from '../core/errors.js'
import type { AuthCreds } from '../auth/credentials.js'
import { authJsonReplacer, authJsonReviver } from '../auth/auth-utils.js'
import type { TransactionalKeyStore } from '../auth/key-store.js'
import { aesDecryptCBC } from './decryption.js'
import { aesEncryptCBC, hkdf, hmacSha256 } from './encryption.js'
import { safeEqual } from './decryption.js'
import {
  fromSignalPubKey,
  generateKeyPair,
  sharedKey,
  toSignalPubKey,
  verify,
  type Curve25519KeyPair,
} from './key-utils.js'
import { ProtoWriter, protoBytes, protoUint, readProto } from './proto-lite.js'

/** Versi pesan Signal (3 di nibble atas & bawah). */
const VERSION_BYTE = 0x33
const MAC_LENGTH = 8
const MAX_SKIP = 2000
const MAX_RECEIVING_CHAINS = 5
const MAX_SESSIONS = 40
const ZERO32 = Buffer.alloc(32)

export interface PreKeyBundle {
  registrationId: number
  identityKey: Uint8Array
  signedPreKey: { keyId: number; publicKey: Uint8Array; signature: Uint8Array }
  preKey?: { keyId: number; publicKey: Uint8Array } | undefined
}

interface ChainState {
  /** `undefined` setelah chain dipensiunkan (hanya melayani skipped keys). */
  chainKey: Buffer | undefined
  /** Counter berikutnya yang akan dihasilkan/dikonsumsi. */
  index: number
  /** counter -> message key material (32 byte). */
  skipped: Record<string, Buffer>
}

interface SessionState {
  baseKey: Buffer
  remoteIdentityKey: Buffer
  remoteRegistrationId: number
  rootKey: Buffer
  ratchetKeyPair: { public: Buffer; private: Buffer }
  lastRemoteRatchetKey: Buffer | undefined
  previousCounter: number
  sendingChain: ChainState | undefined
  receivingChains: Array<{ ratchetKey: Buffer; chain: ChainState }>
  pendingPreKey: { preKeyId: number | undefined; signedPreKeyId: number; baseKey: Buffer } | undefined
}

export interface SessionRecord {
  sessions: SessionState[]
}

export interface LocalIdentity {
  identityKeyPair: Curve25519KeyPair
  registrationId: number
}

export type CiphertextType = 'msg' | 'pkmsg'
export interface EncryptedMessage {
  type: CiphertextType
  ciphertext: Buffer
  registrationId: number
}

// ---- util ---------------------------------------------------------------------

const eq = (a: Uint8Array, b: Uint8Array): boolean => safeEqual(a, b)

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, authJsonReplacer), authJsonReviver) as T
}

function messageKeys(material: Buffer): { cipherKey: Buffer; macKey: Buffer; iv: Buffer } {
  const okm = hkdf(material, 80, { salt: ZERO32, info: 'WhisperMessageKeys' })
  return { cipherKey: okm.subarray(0, 32), macKey: okm.subarray(32, 64), iv: okm.subarray(64, 80) }
}

function nextMaterial(chain: ChainState): Buffer {
  if (!chain.chainKey) throw new CryptoError('Chain is retired', { code: 'ERR_CRYPTO_CHAIN' })
  const material = hmacSha256(chain.chainKey, Buffer.from([1]))
  chain.chainKey = hmacSha256(chain.chainKey, Buffer.from([2]))
  chain.index++
  return material
}

function ratchet(rootKey: Buffer, ourPriv: Uint8Array, theirPub: Uint8Array) {
  const okm = hkdf(sharedKey(ourPriv, theirPub), 64, { salt: rootKey, info: 'WhisperRatchet' })
  return { rootKey: okm.subarray(0, 32), chainKey: okm.subarray(32, 64) }
}

function masterRootKey(secrets: Buffer[]): Buffer {
  const okm = hkdf(Buffer.concat([Buffer.alloc(32, 0xff), ...secrets]), 64, {
    salt: ZERO32,
    info: 'WhisperText',
  })
  return okm.subarray(0, 32)
}

function fillSkipped(chain: ChainState, until: number): void {
  if (!chain.chainKey) return
  if (until - chain.index > MAX_SKIP) throw new CryptoError('Too many skipped messages')
  while (chain.index < until) {
    const counter = chain.index
    chain.skipped[String(counter)] = nextMaterial(chain)
  }
  const keys = Object.keys(chain.skipped)
  if (keys.length > MAX_SKIP) {
    for (const key of keys.sort((a, b) => Number(a) - Number(b)).slice(0, keys.length - MAX_SKIP)) {
      delete chain.skipped[key]
    }
  }
}

// ---- X3DH ---------------------------------------------------------------------

/** Pihak penginisiasi (Alice): bangun sesi dari pre-key bundle lawan. */
export function initiateSession(local: LocalIdentity, bundle: PreKeyBundle): SessionState {
  const theirIdentity = toSignalPubKey(bundle.identityKey)
  const theirSigned = toSignalPubKey(bundle.signedPreKey.publicKey)

  if (!verify(theirIdentity, theirSigned, bundle.signedPreKey.signature)) {
    throw new CryptoError('Invalid signed pre-key signature', { code: 'ERR_CRYPTO_BUNDLE' })
  }

  const baseKey = generateKeyPair()
  const secrets = [
    sharedKey(local.identityKeyPair.private, theirSigned),
    sharedKey(baseKey.private, theirIdentity),
    sharedKey(baseKey.private, theirSigned),
  ]
  if (bundle.preKey) secrets.push(sharedKey(baseKey.private, toSignalPubKey(bundle.preKey.publicKey)))

  const rootKey = masterRootKey(secrets)
  const sendingKey = generateKeyPair()
  const step = ratchet(rootKey, sendingKey.private, theirSigned)

  return {
    baseKey: toSignalPubKey(baseKey.public),
    remoteIdentityKey: theirIdentity,
    remoteRegistrationId: bundle.registrationId,
    rootKey: step.rootKey,
    ratchetKeyPair: { public: Buffer.from(sendingKey.public), private: Buffer.from(sendingKey.private) },
    lastRemoteRatchetKey: theirSigned,
    previousCounter: 0,
    sendingChain: { chainKey: step.chainKey, index: 0, skipped: {} },
    receivingChains: [],
    pendingPreKey: {
      preKeyId: bundle.preKey?.keyId,
      signedPreKeyId: bundle.signedPreKey.keyId,
      baseKey: toSignalPubKey(baseKey.public),
    },
  }
}

/** Pihak penerima (Bob): bangun sesi dari PreKeySignalMessage. */
function acceptSession(
  local: LocalIdentity,
  signedPreKey: Curve25519KeyPair,
  oneTimePreKey: Curve25519KeyPair | undefined,
  theirIdentity: Buffer,
  theirBase: Buffer,
  remoteRegistrationId: number,
): SessionState {
  const secrets = [
    sharedKey(signedPreKey.private, theirIdentity),
    sharedKey(local.identityKeyPair.private, theirBase),
    sharedKey(signedPreKey.private, theirBase),
  ]
  if (oneTimePreKey) secrets.push(sharedKey(oneTimePreKey.private, theirBase))

  return {
    baseKey: theirBase,
    remoteIdentityKey: theirIdentity,
    remoteRegistrationId,
    rootKey: masterRootKey(secrets),
    ratchetKeyPair: { public: Buffer.from(signedPreKey.public), private: Buffer.from(signedPreKey.private) },
    lastRemoteRatchetKey: undefined,
    previousCounter: 0,
    sendingChain: undefined,
    receivingChains: [],
    pendingPreKey: undefined,
  }
}

// ---- enkripsi / dekripsi pada satu sesi ------------------------------------------

function localIdentityPub(local: LocalIdentity): Buffer {
  return toSignalPubKey(local.identityKeyPair.public)
}

function encryptWithState(state: SessionState, local: LocalIdentity, plaintext: Uint8Array): EncryptedMessage {
  const chain = state.sendingChain
  if (!chain) throw new CryptoError('Session has no sending chain', { code: 'ERR_CRYPTO_SESSION' })

  const counter = chain.index
  const keys = messageKeys(nextMaterial(chain))
  const ciphertext = aesEncryptCBC(plaintext, keys.cipherKey, keys.iv)

  const body = Buffer.concat([
    Buffer.from([VERSION_BYTE]),
    new ProtoWriter()
      .bytes(1, toSignalPubKey(state.ratchetKeyPair.public))
      .uint(2, counter)
      .uint(3, state.previousCounter)
      .bytes(4, ciphertext)
      .toBuffer(),
  ])
  const mac = hmacSha256(keys.macKey, localIdentityPub(local), state.remoteIdentityKey, body).subarray(0, MAC_LENGTH)
  const signalMessage = Buffer.concat([body, mac])

  if (!state.pendingPreKey) {
    return { type: 'msg', ciphertext: signalMessage, registrationId: local.registrationId }
  }

  const pending = state.pendingPreKey
  const writer = new ProtoWriter()
  if (pending.preKeyId !== undefined) writer.uint(1, pending.preKeyId)
  writer
    .bytes(2, pending.baseKey)
    .bytes(3, localIdentityPub(local))
    .bytes(4, signalMessage)
    .uint(5, local.registrationId)
    .uint(6, pending.signedPreKeyId)

  return {
    type: 'pkmsg',
    ciphertext: Buffer.concat([Buffer.from([VERSION_BYTE]), writer.toBuffer()]),
    registrationId: local.registrationId,
  }
}

function decryptWithState(state: SessionState, local: LocalIdentity, signalMessage: Uint8Array): Buffer {
  if (signalMessage.length <= 1 + MAC_LENGTH) throw new CryptoError('Message too short')
  const buf = Buffer.from(signalMessage)
  if (buf[0]! >> 4 !== 3) throw new CryptoError('Unsupported message version', { code: 'ERR_CRYPTO_VERSION' })

  const body = buf.subarray(0, buf.length - MAC_LENGTH)
  const mac = buf.subarray(buf.length - MAC_LENGTH)
  const fields = readProto(body.subarray(1))
  const ratchetKey = protoBytes(fields, 1)
  const counter = protoUint(fields, 2)
  const ciphertext = protoBytes(fields, 4)
  if (!ratchetKey || counter === undefined || !ciphertext) throw new CryptoError('Malformed message')

  // DH ratchet bila ini ratchet key baru
  if (!state.receivingChains.some((c) => eq(c.ratchetKey, ratchetKey))) {
    // rantai terima lama dibiarkan hidup (maks. 5) agar pesan terlambat tetap bisa dibaca
    const receiving = ratchet(state.rootKey, state.ratchetKeyPair.private, ratchetKey)
    state.receivingChains.push({ ratchetKey, chain: { chainKey: receiving.chainKey, index: 0, skipped: {} } })
    if (state.receivingChains.length > MAX_RECEIVING_CHAINS) state.receivingChains.shift()

    state.previousCounter = state.sendingChain ? Math.max(state.sendingChain.index - 1, 0) : 0
    const newPair = generateKeyPair()
    const sending = ratchet(receiving.rootKey, newPair.private, ratchetKey)
    state.rootKey = sending.rootKey
    state.ratchetKeyPair = { public: Buffer.from(newPair.public), private: Buffer.from(newPair.private) }
    state.sendingChain = { chainKey: sending.chainKey, index: 0, skipped: {} }
    state.lastRemoteRatchetKey = ratchetKey
  }

  const entry = state.receivingChains.find((c) => eq(c.ratchetKey, ratchetKey))!
  const chain = entry.chain

  let material: Buffer
  if (counter < chain.index) {
    const skipped = chain.skipped[String(counter)]
    if (!skipped) throw new CryptoError('Duplicate or expired message', { code: 'ERR_CRYPTO_DUPLICATE' })
    material = skipped
  } else {
    fillSkipped(chain, counter)
    material = nextMaterial(chain)
  }

  const keys = messageKeys(material)
  const expected = hmacSha256(keys.macKey, state.remoteIdentityKey, localIdentityPub(local), body).subarray(0, MAC_LENGTH)
  if (!safeEqual(expected, mac)) throw new CryptoError('Invalid message MAC', { code: 'ERR_CRYPTO_MAC' })

  delete chain.skipped[String(counter)]
  state.pendingPreKey = undefined
  return aesDecryptCBC(ciphertext, keys.cipherKey, keys.iv)
}

// ---- manager ---------------------------------------------------------------------

/** Alamat Signal dari JID: `user[_1].device` (`_1` untuk LID). */
export function jidToSignalAddress(jid: string): string {
  const at = jid.indexOf('@')
  if (at < 0) throw new CryptoError(`Invalid JID: ${jid}`)
  const server = jid.slice(at + 1)
  const [userPart = '', device = '0'] = jid.slice(0, at).split(':')
  const user = userPart.split('_')[0]!
  return `${server === 'lid' ? `${user}_1` : user}.${Number(device) || 0}`
}

export interface SessionManagerOptions {
  keys: TransactionalKeyStore
  getCreds: () => AuthCreds
}

/** Mengelola sesi Signal per-alamat di atas key store ('session'). */
export class SignalSessionManager {
  readonly #keys: TransactionalKeyStore
  readonly #getCreds: () => AuthCreds

  constructor(options: SessionManagerOptions) {
    this.#keys = options.keys
    this.#getCreds = options.getCreds
  }

  #local(): LocalIdentity {
    const creds = this.#getCreds()
    return { identityKeyPair: creds.signedIdentityKey, registrationId: creds.registrationId }
  }

  async #load(address: string): Promise<SessionRecord> {
    const data = (await this.#keys.get('session', [address]))[address]
    if (!data) return { sessions: [] }
    return JSON.parse(Buffer.from(data).toString('utf8'), authJsonReviver) as SessionRecord
  }

  async #save(address: string, record: SessionRecord): Promise<void> {
    record.sessions = record.sessions.slice(0, MAX_SESSIONS)
    const data = Buffer.from(JSON.stringify(record, authJsonReplacer), 'utf8')
    await this.#keys.set({ session: { [address]: data } })
  }

  async hasSession(address: string): Promise<boolean> {
    return (await this.#load(address)).sessions.length > 0
  }

  async deleteSession(address: string): Promise<void> {
    await this.#keys.set({ session: { [address]: null } })
  }

  /** Buat sesi baru dari pre-key bundle lawan. */
  injectBundle(address: string, bundle: PreKeyBundle): Promise<void> {
    return this.#keys.transaction(async () => {
      const record = await this.#load(address)
      record.sessions.unshift(initiateSession(this.#local(), bundle))
      await this.#save(address, record)
    }, address)
  }

  encrypt(address: string, plaintext: Uint8Array): Promise<EncryptedMessage> {
    return this.#keys.transaction(async () => {
      const record = await this.#load(address)
      const state = record.sessions[0]
      if (!state) throw new CryptoError(`No session for ${address}`, { code: 'ERR_CRYPTO_NO_SESSION' })
      const next = clone(state)
      const result = encryptWithState(next, this.#local(), plaintext)
      record.sessions[0] = next
      await this.#save(address, record)
      return result
    }, address)
  }

  decrypt(address: string, type: CiphertextType, ciphertext: Uint8Array): Promise<Buffer> {
    return this.#keys.transaction(async () => {
      const record = await this.#load(address)
      const local = this.#local()
      let plaintext: Buffer

      if (type === 'pkmsg') {
        const buf = Buffer.from(ciphertext)
        if (buf.length < 2 || buf[0]! >> 4 !== 3) throw new CryptoError('Unsupported message version')
        const fields = readProto(buf.subarray(1))
        const baseKey = protoBytes(fields, 2)
        const identityKey = protoBytes(fields, 3)
        const inner = protoBytes(fields, 4)
        const signedPreKeyId = protoUint(fields, 6)
        const preKeyId = protoUint(fields, 1)
        const registrationId = protoUint(fields, 5) ?? 0
        if (!baseKey || !identityKey || !inner || signedPreKeyId === undefined) {
          throw new CryptoError('Malformed pre-key message')
        }

        const existing = record.sessions.findIndex((s) => eq(s.baseKey, baseKey))
        if (existing >= 0) {
          const next = clone(record.sessions[existing]!)
          plaintext = decryptWithState(next, local, inner)
          record.sessions.splice(existing, 1)
          record.sessions.unshift(next)
        } else {
          const creds = this.#getCreds()
          if (signedPreKeyId !== creds.signedPreKey.keyId) {
            throw new CryptoError(`Unknown signed pre-key ${signedPreKeyId}`, { code: 'ERR_CRYPTO_PREKEY' })
          }
          let oneTime: Curve25519KeyPair | undefined
          if (preKeyId !== undefined) {
            oneTime = (await this.#keys.get('pre-key', [String(preKeyId)]))[String(preKeyId)]
            if (!oneTime) throw new CryptoError(`Unknown pre-key ${preKeyId}`, { code: 'ERR_CRYPTO_PREKEY' })
          }
          const state = acceptSession(local, creds.signedPreKey.keyPair, oneTime, identityKey, baseKey, registrationId)
          plaintext = decryptWithState(state, local, inner)
          record.sessions.unshift(state)
          if (preKeyId !== undefined) await this.#keys.set({ 'pre-key': { [String(preKeyId)]: null } })
        }
      } else {
        let found = -1
        let lastError: unknown
        plaintext = Buffer.alloc(0)
        for (let i = 0; i < record.sessions.length; i++) {
          const next = clone(record.sessions[i]!)
          try {
            plaintext = decryptWithState(next, local, ciphertext)
            record.sessions.splice(i, 1)
            record.sessions.unshift(next)
            found = i
            break
          } catch (error) {
            lastError = error
          }
        }
        if (found < 0) {
          if (record.sessions.length === 0) {
            throw new CryptoError(`No session for ${address}`, { code: 'ERR_CRYPTO_NO_SESSION' })
          }
          throw lastError instanceof Error ? lastError : new CryptoError('Decryption failed')
        }
      }

      await this.#save(address, record)
      return plaintext
    }, address)
  }
}

export { fromSignalPubKey }
