export interface TTLCacheOptions {
  /** Masa berlaku default (ms); tanpa nilai = tidak kedaluwarsa. */
  ttlMs?: number
  /** Jumlah entri maksimum (LRU); tanpa nilai = tak terbatas. */
  maxSize?: number
  now?: () => number
}

interface Entry<V> {
  value: V
  expires: number
}

/** Cache TTL + LRU dengan dedupe pemuatan (`getOrLoad`). */
export class TTLCache<K, V> {
  readonly #map = new Map<K, Entry<V>>()
  readonly #inflight = new Map<K, Promise<V>>()
  readonly #ttl: number
  readonly #max: number
  readonly #now: () => number

  constructor(options: TTLCacheOptions = {}) {
    this.#ttl = options.ttlMs ?? Number.POSITIVE_INFINITY
    this.#max = options.maxSize ?? Number.POSITIVE_INFINITY
    this.#now = options.now ?? Date.now
  }

  get size(): number {
    this.prune()
    return this.#map.size
  }

  get(key: K): V | undefined {
    const entry = this.#map.get(key)
    if (!entry) return undefined
    if (entry.expires <= this.#now()) {
      this.#map.delete(key)
      return undefined
    }
    this.#map.delete(key) // geser ke akhir (paling baru dipakai)
    this.#map.set(key, entry)
    return entry.value
  }

  has(key: K): boolean {
    return this.get(key) !== undefined
  }

  set(key: K, value: V, ttlMs: number = this.#ttl): this {
    this.#map.delete(key)
    this.#map.set(key, { value, expires: this.#now() + ttlMs })
    while (this.#map.size > this.#max) this.#map.delete(this.#map.keys().next().value as K)
    return this
  }

  delete(key: K): boolean {
    return this.#map.delete(key)
  }

  clear(): void {
    this.#map.clear()
  }

  /** Ambil dari cache atau muat; pemuatan serentak untuk key yang sama digabung. */
  async getOrLoad(key: K, loader: () => Promise<V>, ttlMs?: number): Promise<V> {
    const hit = this.get(key)
    if (hit !== undefined) return hit
    const pending = this.#inflight.get(key)
    if (pending) return pending

    const promise = loader()
      .then((value) => {
        this.set(key, value, ttlMs)
        return value
      })
      .finally(() => this.#inflight.delete(key))
    this.#inflight.set(key, promise)
    return promise
  }

  prune(): void {
    const now = this.#now()
    for (const [key, entry] of this.#map) if (entry.expires <= now) this.#map.delete(key)
  }
}
