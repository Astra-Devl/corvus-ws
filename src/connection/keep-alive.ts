import { Heartbeat } from './heartbeat.js'

export interface KeepAliveOptions {
  intervalMs: number
  /** Toleransi tambahan sebelum koneksi dianggap mati (default 5000 ms). */
  graceMs?: number
  /** Kirim ping ke server (biasanya `engine.query(buildPing())`). */
  ping: () => Promise<unknown>
  /** Dipanggil saat tidak ada aktivitas masuk melebihi `intervalMs + graceMs`. */
  onDead: () => void
  onPingError?: (error: unknown) => void
  now?: () => number
}

/**
 * Keep-alive tingkat aplikasi: ping berkala + deteksi koneksi mati
 * berdasarkan aktivitas masuk terakhir (`markActivity()`).
 */
export class KeepAlive {
  readonly #options: KeepAliveOptions
  readonly #heartbeat: Heartbeat
  readonly #now: () => number
  #lastActivity: number

  constructor(options: KeepAliveOptions) {
    this.#options = options
    this.#now = options.now ?? Date.now
    this.#lastActivity = this.#now()
    this.#heartbeat = new Heartbeat(options.intervalMs, () => this.#check(), {
      onError: options.onPingError,
    })
  }

  get isRunning(): boolean {
    return this.#heartbeat.isRunning
  }

  get lastActivity(): number {
    return this.#lastActivity
  }

  markActivity(): void {
    this.#lastActivity = this.#now()
  }

  start(): void {
    this.#lastActivity = this.#now()
    this.#heartbeat.start()
  }

  stop(): void {
    this.#heartbeat.stop()
  }

  async #check(): Promise<void> {
    const idle = this.#now() - this.#lastActivity
    if (idle > this.#options.intervalMs + (this.#options.graceMs ?? 5_000)) {
      this.stop()
      this.#options.onDead()
      return
    }
    try {
      await this.#options.ping()
    } catch (error) {
      this.#options.onPingError?.(error)
    }
  }
}
