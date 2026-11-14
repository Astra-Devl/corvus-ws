import type { AuthCreds } from '../auth/credentials.js'
import { PairingError } from '../core/errors.js'
import { DEFAULT_QR_FIRST_TTL_MS, DEFAULT_QR_NEXT_TTL_MS } from './pairing-events.js'

type QrCreds = Pick<AuthCreds, 'noiseKey' | 'signedIdentityKey' | 'advSecretKey'>

/** Format QR: `ref,noisePub,identityPub,advSecret` (kunci dalam base64). */
export function buildQrString(ref: string, creds: QrCreds): string {
  return [
    ref,
    Buffer.from(creds.noiseKey.public).toString('base64'),
    Buffer.from(creds.signedIdentityKey.public).toString('base64'),
    creds.advSecretKey,
  ].join(',')
}

export interface QrPairingOptions {
  firstTtlMs?: number
  nextTtlMs?: number
  onQr: (qr: string, index: number, total: number, ttlMs: number) => void
  /** Dipanggil ketika semua ref sudah habis tanpa dipindai. */
  onExhausted: () => void
}

/** Merotasi daftar `ref` dari server menjadi QR berurutan. */
export class QrPairing {
  readonly #options: QrPairingOptions
  #timer: ReturnType<typeof setTimeout> | undefined
  #index = -1
  #running = false

  constructor(options: QrPairingOptions) {
    this.#options = options
  }

  get isRunning(): boolean {
    return this.#running
  }

  get index(): number {
    return this.#index
  }

  start(refs: readonly string[], creds: QrCreds): void {
    if (refs.length === 0) throw new PairingError('No QR refs provided')
    this.stop()

    this.#running = true
    this.#index = -1

    const firstTtl = this.#options.firstTtlMs ?? DEFAULT_QR_FIRST_TTL_MS
    const nextTtl = this.#options.nextTtlMs ?? DEFAULT_QR_NEXT_TTL_MS

    const next = (): void => {
      this.#index++
      const ref = refs[this.#index]
      if (ref === undefined) {
        this.#running = false
        this.#timer = undefined
        this.#options.onExhausted()
        return
      }
      const ttl = this.#index === 0 ? firstTtl : nextTtl
      this.#options.onQr(buildQrString(ref, creds), this.#index, refs.length, ttl)
      this.#timer = setTimeout(next, ttl)
    }

    next()
  }

  stop(): void {
    if (this.#timer !== undefined) clearTimeout(this.#timer)
    this.#timer = undefined
    this.#running = false
  }
}
