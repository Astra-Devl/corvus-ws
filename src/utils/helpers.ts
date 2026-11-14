import { TimeoutError } from '../core/errors.js'

export const noop = (): void => {}

export const unixTimestamp = (nowMs: number = Date.now()): number => Math.floor(nowMs / 1000)

export function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return value !== null && typeof value === 'object' && typeof (value as { then?: unknown }).then === 'function'
}

/** Batalkan `promise` bila melebihi `ms` (promise aslinya tetap berjalan). */
export function withTimeout<T>(promise: Promise<T>, ms: number, label = 'operation'): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(`${label} timed out after ${ms}ms`, { timeoutMs: ms })), ms)
  })
  return Promise.race([promise, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer)
  })
}

export interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason: unknown) => void
}

export function defer<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

/** Tunda pemanggilan `fn` sampai `waitMs` sejak panggilan terakhir. */
export function debounce<A extends unknown[]>(fn: (...args: A) => void, waitMs: number): ((...args: A) => void) & { cancel(): void; flush(): void } {
  let timer: ReturnType<typeof setTimeout> | undefined
  let lastArgs: A | undefined
  const run = (): void => {
    timer = undefined
    if (lastArgs) fn(...lastArgs)
    lastArgs = undefined
  }
  const debounced = ((...args: A) => {
    lastArgs = args
    if (timer !== undefined) clearTimeout(timer)
    timer = setTimeout(run, waitMs)
  }) as ((...args: A) => void) & { cancel(): void; flush(): void }
  debounced.cancel = () => {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    lastArgs = undefined
  }
  debounced.flush = () => {
    if (timer !== undefined) clearTimeout(timer)
    if (lastArgs) run()
  }
  return debounced
}

export function once<A extends unknown[], R>(fn: (...args: A) => R): (...args: A) => R {
  let called = false
  let result: R
  return (...args) => {
    if (!called) {
      called = true
      result = fn(...args)
    }
    return result
  }
}

export function chunk<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) throw new RangeError('size must be a positive integer')
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export const unique = <T>(items: Iterable<T>): T[] => [...new Set(items)]
