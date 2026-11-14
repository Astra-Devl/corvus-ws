import type { AuthCreds, KeyPair } from '../auth/credentials.js'
import type { TransactionalKeyStore } from '../auth/key-store.js'
import { CryptoError } from '../core/errors.js'
import type { SocketContext } from '../core/socket.js'
import type { ConnectionHandshake, HandshakeIO } from '../connection/connection.js'
import { NOISE_MODE, WA_HEADER } from '../protocol/protocol-version.js'
import type { FrameCipher } from '../transport/frame-handler.js'
import { aesDecryptGCM } from './decryption.js'
import { aesEncryptGCM, counterIV, hkdf, sha256 } from './encryption.js'
import { generateKeyPair, sharedKey, type Curve25519KeyPair } from './key-utils.js'
import { ProtoWriter, protoBytes, readProto } from './proto-lite.js'
import { SenderKeyManager } from './sender-key.js'
import { SignalSessionManager } from './session.js'

export interface ServerHello {
  ephemeral: Uint8Array
  static: Uint8Array
  payload: Uint8Array
}

/**
 * Handler Noise_XX_25519_AESGCM_SHA256 (varian WhatsApp Web).
 * Selama handshake satu counter dipakai bersama; setelah `finishInit()`
 * arah kirim/terima memakai kunci dan counter masing-masing.
 */
export class NoiseHandler {
  readonly ephemeral: Curve25519KeyPair

  #hash: Buffer
  #salt: Buffer
  #encKey: Buffer
  #decKey: Buffer
  #readCounter = 0
  #writeCounter = 0
  #finished = false
  readonly #responder: boolean

  constructor(
    ephemeral: Curve25519KeyPair,
    options: {
      header?: Uint8Array
      noiseMode?: string
      /** `responder` dipakai server tiruan/test; default `initiator` (klien). */
      role?: 'initiator' | 'responder'
      /** Wajib untuk responder: public ephemeral milik initiator. */
      remoteEphemeral?: Uint8Array
    } = {},
  ) {
    this.ephemeral = ephemeral
    this.#responder = options.role === 'responder'
    if (this.#responder && !options.remoteEphemeral) {
      throw new CryptoError('Responder requires the initiator ephemeral key')
    }
    const mode = Buffer.from(options.noiseMode ?? NOISE_MODE)
    this.#hash = mode.length === 32 ? mode : sha256(mode)
    this.#salt = this.#hash
    this.#encKey = this.#hash
    this.#decKey = this.#hash
    this.authenticate(options.header ?? WA_HEADER)
    this.authenticate(this.#responder ? options.remoteEphemeral! : ephemeral.public)
  }

  get isFinished(): boolean {
    return this.#finished
  }

  authenticate(data: Uint8Array): void {
    if (!this.#finished) this.#hash = sha256(this.#hash, data)
  }

  encrypt(plaintext: Uint8Array): Buffer {
    const result = aesEncryptGCM(plaintext, this.#encKey, counterIV(this.#writeCounter), this.#finished ? undefined : this.#hash)
    this.#writeCounter++
    this.authenticate(result)
    return result
  }

  decrypt(ciphertext: Uint8Array): Buffer {
    const iv = counterIV(this.#finished ? this.#readCounter : this.#writeCounter)
    const result = aesDecryptGCM(ciphertext, this.#decKey, iv, this.#finished ? undefined : this.#hash)
    if (this.#finished) this.#readCounter++
    else this.#writeCounter++
    this.authenticate(ciphertext)
    return result
  }

  mixIntoKey(data: Uint8Array): void {
    const [write, read] = this.#split(data)
    this.#salt = write
    this.#encKey = read
    this.#decKey = read
    this.#readCounter = 0
    this.#writeCounter = 0
  }

  finishInit(): void {
    const [first, second] = this.#split(new Uint8Array(0))
    // initiator mengirim dengan kunci pertama; responder sebaliknya
    this.#encKey = this.#responder ? second : first
    this.#decKey = this.#responder ? first : second
    this.#hash = Buffer.alloc(0)
    this.#readCounter = 0
    this.#writeCounter = 0
    this.#finished = true
  }

  #split(data: Uint8Array): [Buffer, Buffer] {
    const key = hkdf(data, 64, { salt: this.#salt })
    return [key.subarray(0, 32), key.subarray(32)]
  }

  /**
   * Proses ServerHello. Mengembalikan static key kita (terenkripsi) untuk
   * ClientFinish, plus sertifikat server (didekripsi) untuk verifikasi.
   */
  processServerHello(hello: ServerHello, noiseKey: KeyPair): { encryptedStatic: Buffer; certificate: Buffer } {
    this.authenticate(hello.ephemeral)
    this.mixIntoKey(sharedKey(this.ephemeral.private, hello.ephemeral))

    const serverStatic = this.decrypt(hello.static)
    this.mixIntoKey(sharedKey(this.ephemeral.private, serverStatic))

    const certificate = this.decrypt(hello.payload)

    const encryptedStatic = this.encrypt(noiseKey.public)
    this.mixIntoKey(sharedKey(noiseKey.private, hello.ephemeral))
    return { encryptedStatic, certificate }
  }

  /** Cipher untuk frame setelah handshake. */
  frameCipher(): FrameCipher {
    return {
      encrypt: (data) => this.encrypt(data),
      decrypt: (data) => this.decrypt(data),
    }
  }
}

export interface NoiseHandshakeOptions {
  /** Kredensial saat ini (butuh `noiseKey`). */
  getCreds: () => AuthCreds
  /** ClientPayload (login/registrasi) yang sudah di-encode protobuf. */
  buildClientPayload: (ctx: SocketContext) => Uint8Array | Promise<Uint8Array>
  /** Verifikasi sertifikat server (default: tidak ada). */
  verifyServerCertificate?: (certificate: Uint8Array) => void
}

/** Handshake Noise sebagai `ConnectionHandshake` untuk `ConnectionModule`. */
export class NoiseHandshake implements ConnectionHandshake {
  readonly #options: NoiseHandshakeOptions

  constructor(options: NoiseHandshakeOptions) {
    this.#options = options
  }

  async perform(io: HandshakeIO, ctx: SocketContext): Promise<void> {
    const noise = new NoiseHandler(generateKeyPair())

    const clientHello = new ProtoWriter().bytes(1, noise.ephemeral.public).toBuffer()
    await io.sendFrame(new ProtoWriter().bytes(2, clientHello).toBuffer())

    const reply = readProto(await io.nextFrame())
    const serverHelloBytes = protoBytes(reply, 3)
    if (!serverHelloBytes) throw new CryptoError('Handshake: missing ServerHello')
    const sh = readProto(serverHelloBytes)
    const hello = { ephemeral: protoBytes(sh, 1), static: protoBytes(sh, 2), payload: protoBytes(sh, 3) }
    if (!hello.ephemeral || !hello.static || !hello.payload) throw new CryptoError('Handshake: incomplete ServerHello')

    const { encryptedStatic, certificate } = noise.processServerHello(
      { ephemeral: hello.ephemeral, static: hello.static, payload: hello.payload },
      this.#options.getCreds().noiseKey,
    )
    this.#options.verifyServerCertificate?.(certificate)

    const payload = noise.encrypt(await this.#options.buildClientPayload(ctx))
    const finish = new ProtoWriter().bytes(1, encryptedStatic).bytes(2, payload).toBuffer()
    await io.sendFrame(new ProtoWriter().bytes(4, finish).toBuffer())

    noise.finishInit()
    io.setCipher(noise.frameCipher())
  }
}

export interface CryptoEngineOptions {
  keys: TransactionalKeyStore
  getCreds: () => AuthCreds
}

/** Fasad: sesi Signal, sender key, dan handshake Noise. */
export class CryptoEngine {
  readonly sessions: SignalSessionManager
  readonly senderKeys: SenderKeyManager
  readonly #options: CryptoEngineOptions

  constructor(options: CryptoEngineOptions) {
    this.#options = options
    this.sessions = new SignalSessionManager(options)
    this.senderKeys = new SenderKeyManager(options.keys)
  }

  createNoiseHandshake(options: Omit<NoiseHandshakeOptions, 'getCreds'>): NoiseHandshake {
    return new NoiseHandshake({ ...options, getCreds: this.#options.getCreds })
  }
}
