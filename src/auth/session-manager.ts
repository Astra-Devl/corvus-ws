import type { SocketContext, SocketModule } from '../core/socket.js'
import type { Logger } from '../core/socket-config.js'
import { noopLogger } from '../core/defaults.js'
import { initAuthCreds, isRegistered, type KeyPairProvider } from './auth-utils.js'
import type { AuthStateProvider } from './auth-state.js'
import type { AuthCreds, CredsUpdate } from './credentials.js'
import {
  createTransactionalKeyStore,
  type TransactionalKeyStore,
  type TransactionOptions,
} from './key-store.js'

export interface AuthSessionManagerOptions {
  logger?: Logger
  /** Tunda penyimpanan creds (ms). 0 = simpan segera (tetap berurutan). */
  saveDebounceMs?: number
  transaction?: TransactionOptions
  provider?: KeyPairProvider
}

/**
 * Modul socket yang menjaga siklus hidup kredensial:
 * mendengarkan `creds.update`, menggabungkannya ke creds, lalu menyimpannya.
 */
export class AuthSessionManager implements SocketModule {
  readonly name = 'auth'
  readonly keys: TransactionalKeyStore

  readonly #provider: AuthStateProvider
  readonly #logger: Logger
  readonly #debounceMs: number
  readonly #keyProvider: KeyPairProvider | undefined

  #off: (() => void) | undefined
  #timer: ReturnType<typeof setTimeout> | undefined
  #dirty = false
  #chain: Promise<void> = Promise.resolve()

  constructor(provider: AuthStateProvider, options: AuthSessionManagerOptions = {}) {
    this.#provider = provider
    this.#logger = options.logger ?? noopLogger
    this.#debounceMs = options.saveDebounceMs ?? 0
    this.#keyProvider = options.provider
    this.keys = createTransactionalKeyStore(provider.state.keys, {
      logger: this.#logger,
      ...options.transaction,
    })
  }

  get creds(): AuthCreds {
    return this.#provider.state.creds
  }

  get isRegistered(): boolean {
    return isRegistered(this.creds)
  }

  setup(ctx: SocketContext): void {
    this.#off = ctx.ev.on('creds.update', (update) => {
      this.update(update as CredsUpdate)
    })
  }

  async teardown(): Promise<void> {
    this.#off?.()
    this.#off = undefined
    await this.flush()
  }

  /** Gabungkan perubahan ke creds dan jadwalkan penyimpanan. */
  update(update: CredsUpdate): void {
    Object.assign(this.#provider.state.creds, update)
    this.#dirty = true
    this.#schedule()
  }

  /** Simpan perubahan yang tertunda dan tunggu sampai selesai. */
  async flush(): Promise<void> {
    if (this.#timer !== undefined) {
      clearTimeout(this.#timer)
      this.#timer = undefined
    }
    if (this.#dirty) this.#enqueueSave()
    await this.#chain
  }

  /** Hapus semua data dan buat kredensial baru (mis. setelah logout). */
  async reset(): Promise<void> {
    await this.flush()
    await this.#provider.clear?.()
    const fresh = initAuthCreds(this.#keyProvider)
    for (const key of Object.keys(this.creds)) {
      delete (this.creds as unknown as Record<string, unknown>)[key]
    }
    Object.assign(this.creds, fresh)
    this.#dirty = true
    await this.flush()
  }

  #schedule(): void {
    if (this.#debounceMs <= 0) {
      this.#enqueueSave()
      return
    }
    if (this.#timer !== undefined) clearTimeout(this.#timer)
    this.#timer = setTimeout(() => {
      this.#timer = undefined
      this.#enqueueSave()
    }, this.#debounceMs)
  }

  #enqueueSave(): void {
    this.#dirty = false
    this.#chain = this.#chain
      .then(() => this.#provider.saveCreds())
      .catch((error: unknown) => {
        this.#dirty = true
        this.#logger.error({ err: error }, 'failed to save creds')
      })
  }
}
