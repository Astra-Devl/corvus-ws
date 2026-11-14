import { TypedEventEmitter } from '../core/event-emitter.js'
import { DisconnectReason, getDisconnectCode, isReconnectable } from '../core/errors.js'
import type { SocketContext, SocketModule } from '../core/socket.js'

export interface BackoffOptions {
  initialDelayMs?: number
  maxDelayMs?: number
  factor?: number
  /** Proporsi acak 0-1 yang ditambahkan/dikurangi dari delay. */
  jitter?: number
}

/** Exponential backoff dengan jitter. `attempt` dimulai dari 1. */
export class BackoffPolicy {
  readonly #initial: number
  readonly #max: number
  readonly #factor: number
  readonly #jitter: number

  constructor(options: BackoffOptions = {}) {
    this.#initial = options.initialDelayMs ?? 1_000
    this.#max = options.maxDelayMs ?? 30_000
    this.#factor = options.factor ?? 2
    this.#jitter = Math.min(Math.max(options.jitter ?? 0.25, 0), 1)
  }

  delayFor(attempt: number, random: () => number = Math.random): number {
    const base = Math.min(this.#initial * this.#factor ** Math.max(attempt - 1, 0), this.#max)
    const spread = base * this.#jitter
    return Math.max(0, Math.round(base - spread + random() * 2 * spread))
  }
}

export interface ReconnectOptions extends BackoffOptions {
  /** Batas percobaan beruntun (default tak terbatas). */
  maxAttempts?: number
  /** Override keputusan reconnect. Default: berdasarkan kode disconnect. */
  shouldReconnect?: (error: Error) => boolean
}

export interface ReconnectEventMap {
  'reconnect.scheduled': { attempt: number; delayMs: number; error: Error }
  'reconnect.attempt': { attempt: number }
  'reconnect.failed': { attempt: number; error: Error }
  'reconnect.giveup': { attempts: number; error: Error }
}

/**
 * Menyambung ulang otomatis setelah koneksi terputus karena error yang
 * layak dicoba lagi. `socket.end()` tanpa error dianggap penutupan manual.
 */
export class ReconnectManager implements SocketModule {
  readonly name = 'reconnect'
  readonly events = new TypedEventEmitter<ReconnectEventMap>()

  readonly #policy: BackoffPolicy
  readonly #maxAttempts: number
  readonly #shouldReconnect: (error: Error) => boolean
  #ctx: SocketContext | undefined
  #off: (() => void) | undefined
  #timer: ReturnType<typeof setTimeout> | undefined
  #attempt = 0
  #enabled = true

  constructor(options: ReconnectOptions = {}) {
    this.#policy = new BackoffPolicy(options)
    this.#maxAttempts = options.maxAttempts ?? Number.POSITIVE_INFINITY
    this.#shouldReconnect =
      options.shouldReconnect ?? ((error) => isReconnectable(getDisconnectCode(error)))
  }

  get attempts(): number {
    return this.#attempt
  }

  get isScheduled(): boolean {
    return this.#timer !== undefined
  }

  setup(ctx: SocketContext): void {
    this.#ctx = ctx
    this.#cancelTimer()
    if (this.#off) return // langganan dipertahankan lintas koneksi

    this.#off = ctx.ev.on('connection.update', (update) => {
      if (update.connection === 'open') {
        this.#attempt = 0
        this.#cancelTimer()
      } else if (update.connection === 'close') {
        this.#onClose(ctx, update.lastDisconnect?.error)
      }
    })
  }

  /** Batalkan jadwal dan nonaktifkan reconnect otomatis. */
  stop(): void {
    this.#enabled = false
    this.#cancelTimer()
  }

  enable(): void {
    this.#enabled = true
  }

  /** Lepas semua langganan (panggil saat socket tidak dipakai lagi). */
  dispose(): void {
    this.stop()
    this.#off?.()
    this.#off = undefined
    this.#ctx = undefined
  }

  #onClose(ctx: SocketContext, error: Error | undefined): void {
    if (!this.#enabled || !ctx.config.autoReconnect || !error) return
    if (!this.#shouldReconnect(error)) return

    // restartRequired (mis. setelah pairing) disambung segera, tanpa menghitung percobaan
    const immediate = getDisconnectCode(error) === DisconnectReason.restartRequired
    if (!immediate) {
      if (this.#attempt >= this.#maxAttempts) {
        this.events.emit('reconnect.giveup', { attempts: this.#attempt, error })
        return
      }
      this.#attempt++
    }

    const attempt = this.#attempt
    const delayMs = immediate ? 0 : this.#policy.delayFor(attempt)
    this.events.emit('reconnect.scheduled', { attempt, delayMs, error })

    this.#cancelTimer()
    this.#timer = setTimeout(() => {
      this.#timer = undefined
      if (!this.#enabled || ctx.state.status !== 'closed') return
      this.events.emit('reconnect.attempt', { attempt })
      ctx.connect().catch((err: unknown) => {
        // kegagalan setup sudah memicu `connection.update: close` yang menjadwalkan ulang
        this.events.emit('reconnect.failed', {
          attempt,
          error: err instanceof Error ? err : new Error(String(err)),
        })
      })
    }, delayMs)
  }

  #cancelTimer(): void {
    if (this.#timer !== undefined) clearTimeout(this.#timer)
    this.#timer = undefined
  }
}
