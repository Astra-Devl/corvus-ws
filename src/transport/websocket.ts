import { TypedEventEmitter } from '../core/event-emitter.js'
import type { ResolvedSocketConfig } from '../core/socket-config.js'
import type { Transport, TransportState } from './interface.js'
import { TransportClosedError, TransportError, TransportTimeoutError } from './transport-errors.js'
import {
  WS_READY_STATE_OPEN,
  type TransportEventMap,
  type WebSocketFactory,
  type WebSocketLike,
} from './websocket-events.js'

type WebSocketConstructor = new (url: string, options: object) => WebSocketLike

/** Factory bawaan: memakai paket `ws` (dimuat saat dibutuhkan). */
export const defaultWebSocketFactory: WebSocketFactory = async (url, options) => {
  const specifier = 'ws'
  let mod: { WebSocket?: WebSocketConstructor; default?: WebSocketConstructor }
  try {
    mod = await import(specifier)
  } catch (cause) {
    throw new TransportError('Package "ws" is required (npm install ws)', { cause })
  }
  const Ctor = mod.WebSocket ?? mod.default
  if (!Ctor) throw new TransportError('Package "ws" does not export a WebSocket class')
  return new Ctor(url, options)
}

function toBytes(data: unknown): Uint8Array {
  if (Buffer.isBuffer(data)) return data
  if (data instanceof Uint8Array) return data
  if (data instanceof ArrayBuffer) return new Uint8Array(data)
  if (Array.isArray(data)) return Buffer.concat(data.map(toBytes))
  if (typeof data === 'string') return Buffer.from(data)
  throw new TransportError('Unsupported WebSocket message type')
}

export interface WebSocketTransportOptions {
  factory?: WebSocketFactory
  /** Tunggu penutupan normal sebelum `terminate()` (ms). */
  closeTimeoutMs?: number
}

export class WebSocketTransport implements Transport {
  readonly events = new TypedEventEmitter<TransportEventMap>()

  readonly #config: ResolvedSocketConfig
  readonly #factory: WebSocketFactory
  readonly #closeTimeoutMs: number
  #state: TransportState = 'idle'
  #ws: WebSocketLike | undefined

  constructor(config: ResolvedSocketConfig, options: WebSocketTransportOptions = {}) {
    this.#config = config
    this.#factory = options.factory ?? defaultWebSocketFactory
    this.#closeTimeoutMs = options.closeTimeoutMs ?? 2_000
  }

  get state(): TransportState {
    return this.#state
  }

  async connect(): Promise<void> {
    if (this.#state !== 'idle' && this.#state !== 'closed') {
      throw new TransportError(`Cannot connect while transport is ${this.#state}`)
    }
    this.#state = 'connecting'

    let ws: WebSocketLike
    try {
      ws = await this.#factory(this.#config.url, {
        origin: this.#config.origin,
        headers: { ...this.#config.headers },
        handshakeTimeout: this.#config.connectTimeoutMs,
      })
    } catch (error) {
      this.#state = 'closed'
      throw error
    }
    this.#ws = ws

    await new Promise<void>((resolve, reject) => {
      let settled = false
      const settle = (error?: Error): void => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        if (error) {
          this.#state = 'closed'
          this.#ws = undefined
          ws.terminate?.()
          reject(error)
        } else {
          resolve()
        }
      }
      const timer = setTimeout(
        () => settle(new TransportTimeoutError('WebSocket connect timed out')),
        this.#config.connectTimeoutMs,
      )

      ws.on('open', () => {
        if (settled) return
        this.#state = 'open'
        settle()
        this.events.emit('open', undefined)
      })
      ws.on('message', (data: unknown) => {
        if (this.#ws !== ws) return
        try {
          this.events.emit('message', toBytes(data))
        } catch (error) {
          this.events.emit('error', error instanceof Error ? error : new TransportError(String(error)))
        }
      })
      ws.on('error', (error: Error) => {
        this.events.emit('error', error)
        settle(error)
      })
      ws.on('close', (code: number, reason: unknown) => {
        const text = Buffer.isBuffer(reason) ? reason.toString('utf8') : String(reason ?? '')
        const wasConnecting = !settled
        if (wasConnecting) {
          settle(new TransportClosedError(`WebSocket closed during connect (${code})`))
        }
        if (this.#ws === ws || wasConnecting) {
          this.#state = 'closed'
          this.#ws = undefined
          this.events.emit('close', { code, reason: text })
        }
      })
    })
  }

  send(data: Uint8Array): Promise<void> {
    const ws = this.#ws
    if (!ws || this.#state !== 'open' || ws.readyState !== WS_READY_STATE_OPEN) {
      return Promise.reject(new TransportClosedError())
    }
    return new Promise<void>((resolve, reject) => {
      try {
        ws.send(data, (error) => (error ? reject(error) : resolve()))
      } catch (error) {
        reject(error)
      }
    })
  }

  async close(code = 1000, reason = ''): Promise<void> {
    const ws = this.#ws
    if (!ws || this.#state === 'closed' || this.#state === 'idle') return
    this.#state = 'closing'

    const closed = this.events
      .waitFor('close', { timeoutMs: this.#closeTimeoutMs })
      .catch(() => {
        ws.terminate?.()
        if (this.#ws === ws) {
          this.#ws = undefined
          this.#state = 'closed'
        }
      })

    try {
      ws.close(code, reason)
    } catch {
      ws.terminate?.()
    }
    await closed
  }
}
