import { randomUUID } from 'node:crypto'
import { TypedEventEmitter } from './event-emitter.js'
import type { ConnectionUpdate, CorvusEventMap } from './event-mapping.js'
import {
  ConnectionClosedError,
  InvalidStateError,
  ModuleError,
  TimeoutError,
  toError,
} from './errors.js'
import {
  resolveSocketConfig,
  type Logger,
  type ResolvedSocketConfig,
  type SocketConfig,
} from './socket-config.js'
import { SocketState } from './socket-state.js'

/**
 * Konteks yang diterima setiap modul saat setup/teardown.
 * Modul seperti transport, connection, auth, dsb. akan memakai ini.
 */
export interface SocketContext {
  readonly id: string
  readonly config: ResolvedSocketConfig
  readonly state: SocketState
  readonly ev: TypedEventEmitter<CorvusEventMap>
  readonly logger: Logger
  /** Tandai koneksi siap dipakai (dipanggil oleh modul connection/transport). */
  markOpen(update?: Omit<ConnectionUpdate, 'connection'>): void
  /** Tutup socket. Idempotent. */
  end(error?: Error): Promise<void>
  /** Mulai koneksi (dipakai mis. oleh modul reconnect). */
  connect(): Promise<void>
}

/** Titik ekstensi: layer lain didaftarkan ke socket sebagai modul. */
export interface SocketModule {
  readonly name: string
  /** Dipanggil berurutan saat `connect()`. */
  setup?(ctx: SocketContext): void | Promise<void>
  /** Dipanggil berkebalikan saat `end()`. Error ditangkap dan hanya di-log. */
  teardown?(ctx: SocketContext, error?: Error): void | Promise<void>
}

export interface CreateSocketOptions {
  id?: string
  modules?: readonly SocketModule[]
}

function withTimeout<T>(task: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new TimeoutError(`${label} timed out after ${ms}ms`, { timeoutMs: ms })),
      ms,
    )
  })
  return Promise.race([task, timeout]).finally(() => {
    if (timer !== undefined) clearTimeout(timer)
  })
}

export class CorvusSocket implements SocketContext {
  readonly id: string
  readonly config: ResolvedSocketConfig
  readonly state = new SocketState()
  readonly logger: Logger
  readonly ev: TypedEventEmitter<CorvusEventMap>

  readonly #modules: SocketModule[] = []
  #ending: Promise<void> | undefined

  constructor(config: SocketConfig = {}, options: CreateSocketOptions = {}) {
    this.id = options.id ?? randomUUID()
    this.config = resolveSocketConfig(config)
    this.logger = this.config.logger.child?.({ socket: this.id }) ?? this.config.logger

    this.ev = new TypedEventEmitter<CorvusEventMap>({
      onListenerError: (error, event) =>
        this.logger.error({ err: error, event }, 'event listener failed'),
    })

    for (const mod of options.modules ?? []) this.use(mod)
  }

  /** Daftarkan modul. Hanya boleh saat socket belum aktif. */
  use(mod: SocketModule): this {
    if (this.state.isActive || this.state.is('closing')) {
      throw new InvalidStateError('Cannot register modules while the socket is active')
    }
    if (this.#modules.some((m) => m.name === mod.name)) {
      throw new ModuleError(`Module "${mod.name}" is already registered`, {
        data: { name: mod.name },
      })
    }
    this.#modules.push(mod)
    return this
  }

  getModule<T extends SocketModule = SocketModule>(name: string): T | undefined {
    return this.#modules.find((m) => m.name === name) as T | undefined
  }

  get modules(): readonly SocketModule[] {
    return this.#modules
  }

  /**
   * Jalankan setup semua modul. Resolve setelah setup selesai; status baru
   * menjadi `open` ketika sebuah modul memanggil `markOpen()`.
   * Gunakan `waitForOpen()` untuk menunggunya.
   */
  async connect(): Promise<void> {
    if (!this.state.canTransition('connecting')) {
      throw new InvalidStateError(`Cannot connect while socket is ${this.state.status}`, {
        data: { status: this.state.status },
      })
    }

    this.state.transition('connecting')
    this.ev.emit('connection.update', { connection: 'connecting' })
    this.logger.debug({ url: this.config.url }, 'connecting')

    const run = async (): Promise<void> => {
      for (const mod of this.#modules) {
        if (this.state.status !== 'connecting') throw new ConnectionClosedError()
        this.logger.trace({ module: mod.name }, 'module setup')
        try {
          await mod.setup?.(this)
        } catch (error) {
          throw new ModuleError(`Module "${mod.name}" failed during setup`, {
            cause: error,
            data: { name: mod.name },
          })
        }
      }
    }

    try {
      await withTimeout(run(), this.config.connectTimeoutMs, 'socket connect')
    } catch (error) {
      const err = toError(error)
      await this.end(err)
      throw err
    }
  }

  /** Tunggu sampai status `open`. Reject jika socket tertutup / timeout. */
  async waitForOpen(timeoutMs: number = this.config.connectTimeoutMs): Promise<void> {
    if (this.state.status === 'open') return
    if (this.state.is('closing', 'closed')) throw new ConnectionClosedError()

    const update = await this.ev.waitFor('connection.update', {
      predicate: (u) => u.connection === 'open' || u.connection === 'close',
      timeoutMs,
    })

    if (update.connection === 'close') {
      throw update.lastDisconnect?.error ?? new ConnectionClosedError()
    }
  }

  markOpen(update: Omit<ConnectionUpdate, 'connection'> = {}): void {
    if (this.state.status !== 'connecting') {
      this.logger.warn({ status: this.state.status }, 'markOpen ignored: socket is not connecting')
      return
    }
    this.state.transition('open')
    this.ev.emit('connection.update', { ...update, connection: 'open' })
    this.logger.info('connection open')
  }

  end(error?: Error): Promise<void> {
    if (this.#ending) return this.#ending
    if (!this.state.isActive) return Promise.resolve()

    this.#ending = this.#shutdown(error).finally(() => {
      this.#ending = undefined
    })
    return this.#ending
  }

  async #shutdown(error?: Error): Promise<void> {
    this.logger.debug({ err: error }, 'ending socket')
    this.state.transition('closing')

    for (const mod of [...this.#modules].reverse()) {
      try {
        await mod.teardown?.(this, error)
      } catch (teardownError) {
        this.logger.warn({ err: teardownError, module: mod.name }, 'module teardown failed')
      }
    }

    this.state.recordDisconnect(error)
    this.state.transition('closed')
    this.ev.emit('connection.update', {
      connection: 'close',
      lastDisconnect: { error, date: new Date() },
    })
  }
}

export function createSocket(config?: SocketConfig, options?: CreateSocketOptions): CorvusSocket {
  return new CorvusSocket(config, options)
}
