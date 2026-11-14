import { CorvusError } from '../core/errors.js'

export class AbortError extends CorvusError {
  constructor(message = 'Operation aborted') {
    super(message, { code: 'ERR_ABORTED' })
  }
}

/** Tidur `ms` milidetik; dapat dibatalkan lewat `signal`. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new AbortError())
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, ms)
    const onAbort = (): void => {
      clearTimeout(timer)
      reject(new AbortError())
    }
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}

export interface RetryBackoffOptions {
  delayMs?: number
  maxDelayMs?: number
  factor?: number
  /** Proporsi acak 0-1 (default 0.2). */
  jitter?: number
  random?: () => number
}

/** Delay untuk percobaan ke-`attempt` (mulai dari 1). */
export function backoffDelay(attempt: number, options: RetryBackoffOptions = {}): number {
  const base = Math.min((options.delayMs ?? 250) * (options.factor ?? 2) ** Math.max(attempt - 1, 0), options.maxDelayMs ?? 30_000)
  const jitter = Math.min(Math.max(options.jitter ?? 0.2, 0), 1)
  const spread = base * jitter
  return Math.max(0, Math.round(base - spread + (options.random ?? Math.random)() * 2 * spread))
}

export interface RetryOptions extends RetryBackoffOptions {
  /** Jumlah percobaan ulang (di luar percobaan pertama), default 3. */
  retries?: number
  shouldRetry?: (error: unknown, attempt: number) => boolean
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void
  signal?: AbortSignal
}

/** Jalankan `fn` dengan percobaan ulang + exponential backoff. */
export async function retry<T>(fn: (attempt: number) => Promise<T> | T, options: RetryOptions = {}): Promise<T> {
  const retries = options.retries ?? 3
  for (let attempt = 1; ; attempt++) {
    if (options.signal?.aborted) throw new AbortError()
    try {
      return await fn(attempt)
    } catch (error) {
      if (attempt > retries || error instanceof AbortError || options.shouldRetry?.(error, attempt) === false) throw error
      const delay = backoffDelay(attempt, options)
      options.onRetry?.(error, attempt, delay)
      await sleep(delay, options.signal)
    }
  }
}
