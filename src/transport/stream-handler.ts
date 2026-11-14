import { TypedEventEmitter } from '../core/event-emitter.js'
import { ProtocolError, TimeoutError, toError } from '../core/errors.js'
import type { BinaryNode, NodeCodec } from '../protocol/protocol-types.js'
import { FrameHandler, type FrameCipher, type FrameHandlerOptions } from './frame-handler.js'
import type { Transport } from './interface.js'
import { TransportClosedError } from './transport-errors.js'

export interface StreamEventMap {
  /** Frame mentah (mode `raw`, mis. saat handshake). */
  frame: Buffer
  /** Node hasil decode (mode `node`). */
  node: BinaryNode
  error: Error
}

export type StreamMode = 'raw' | 'node'

const MAX_RAW_QUEUE = 64

/**
 * Menggabungkan transport + framing + (opsional) enkripsi + codec node.
 * Mulai dalam mode `raw`; panggil `startNodeMode()` setelah handshake selesai.
 */
export class StreamHandler {
  readonly events = new TypedEventEmitter<StreamEventMap>()

  readonly #transport: Transport
  readonly #codec: NodeCodec
  readonly #frames: FrameHandler
  #mode: StreamMode = 'raw'
  #off: (() => void) | undefined
  #rawQueue: Buffer[] = []
  #rawWaiters: Array<{
    resolve: (frame: Buffer) => void
    reject: (error: Error) => void
    timer: ReturnType<typeof setTimeout>
  }> = []

  constructor(transport: Transport, codec: NodeCodec, options: FrameHandlerOptions = {}) {
    this.#transport = transport
    this.#codec = codec
    this.#frames = new FrameHandler(
      (payload) => this.#onFrame(payload),
      (error) => this.events.emit('error', error),
      options,
    )
  }

  get mode(): StreamMode {
    return this.#mode
  }

  /** Mulai mendengarkan data dari transport. */
  attach(): void {
    this.#off?.()
    this.#off = this.#transport.events.on('message', (data) => this.#frames.push(data))
  }

  detach(): void {
    this.#off?.()
    this.#off = undefined
  }

  setCipher(cipher: FrameCipher | undefined): void {
    this.#frames.setCipher(cipher)
  }

  /** Beralih ke mode node; frame yang sempat diantrekan diproses sebagai node. */
  startNodeMode(): void {
    this.#mode = 'node'
    for (const frame of this.#rawQueue.splice(0)) this.#onFrame(frame)
  }

  /** Kembali ke keadaan awal untuk koneksi baru. */
  reset(): void {
    this.#mode = 'raw'
    this.#frames.reset()
    this.#rawQueue = []
    for (const waiter of this.#rawWaiters.splice(0)) {
      clearTimeout(waiter.timer)
      waiter.reject(new TransportClosedError('Stream was reset'))
    }
  }

  sendFrame(payload: Uint8Array): Promise<void> {
    if (this.#transport.state !== 'open') return Promise.reject(new TransportClosedError())
    // encode sinkron di sini agar urutan cipher sama dengan urutan pemanggilan
    let frame: Buffer
    try {
      frame = this.#frames.encode(payload)
    } catch (error) {
      return Promise.reject(error)
    }
    return this.#transport.send(frame)
  }

  sendNode(node: BinaryNode): Promise<void> {
    try {
      return this.sendFrame(this.#codec.encode(node))
    } catch (error) {
      return Promise.reject(toError(error))
    }
  }

  /** Ambil frame mentah berikutnya (untuk handshake); frame yang sudah tiba diantrekan. */
  waitForFrame(timeoutMs: number): Promise<Buffer> {
    if (this.#mode !== 'raw') {
      return Promise.reject(new ProtocolError('waitForFrame is only valid in raw mode'))
    }
    const queued = this.#rawQueue.shift()
    if (queued) return Promise.resolve(queued)

    return new Promise<Buffer>((resolve, reject) => {
      const waiter = {
        resolve,
        reject,
        timer: setTimeout(() => {
          this.#rawWaiters = this.#rawWaiters.filter((w) => w !== waiter)
          reject(new TimeoutError('Timed out waiting for frame', { timeoutMs }))
        }, timeoutMs),
      }
      this.#rawWaiters.push(waiter)
    })
  }

  #onFrame(payload: Buffer): void {
    if (this.#mode === 'raw') {
      this.events.emit('frame', payload)
      const waiter = this.#rawWaiters.shift()
      if (waiter) {
        clearTimeout(waiter.timer)
        waiter.resolve(payload)
      } else if (this.#rawQueue.length >= MAX_RAW_QUEUE) {
        this.events.emit('error', new ProtocolError('Too many unread handshake frames'))
      } else {
        this.#rawQueue.push(payload)
      }
      return
    }
    let node: BinaryNode
    try {
      node = this.#codec.decode(payload)
    } catch (error) {
      this.events.emit('error', toError(error))
      return
    }
    this.events.emit('node', node)
  }
}
