/** Timer periodik yang tidak menjalankan tick baru selagi tick sebelumnya belum selesai. */
export class Heartbeat {
  readonly #intervalMs: number
  readonly #tick: () => void | Promise<void>
  readonly #onError: ((error: unknown) => void) | undefined
  readonly #unref: boolean
  #timer: ReturnType<typeof setInterval> | undefined
  #inFlight = false

  constructor(
    intervalMs: number,
    tick: () => void | Promise<void>,
    options: { onError?: (error: unknown) => void; unref?: boolean } = {},
  ) {
    this.#intervalMs = intervalMs
    this.#tick = tick
    this.#onError = options.onError
    this.#unref = options.unref ?? false
  }

  get isRunning(): boolean {
    return this.#timer !== undefined
  }

  start(options: { immediate?: boolean } = {}): void {
    if (this.#timer !== undefined) return
    this.#timer = setInterval(() => void this.beat(), this.#intervalMs)
    if (this.#unref) this.#timer.unref()
    if (options.immediate) void this.beat()
  }

  stop(): void {
    if (this.#timer !== undefined) clearInterval(this.#timer)
    this.#timer = undefined
  }

  /** Jalankan satu tick sekarang (dilewati bila tick sebelumnya masih berjalan). */
  async beat(): Promise<void> {
    if (this.#inFlight) return
    this.#inFlight = true
    try {
      await this.#tick()
    } catch (error) {
      this.#onError?.(error)
    } finally {
      this.#inFlight = false
    }
  }
}
