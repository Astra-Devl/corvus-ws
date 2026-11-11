import { TimeoutError } from './errors.js'

export type Listener<P> = (payload: P) => unknown
export type AnyListener<E extends object> = (
  event: keyof E & string,
  payload: E[keyof E & string],
) => unknown
export type Unsubscribe = () => void

export interface TypedEventEmitterOptions {
  /** Dipanggil saat listener melempar error / reject. Default: console.error. */
  onListenerError?: (error: unknown, event: string) => void
}

export interface WaitForOptions<P> {
  predicate?: (payload: P) => boolean
  timeoutMs?: number
}

interface Entry {
  readonly listener: Listener<unknown>
  readonly original: Listener<never>
  readonly once: boolean
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as { then?: unknown }).then === 'function'
  )
}

/**
 * Event emitter bertipe dengan:
 * - isolasi error listener (sync maupun async)
 * - buffering event (`buffer()` / `flush()` / `bufferWhile()`)
 * - `waitFor()` berbasis promise
 */
export class TypedEventEmitter<E extends object> {
  readonly #listeners = new Map<string, Set<Entry>>()
  readonly #anyListeners = new Set<AnyListener<E>>()
  readonly #queue: Array<{ event: string; payload: unknown }> = []
  #bufferDepth = 0
  readonly #onListenerError: (error: unknown, event: string) => void

  constructor(options: TypedEventEmitterOptions = {}) {
    this.#onListenerError =
      options.onListenerError ??
      ((error, event) => {
        // eslint-disable-next-line no-console
        console.error(`[corvus-ws] listener for "${event}" failed:`, error)
      })
  }

  on<K extends keyof E & string>(event: K, listener: Listener<E[K]>): Unsubscribe {
    return this.#add(event, listener, false)
  }

  once<K extends keyof E & string>(event: K, listener: Listener<E[K]>): Unsubscribe {
    return this.#add(event, listener, true)
  }

  off<K extends keyof E & string>(event: K, listener: Listener<E[K]>): void {
    const set = this.#listeners.get(event)
    if (!set) return
    for (const entry of set) {
      if ((entry.original as unknown) === listener) set.delete(entry)
    }
    if (set.size === 0) this.#listeners.delete(event)
  }

  /** Dengarkan semua event. */
  onAny(listener: AnyListener<E>): Unsubscribe {
    this.#anyListeners.add(listener)
    return () => {
      this.#anyListeners.delete(listener)
    }
  }

  emit<K extends keyof E & string>(event: K, payload: E[K]): boolean {
    if (this.#bufferDepth > 0) {
      this.#queue.push({ event, payload })
      return this.hasListeners(event)
    }
    return this.#dispatch(event, payload)
  }

  hasListeners(event?: keyof E & string): boolean {
    if (event === undefined) return this.#listeners.size > 0 || this.#anyListeners.size > 0
    return (this.#listeners.get(event)?.size ?? 0) > 0 || this.#anyListeners.size > 0
  }

  listenerCount(event: keyof E & string): number {
    return this.#listeners.get(event)?.size ?? 0
  }

  removeAllListeners(event?: keyof E & string): void {
    if (event === undefined) {
      this.#listeners.clear()
      this.#anyListeners.clear()
    } else {
      this.#listeners.delete(event)
    }
  }

  /** Tunggu event berikutnya (opsional: sampai predicate true / timeout). */
  waitFor<K extends keyof E & string>(
    event: K,
    options: WaitForOptions<E[K]> = {},
  ): Promise<E[K]> {
    const { predicate, timeoutMs } = options

    return new Promise<E[K]>((resolve, reject) => {
      let timer: ReturnType<typeof setTimeout> | undefined

      const off = this.on(event, (payload) => {
        try {
          if (predicate && !predicate(payload)) return
        } catch (error) {
          cleanup()
          reject(error)
          return
        }
        cleanup()
        resolve(payload)
      })

      const cleanup = (): void => {
        off()
        if (timer !== undefined) clearTimeout(timer)
      }

      if (timeoutMs !== undefined && timeoutMs > 0) {
        timer = setTimeout(() => {
          off()
          reject(new TimeoutError(`Timed out waiting for "${event}"`, { timeoutMs }))
        }, timeoutMs)
      }
    })
  }

  // ---- buffering -------------------------------------------------------

  get isBuffering(): boolean {
    return this.#bufferDepth > 0
  }

  /** Mulai menahan event. Bisa di-nest; harus dipasangkan dengan `flush()`. */
  buffer(): void {
    this.#bufferDepth++
  }

  /** Akhiri satu level buffering; event dikirim saat level terluar selesai. */
  flush(): void {
    if (this.#bufferDepth === 0) return
    this.#bufferDepth--
    if (this.#bufferDepth > 0) return

    const queued = this.#queue.splice(0)
    for (const { event, payload } of queued) this.#dispatch(event, payload)
  }

  /** Tahan semua event selama `fn` berjalan, lalu kirim berurutan. */
  async bufferWhile<T>(fn: () => Promise<T> | T): Promise<T> {
    this.buffer()
    try {
      return await fn()
    } finally {
      this.flush()
    }
  }

  // ---- internal --------------------------------------------------------

  #add(event: string, listener: Listener<never>, once: boolean): Unsubscribe {
    let set = this.#listeners.get(event)
    if (!set) {
      set = new Set()
      this.#listeners.set(event, set)
    }
    const entry: Entry = { listener: listener as Listener<unknown>, original: listener, once }
    set.add(entry)

    return () => {
      const current = this.#listeners.get(event)
      if (!current) return
      current.delete(entry)
      if (current.size === 0) this.#listeners.delete(event)
    }
  }

  #dispatch(event: string, payload: unknown): boolean {
    let handled = false

    const set = this.#listeners.get(event)
    if (set && set.size > 0) {
      handled = true
      for (const entry of [...set]) {
        if (entry.once) set.delete(entry)
        this.#safeCall(event, () => entry.listener(payload))
      }
      if (set.size === 0) this.#listeners.delete(event)
    }

    for (const listener of [...this.#anyListeners]) {
      handled = true
      this.#safeCall(event, () =>
        (listener as (event: string, payload: unknown) => unknown)(event, payload),
      )
    }

    return handled
  }

  #safeCall(event: string, call: () => unknown): void {
    try {
      const result = call()
      if (isPromiseLike(result)) {
        result.then(undefined, (error: unknown) => this.#onListenerError(error, event))
      }
    } catch (error) {
      this.#onListenerError(error, event)
    }
  }
}
