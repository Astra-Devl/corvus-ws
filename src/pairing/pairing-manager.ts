import type { AuthState } from '../auth/auth-state.js'
import { isRegistered } from '../auth/auth-utils.js'
import type { CredsUpdate } from '../auth/credentials.js'
import { TypedEventEmitter } from '../core/event-emitter.js'
import { PairingError, TimeoutError, toError } from '../core/errors.js'
import type { SocketContext, SocketModule } from '../core/socket.js'
import {
  generatePairingCode,
  normalizeCustomCode,
  normalizePhoneNumber,
  wrapEphemeralPublicKey,
  type CodePairingRequest,
} from './code-pairing.js'
import {
  DEFAULT_PAIRING_CODE_TTL_MS,
  DEFAULT_QR_FIRST_TTL_MS,
  DEFAULT_QR_NEXT_TTL_MS,
  type PairingEventMap,
} from './pairing-events.js'
import { PairingState } from './pairing-state.js'
import { QrPairing } from './qr-pairing.js'

/** Diimplementasi oleh layer protocol: mengirim stanza ke server. */
export interface PairingBackend {
  sendCodeRequest(request: CodePairingRequest): Promise<void>
}

export interface PairingManagerOptions {
  auth: AuthState
  backend?: PairingBackend
  qrFirstTtlMs?: number
  qrNextTtlMs?: number
  codeTtlMs?: number
  /** Tutup socket bila semua QR habis tanpa dipindai (default: true). */
  endOnQrExpiry?: boolean
}

/** Modul socket yang mengoordinasikan pairing via QR atau pairing code. */
export class PairingManager implements SocketModule {
  readonly name = 'pairing'
  readonly events = new TypedEventEmitter<PairingEventMap>()
  readonly state = new PairingState()

  readonly #auth: AuthState
  readonly #backend: PairingBackend | undefined
  readonly #qrFirstTtlMs: number
  readonly #qrNextTtlMs: number
  readonly #codeTtlMs: number
  readonly #endOnQrExpiry: boolean

  #ctx: SocketContext | undefined
  #qr: QrPairing | undefined
  #codeTimer: ReturnType<typeof setTimeout> | undefined
  #offState: (() => void) | undefined

  constructor(options: PairingManagerOptions) {
    this.#auth = options.auth
    this.#backend = options.backend
    this.#qrFirstTtlMs = options.qrFirstTtlMs ?? DEFAULT_QR_FIRST_TTL_MS
    this.#qrNextTtlMs = options.qrNextTtlMs ?? DEFAULT_QR_NEXT_TTL_MS
    this.#codeTtlMs = options.codeTtlMs ?? DEFAULT_PAIRING_CODE_TTL_MS
    this.#endOnQrExpiry = options.endOnQrExpiry ?? true
  }

  // ---- SocketModule ----

  setup(ctx: SocketContext): void {
    this.#ctx = ctx
    this.#offState = this.state.onChange((change) => this.events.emit('pairing.status', change))
  }

  teardown(): void {
    this.#clearTimers()
    if (this.state.isPending) this.state.transition('cancelled')
    this.#offState?.()
    this.#offState = undefined
    this.#ctx = undefined
  }

  // ---- QR ----

  /** Dipanggil layer protocol saat server mengirim daftar `ref`. */
  startQr(refs: readonly string[]): void {
    const ctx = this.#requireReady()
    this.#clearTimers()
    this.state.transition('pending', 'qr')

    this.#qr = new QrPairing({
      firstTtlMs: this.#qrFirstTtlMs,
      nextTtlMs: this.#qrNextTtlMs,
      onQr: (qr, index, total, ttlMs) => {
        this.events.emit('pairing.qr', { qr, index, total, ttlMs })
        ctx.ev.emit('connection.update', { qr })
      },
      onExhausted: () => {
        this.state.transition('expired')
        this.events.emit('pairing.expired', { method: 'qr' })
        if (this.#endOnQrExpiry) void ctx.end(new TimeoutError('QR refs attempts ended'))
      },
    })
    this.#qr.start(refs, this.#auth.creds)
  }

  // ---- pairing code ----

  /** Minta pairing code untuk `phoneNumber`. Mengembalikan kode 8 karakter. */
  async requestPairingCode(phoneNumber: string, customCode?: string): Promise<string> {
    const ctx = this.#requireReady()
    if (!this.#backend) throw new PairingError('PairingManager has no backend configured')

    const phone = normalizePhoneNumber(phoneNumber)
    const code = customCode !== undefined ? normalizeCustomCode(customCode) : generatePairingCode()
    const creds = this.#auth.creds

    const wrapped = await wrapEphemeralPublicKey(creds.pairingEphemeralKeyPair.public, code)

    this.#clearTimers()
    this.state.transition('pending', 'code')
    ctx.ev.emit('creds.update', { pairingCode: code })

    try {
      await this.#backend.sendCodeRequest({
        phoneNumber: phone,
        pairingCode: code,
        wrappedEphemeralKey: wrapped,
        noiseKeyPublic: creds.noiseKey.public,
        platformDisplay: ctx.config.browser[1] + `(${ctx.config.browser[0]})`,
      })
    } catch (error) {
      this.handleFailure(toError(error))
      throw error
    }

    const expiresAt = Date.now() + this.#codeTtlMs
    this.#codeTimer = setTimeout(() => {
      this.#codeTimer = undefined
      if (!this.state.isPending) return
      this.state.transition('expired')
      this.events.emit('pairing.expired', { method: 'code' })
      ctx.ev.emit('creds.update', { pairingCode: undefined })
    }, this.#codeTtlMs)

    this.events.emit('pairing.code', { code, phoneNumber: phone, expiresAt })
    ctx.ev.emit('connection.update', { pairingCode: code })
    return code
  }

  // ---- hasil ----

  /** Dipanggil layer protocol saat server mengonfirmasi pairing berhasil. */
  handlePaired(update: CredsUpdate): void {
    const ctx = this.#ctx
    this.#clearTimers()
    this.state.transition('paired')

    const creds: CredsUpdate = { ...update, registered: true, pairingCode: undefined }
    ctx?.ev.emit('creds.update', creds)
    ctx?.ev.emit('connection.update', { isNewLogin: true, qr: undefined })
    this.events.emit('pairing.success', { me: update.me })
  }

  handleFailure(error: Error): void {
    const method = this.state.method
    this.#clearTimers()
    if (this.state.isPending) this.state.transition('failed')
    this.events.emit('pairing.failed', { error, method })
  }

  cancel(): void {
    this.#clearTimers()
    if (this.state.isPending) this.state.transition('cancelled')
  }

  // ---- internal ----

  #requireReady(): SocketContext {
    const ctx = this.#ctx
    if (!ctx) throw new PairingError('PairingManager is not attached to a socket')
    if (isRegistered(this.#auth.creds)) throw new PairingError('Session is already registered')
    if (!ctx.state.isActive) throw new PairingError('Socket is not connected')
    return ctx
  }

  #clearTimers(): void {
    this.#qr?.stop()
    this.#qr = undefined
    if (this.#codeTimer !== undefined) clearTimeout(this.#codeTimer)
    this.#codeTimer = undefined
  }
}
