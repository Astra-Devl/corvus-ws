import { CryptoError } from '../core/errors.js'
import { authJsonReplacer, authJsonReviver } from '../auth/auth-utils.js'
import type { TransactionalKeyStore } from '../auth/key-store.js'
import { aesDecryptCBC, safeEqual } from './decryption.js'
import { aesEncryptCBC, hkdf, hmacSha256, randomBytes } from './encryption.js'
import { generateKeyPair, sign, toSignalPubKey, verify } from './key-utils.js'
import { ProtoWriter, protoBytes, protoUint, readProto } from './proto-lite.js'

const VERSION_BYTE = 0x33
const SIGNATURE_LENGTH = 64
const MAX_SKIP = 2000
const MAX_STATES = 5

interface SenderKeyState {
  keyId: number
  chainKey: Buffer
  /** Iterasi berikutnya yang akan dihasilkan/dikonsumsi. */
  iteration: number
  signingPublic: Buffer
  signingPrivate: Buffer | undefined
  skipped: Record<string, Buffer>
}

interface SenderKeyRecord {
  states: SenderKeyState[]
}

function derive(seed: Buffer): { iv: Buffer; cipherKey: Buffer } {
  const okm = hkdf(seed, 48, { salt: Buffer.alloc(32), info: 'WhisperGroup' })
  return { iv: okm.subarray(0, 16), cipherKey: okm.subarray(16, 48) }
}

function advance(state: SenderKeyState): Buffer {
  const seed = hmacSha256(state.chainKey, Buffer.from([1]))
  state.chainKey = hmacSha256(state.chainKey, Buffer.from([2]))
  state.iteration++
  return seed
}

/** Enkripsi grup berbasis sender key (satu rantai per pengirim per grup). */
export class SenderKeyManager {
  readonly #keys: TransactionalKeyStore

  constructor(keys: TransactionalKeyStore) {
    this.#keys = keys
  }

  async #load(id: string): Promise<SenderKeyRecord> {
    const data = (await this.#keys.get('sender-key', [id]))[id]
    return data ? (JSON.parse(Buffer.from(data).toString('utf8'), authJsonReviver) as SenderKeyRecord) : { states: [] }
  }

  async #save(id: string, record: SenderKeyRecord): Promise<void> {
    record.states = record.states.slice(0, MAX_STATES)
    await this.#keys.set({ 'sender-key': { [id]: Buffer.from(JSON.stringify(record, authJsonReplacer)) } })
  }

  static #distribution(state: SenderKeyState): Buffer {
    return Buffer.concat([
      Buffer.from([VERSION_BYTE]),
      new ProtoWriter()
        .uint(1, state.keyId)
        .uint(2, state.iteration)
        .bytes(3, state.chainKey)
        .bytes(4, state.signingPublic)
        .toBuffer(),
    ])
  }

  /** Pesan distribusi sender key milik kita (dibuat bila belum ada). */
  createDistributionMessage(senderKeyId: string): Promise<Buffer> {
    return this.#keys.transaction(async () => {
      const record = await this.#load(senderKeyId)
      let own = record.states.find((s) => s.signingPrivate)
      if (!own) {
        const signing = generateKeyPair()
        own = {
          keyId: randomBytes(4).readUInt32BE(0) & 0x7fffffff,
          chainKey: randomBytes(32),
          iteration: 0,
          signingPublic: toSignalPubKey(signing.public),
          signingPrivate: Buffer.from(signing.private),
          skipped: {},
        }
        record.states.unshift(own)
        await this.#save(senderKeyId, record)
      }
      return SenderKeyManager.#distribution(own)
    }, senderKeyId)
  }

  /** Terima distribusi sender key dari pengirim lain. */
  processDistributionMessage(senderKeyId: string, message: Uint8Array): Promise<void> {
    return this.#keys.transaction(async () => {
      const buf = Buffer.from(message)
      if (buf.length < 2 || buf[0]! >> 4 !== 3) throw new CryptoError('Unsupported sender key version')
      const f = readProto(buf.subarray(1))
      const keyId = protoUint(f, 1)
      const iteration = protoUint(f, 2)
      const chainKey = protoBytes(f, 3)
      const signingPublic = protoBytes(f, 4)
      if (keyId === undefined || iteration === undefined || !chainKey || !signingPublic) {
        throw new CryptoError('Malformed sender key distribution message')
      }
      const record = await this.#load(senderKeyId)
      record.states = record.states.filter((s) => s.keyId !== keyId)
      record.states.unshift({ keyId, chainKey, iteration, signingPublic: toSignalPubKey(signingPublic), signingPrivate: undefined, skipped: {} })
      await this.#save(senderKeyId, record)
    }, senderKeyId)
  }

  encrypt(senderKeyId: string, plaintext: Uint8Array): Promise<Buffer> {
    return this.#keys.transaction(async () => {
      const record = await this.#load(senderKeyId)
      const state = record.states.find((s) => s.signingPrivate)
      if (!state?.signingPrivate) throw new CryptoError('No own sender key; create a distribution message first', { code: 'ERR_CRYPTO_NO_SESSION' })

      const iteration = state.iteration
      const { iv, cipherKey } = derive(advance(state))
      const body = Buffer.concat([
        Buffer.from([VERSION_BYTE]),
        new ProtoWriter().uint(1, state.keyId).uint(2, iteration).bytes(3, aesEncryptCBC(plaintext, cipherKey, iv)).toBuffer(),
      ])
      const out = Buffer.concat([body, sign(state.signingPrivate, body)])
      await this.#save(senderKeyId, record)
      return out
    }, senderKeyId)
  }

  decrypt(senderKeyId: string, message: Uint8Array): Promise<Buffer> {
    return this.#keys.transaction(async () => {
      const buf = Buffer.from(message)
      if (buf.length <= 1 + SIGNATURE_LENGTH || buf[0]! >> 4 !== 3) throw new CryptoError('Malformed sender key message')
      const body = buf.subarray(0, buf.length - SIGNATURE_LENGTH)
      const signature = buf.subarray(buf.length - SIGNATURE_LENGTH)
      const f = readProto(body.subarray(1))
      const keyId = protoUint(f, 1)
      const iteration = protoUint(f, 2)
      const ciphertext = protoBytes(f, 3)
      if (keyId === undefined || iteration === undefined || !ciphertext) throw new CryptoError('Malformed sender key message')

      const record = await this.#load(senderKeyId)
      const state = record.states.find((s) => s.keyId === keyId)
      if (!state) throw new CryptoError(`No sender key ${keyId}`, { code: 'ERR_CRYPTO_NO_SESSION' })
      if (!verify(state.signingPublic, body, signature)) throw new CryptoError('Invalid sender key signature', { code: 'ERR_CRYPTO_MAC' })

      let seed: Buffer
      if (iteration < state.iteration) {
        const skipped = state.skipped[String(iteration)]
        if (!skipped) throw new CryptoError('Duplicate or expired message', { code: 'ERR_CRYPTO_DUPLICATE' })
        seed = skipped
        delete state.skipped[String(iteration)]
      } else {
        if (iteration - state.iteration > MAX_SKIP) throw new CryptoError('Too many skipped messages')
        while (state.iteration < iteration) {
          const at = state.iteration
          state.skipped[String(at)] = advance(state)
        }
        seed = advance(state)
      }

      const { iv, cipherKey } = derive(seed)
      const plaintext = aesDecryptCBC(ciphertext, cipherKey, iv)
      await this.#save(senderKeyId, record)
      return plaintext
    }, senderKeyId)
  }
}

export { safeEqual as _safeEqual }
