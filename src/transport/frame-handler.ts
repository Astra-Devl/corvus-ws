import { FrameError } from './transport-errors.js'

/** Enkripsi/dekripsi per-frame (mis. Noise AES-GCM). Harus sinkron dan berurutan. */
export interface FrameCipher {
  encrypt(data: Uint8Array): Uint8Array
  decrypt(data: Uint8Array): Uint8Array
}

export interface FrameHandlerOptions {
  /** Byte yang dikirim sekali sebelum frame pertama (header intro). */
  intro?: Uint8Array
  /** Ukuran payload maksimum (default 2^24 - 1, batas 3 byte). */
  maxFrameSize?: number
}

const LENGTH_BYTES = 3
const MAX_FRAME = 0xff_ffff

/**
 * Framing: setiap frame = panjang (3 byte big-endian) + payload.
 * Mendukung reassembly dari potongan data yang sembarang.
 */
export class FrameHandler {
  readonly #onFrame: (payload: Buffer) => void
  readonly #onError: (error: Error) => void
  readonly #intro: Uint8Array | undefined
  readonly #maxFrameSize: number

  #cipher: FrameCipher | undefined
  #introSent = false
  #chunks: Buffer[] = []
  #size = 0
  #frameLength: number | undefined

  constructor(
    onFrame: (payload: Buffer) => void,
    onError: (error: Error) => void,
    options: FrameHandlerOptions = {},
  ) {
    this.#onFrame = onFrame
    this.#onError = onError
    this.#intro = options.intro
    this.#maxFrameSize = Math.min(options.maxFrameSize ?? MAX_FRAME, MAX_FRAME)
  }

  setCipher(cipher: FrameCipher | undefined): void {
    this.#cipher = cipher
  }

  /** Bungkus payload menjadi frame siap kirim. */
  encode(payload: Uint8Array): Buffer {
    const body = this.#cipher ? this.#cipher.encrypt(payload) : payload
    if (body.length > this.#maxFrameSize) {
      throw new FrameError(`Frame too large (${body.length} > ${this.#maxFrameSize})`)
    }

    const intro = !this.#introSent && this.#intro ? this.#intro : undefined
    this.#introSent = true

    const out = Buffer.allocUnsafe((intro?.length ?? 0) + LENGTH_BYTES + body.length)
    let offset = 0
    if (intro) {
      out.set(intro, 0)
      offset = intro.length
    }
    out.writeUIntBE(body.length, offset, LENGTH_BYTES)
    out.set(body, offset + LENGTH_BYTES)
    return out
  }

  /** Masukkan data mentah dari transport. */
  push(chunk: Uint8Array): void {
    this.#chunks.push(Buffer.from(chunk.buffer, chunk.byteOffset, chunk.length))
    this.#size += chunk.length

    for (;;) {
      if (this.#frameLength === undefined) {
        if (this.#size < LENGTH_BYTES) return
        const length = this.#take(LENGTH_BYTES).readUIntBE(0, LENGTH_BYTES)
        if (length > this.#maxFrameSize) {
          this.reset()
          this.#onError(new FrameError(`Incoming frame too large (${length})`))
          return
        }
        this.#frameLength = length
      }
      if (this.#size < this.#frameLength) return

      const raw = this.#take(this.#frameLength)
      this.#frameLength = undefined
      if (raw.length === 0) continue

      let payload: Uint8Array
      try {
        payload = this.#cipher ? this.#cipher.decrypt(raw) : raw
      } catch (cause) {
        this.reset()
        this.#onError(new FrameError('Failed to decrypt frame', { cause }))
        return
      }
      this.#onFrame(Buffer.from(payload.buffer, payload.byteOffset, payload.length))
    }
  }

  /** Reset buffer dan status intro (dipakai saat koneksi baru). */
  reset(): void {
    this.#chunks = []
    this.#size = 0
    this.#frameLength = undefined
    this.#introSent = false
    this.#cipher = undefined
  }

  #take(n: number): Buffer {
    const first = this.#chunks[0]
    this.#size -= n
    if (first && first.length >= n) {
      if (first.length === n) this.#chunks.shift()
      else this.#chunks[0] = first.subarray(n)
      return first.subarray(0, n)
    }
    const all = Buffer.concat(this.#chunks, this.#size + n)
    this.#chunks = this.#size > 0 ? [all.subarray(n)] : []
    return all.subarray(0, n)
  }
}
