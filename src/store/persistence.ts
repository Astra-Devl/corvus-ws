import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { noopLogger } from '../core/defaults.js'
import type { Logger } from '../core/socket-config.js'
import type { InMemoryStore } from './in-memory-store.js'
import { deserializeSnapshot, serializeSnapshot } from './serializers.js'
import type { StoreAdapter, StoreSnapshot } from './store-adapter.js'

/** Adapter berbasis satu file JSON (penulisan atomik: tmp lalu rename). */
export class FileStoreAdapter implements StoreAdapter {
  readonly #path: string
  #writing: Promise<void> = Promise.resolve()

  constructor(path: string) {
    this.#path = path
  }

  async load(): Promise<StoreSnapshot | undefined> {
    let text: string
    try {
      text = await readFile(this.#path, 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined
      throw error
    }
    return deserializeSnapshot(text)
  }

  save(snapshot: StoreSnapshot): Promise<void> {
    const run = async (): Promise<void> => {
      await mkdir(dirname(this.#path), { recursive: true })
      const tmp = `${this.#path}.${process.pid}.tmp`
      await writeFile(tmp, serializeSnapshot(snapshot), { mode: 0o600 })
      await rename(tmp, this.#path)
    }
    // tulis berurutan agar tidak saling menimpa
    this.#writing = this.#writing.then(run, run)
    return this.#writing
  }

  async delete(): Promise<void> {
    await rm(this.#path, { force: true })
  }
}

export interface AutoPersistOptions {
  /** Jeda sejak perubahan terakhir sebelum menyimpan (default 5000 ms). */
  debounceMs?: number
  logger?: Logger
}

/** Menyimpan store ke adapter secara otomatis setiap ada perubahan. */
export class AutoPersister {
  readonly #store: InMemoryStore
  readonly #adapter: StoreAdapter
  readonly #debounceMs: number
  readonly #logger: Logger
  #timer: ReturnType<typeof setTimeout> | undefined
  #off: (() => void) | undefined
  #dirty = false
  #saving: Promise<void> = Promise.resolve()

  constructor(store: InMemoryStore, adapter: StoreAdapter, options: AutoPersistOptions = {}) {
    this.#store = store
    this.#adapter = adapter
    this.#debounceMs = options.debounceMs ?? 5_000
    this.#logger = options.logger ?? noopLogger
  }

  /** Muat snapshot (jika ada) lalu mulai memantau perubahan. */
  async start(): Promise<void> {
    const snapshot = await this.#adapter.load()
    if (snapshot) this.#store.loadSnapshot(snapshot)
    this.#off = this.#store.events.onAny(() => this.#markDirty())
  }

  /** Berhenti memantau dan simpan perubahan yang tersisa. */
  async stop(): Promise<void> {
    this.#off?.()
    this.#off = undefined
    await this.flush()
    await this.#adapter.close?.()
  }

  async flush(): Promise<void> {
    if (this.#timer !== undefined) clearTimeout(this.#timer)
    this.#timer = undefined
    if (this.#dirty) this.#enqueue()
    await this.#saving
  }

  #markDirty(): void {
    this.#dirty = true
    if (this.#timer !== undefined) clearTimeout(this.#timer)
    this.#timer = setTimeout(() => {
      this.#timer = undefined
      this.#enqueue()
    }, this.#debounceMs)
  }

  #enqueue(): void {
    this.#dirty = false
    const snapshot = this.#store.toSnapshot()
    this.#saving = this.#saving
      .then(() => this.#adapter.save(snapshot))
      .catch((error: unknown) => {
        this.#dirty = true
        this.#logger.error({ err: error }, 'failed to persist store')
      })
  }
}
