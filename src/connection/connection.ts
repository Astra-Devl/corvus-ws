import { noopLogger } from '../core/defaults.js'
import { ConnectionClosedError, ProtocolError, toError } from '../core/errors.js'
import type { Logger } from '../core/socket-config.js'
import type { SocketContext, SocketModule } from '../core/socket.js'
import { nodeToString } from '../protocol/binary-node.js'
import { ProtocolEngine } from '../protocol/protocol-engine.js'
import { WA_HEADER } from '../protocol/protocol-version.js'
import type { BinaryNode } from '../protocol/protocol-types.js'
import { buildIqResult, buildPing } from '../protocol/stanza-builder.js'
import { parseSuccess } from '../protocol/stanza-parser.js'
import type { TokenDictionary } from '../protocol/token-dictionary.js'
import type { FrameCipher } from '../transport/frame-handler.js'
import type { Transport, TransportFactory } from '../transport/interface.js'
import { StreamHandler } from '../transport/stream-handler.js'
import { WebSocketTransport } from '../transport/websocket.js'
import {
  createDisconnectError,
  disconnectErrorFromFailure,
  disconnectErrorFromStream,
} from './disconnect.js'
import { KeepAlive } from './keep-alive.js'
import { DisconnectReason } from '../core/errors.js'

/** Akses I/O mentah selama handshake (mis. Noise XX). */
export interface HandshakeIO {
  sendFrame(payload: Uint8Array): Promise<void>
  nextFrame(timeoutMs?: number): Promise<Buffer>
  /** Aktifkan enkripsi untuk semua frame berikutnya. */
  setCipher(cipher: FrameCipher): void
}

/** Langkah handshake yang bisa dipasang (diimplementasikan oleh modul crypto). */
export interface ConnectionHandshake {
  perform(io: HandshakeIO, ctx: SocketContext): Promise<void>
}

export interface ConnectionModuleOptions {
  transportFactory?: TransportFactory
  /**
   * Handshake sebelum bertukar node. Jika kosong, stream langsung masuk
   * mode node (berguna untuk test atau transport kustom).
   */
  handshake?: ConnectionHandshake
  dictionary?: TokenDictionary
  /** Kirim ping berkala (default true). */
  keepAlive?: boolean
  logger?: Logger
}

/**
 * Modul inti koneksi: transport + stream + protocol engine, routing node
 * dasar (`success`, `failure`, `stream:error`, ping), dan keep-alive.
 */
export class ConnectionModule implements SocketModule {
  readonly name = 'connection'
  readonly engine: ProtocolEngine

  readonly #options: ConnectionModuleOptions
  readonly #logger: Logger
  #ctx: SocketContext | undefined
  #transport: Transport | undefined
  #stream: StreamHandler | undefined
  #keepAlive: KeepAlive | undefined
  #offs: Array<() => void> = []

  constructor(options: ConnectionModuleOptions = {}) {
    this.#options = options
    this.#logger = options.logger ?? noopLogger

    this.engine = new ProtocolEngine({
      send: (node) => {
        const stream = this.#stream
        if (!stream) return Promise.reject(new ConnectionClosedError())
        return stream.sendNode(node)
      },
      ...(options.dictionary && { dictionary: options.dictionary }),
      logger: this.#logger,
    })

    this.engine.on({ tag: 'success' }, (node) => this.#onSuccess(node))
    this.engine.on({ tag: 'failure' }, (node) => this.#end(disconnectErrorFromFailure(node)))
    this.engine.on({ tag: 'stream:error' }, (node) => this.#end(disconnectErrorFromStream(node)))
    this.engine.on({ tag: 'xmlstreamend' }, () => this.#end(new ConnectionClosedError()))
    this.engine.on({ tag: 'iq', attrs: { type: 'get', xmlns: 'urn:xmpp:ping' } }, (node) =>
      this.sendNode(buildIqResult(node)),
    )
  }

  get transport(): Transport | undefined {
    return this.#transport
  }

  /** Kirim node (hanya jika stream aktif). */
  sendNode(node: BinaryNode): Promise<void> {
    return this.engine.sendNode(node)
  }

  query(node: BinaryNode, timeoutMs?: number): Promise<BinaryNode> {
    return this.engine.query(node, timeoutMs)
  }

  async setup(ctx: SocketContext): Promise<void> {
    this.#ctx = ctx
    const { config } = ctx

    const transport = (this.#options.transportFactory ?? ((c) => new WebSocketTransport(c)))(config)
    const stream = new StreamHandler(transport, this.engine.codec, { intro: WA_HEADER })
    this.#transport = transport
    this.#stream = stream

    this.#offs.push(
      transport.events.on('message', () => this.#keepAlive?.markActivity()),
      transport.events.on('close', ({ code, reason }) => {
        this.#end(
          createDisconnectError(
            DisconnectReason.connectionClosed,
            `Connection closed (${code ?? 'no code'}${reason ? `: ${reason}` : ''})`,
          ),
        )
      }),
      transport.events.on('error', (error) => this.#logger.warn({ err: error }, 'transport error')),
      stream.events.on('error', (error) =>
        this.#end(
          error instanceof ProtocolError
            ? createDisconnectError(DisconnectReason.badSession, error.message)
            : error,
        ),
      ),
      stream.events.on('node', (node) => {
        this.#logger.trace({ node: nodeToString(node) }, 'recv')
        this.engine.handleNode(node)
      }),
    )

    stream.attach()
    await transport.connect()

    if (this.#options.handshake) {
      const io: HandshakeIO = {
        sendFrame: (payload) => stream.sendFrame(payload),
        nextFrame: (timeoutMs = config.connectTimeoutMs) => stream.waitForFrame(timeoutMs),
        setCipher: (cipher) => stream.setCipher(cipher),
      }
      await this.#options.handshake.perform(io, ctx)
    }
    stream.startNodeMode()
  }

  async teardown(_ctx: SocketContext, error?: Error): Promise<void> {
    this.#keepAlive?.stop()
    this.#keepAlive = undefined
    this.engine.rejectAll(error ?? new ConnectionClosedError())

    for (const off of this.#offs.splice(0)) off()
    this.#stream?.detach()
    this.#stream?.reset()
    const transport = this.#transport
    this.#stream = undefined
    this.#transport = undefined
    await transport?.close()
  }

  #onSuccess(node: BinaryNode): void {
    const ctx = this.#ctx
    if (!ctx) return
    const info = parseSuccess(node)
    this.#logger.debug({ lid: info.lid }, 'login success')

    if (this.#options.keepAlive !== false) {
      this.#keepAlive = new KeepAlive({
        intervalMs: ctx.config.keepAliveIntervalMs,
        ping: () => this.engine.query(buildPing(), ctx.config.defaultQueryTimeoutMs),
        onDead: () =>
          this.#end(createDisconnectError(DisconnectReason.timedOut, 'Connection was lost')),
        onPingError: (error) => this.#logger.warn({ err: error }, 'keep-alive ping failed'),
      })
      this.#keepAlive.start()
    }
    ctx.markOpen()
  }

  #end(error: Error): void {
    void this.#ctx?.end(toError(error))
  }
}
