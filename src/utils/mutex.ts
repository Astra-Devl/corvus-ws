/** Mutex antrian FIFO sederhana. */
export class Mutex {
  #tail: Promise<void> = Promise.resolve()
  #pending = 0

  get isLocked(): boolean {
    return this.#pending > 0
  }

  async runExclusive<T>(task: () => Promise<T> | T): Promise<T> {
    const previous = this.#tail
    let release!: () => void
    this.#tail = new Promise<void>((resolve) => {
      release = resolve
    })
    this.#pending++
    await previous
    try {
      return await task()
    } finally {
      this.#pending--
      release()
    }
  }
}

/** Menjalankan task berurutan untuk key yang sama (key berbeda berjalan paralel). */
export class KeyedMutex {
  readonly #tails = new Map<string, Promise<void>>()

  async run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.#tails.get(key) ?? Promise.resolve()
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const tail = previous.then(() => gate)
    this.#tails.set(key, tail)

    await previous
    try {
      return await task()
    } finally {
      release()
      if (this.#tails.get(key) === tail) this.#tails.delete(key)
    }
  }
}

/** Batasi jumlah task yang berjalan bersamaan. */
export class Semaphore {
  readonly #max: number
  #active = 0
  readonly #waiters: Array<() => void> = []

  constructor(max: number) {
    if (!Number.isInteger(max) || max < 1) throw new RangeError('Semaphore max must be a positive integer')
    this.#max = max
  }

  async run<T>(task: () => Promise<T> | T): Promise<T> {
    if (this.#active >= this.#max) await new Promise<void>((resolve) => this.#waiters.push(resolve))
    this.#active++
    try {
      return await task()
    } finally {
      this.#active--
      this.#waiters.shift()?.()
    }
  }
}
