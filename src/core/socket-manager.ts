import { TypedEventEmitter } from './event-emitter.js'
import type { ConnectionUpdate } from './event-mapping.js'
import { ConfigError, InvalidStateError } from './errors.js'
import { CorvusSocket, type SocketModule } from './socket.js'
import type { SocketConfig } from './socket-config.js'

export interface SocketManagerEventMap {
  'session.added': { id: string; socket: CorvusSocket }
  'session.removed': { id: string }
  'session.update': { id: string; update: ConnectionUpdate }
  'session.error': { id: string; error: Error }
}

export interface SocketManagerOptions {
  /** Config dasar yang dipakai semua session. */
  defaults?: SocketConfig
  /** Pembuat modul per-session (transport, auth, dsb). */
  modules?: (id: string) => readonly SocketModule[]
}

/** Mengelola banyak socket (multi-session) berdasarkan id. */
export class SocketManager {
  readonly events = new TypedEventEmitter<SocketManagerEventMap>()

  readonly #sockets = new Map<string, CorvusSocket>()
  readonly #detach = new Map<string, Array<() => void>>()
  readonly #defaults: SocketConfig
  readonly #modules: SocketManagerOptions['modules']

  constructor(options: SocketManagerOptions = {}) {
    this.#defaults = options.defaults ?? {}
    this.#modules = options.modules
  }

  get size(): number {
    return this.#sockets.size
  }

  get ids(): string[] {
    return [...this.#sockets.keys()]
  }

  has(id: string): boolean {
    return this.#sockets.has(id)
  }

  get(id: string): CorvusSocket | undefined {
    return this.#sockets.get(id)
  }

  create(id: string, config: SocketConfig = {}): CorvusSocket {
    if (!id) throw new ConfigError('Session id must not be empty')
    if (this.#sockets.has(id)) {
      throw new InvalidStateError(`Session "${id}" already exists`, { data: { id } })
    }

    const socket = new CorvusSocket(
      { ...this.#defaults, ...config },
      { id, modules: this.#modules?.(id) ?? [] },
    )

    this.#sockets.set(id, socket)
    this.#detach.set(id, [
      socket.ev.on('connection.update', (update) => {
        this.events.emit('session.update', { id, update })
      }),
      socket.ev.on('error', (error) => {
        this.events.emit('session.error', { id, error })
      }),
    ])

    this.events.emit('session.added', { id, socket })
    return socket
  }

  getOrCreate(id: string, config?: SocketConfig): CorvusSocket {
    return this.#sockets.get(id) ?? this.create(id, config)
  }

  /** Tutup dan hapus satu session. */
  async remove(id: string): Promise<boolean> {
    const socket = this.#sockets.get(id)
    if (!socket) return false

    await socket.end()
    for (const off of this.#detach.get(id) ?? []) off()
    this.#detach.delete(id)
    this.#sockets.delete(id)

    this.events.emit('session.removed', { id })
    return true
  }

  /** Tutup dan hapus semua session. */
  async shutdown(): Promise<void> {
    await Promise.allSettled(this.ids.map((id) => this.remove(id)))
  }
}
