import { ProtocolError, TimeoutError } from '../core/errors.js'
import type { Unsubscribe } from '../core/event-emitter.js'
import type { Logger } from '../core/socket-config.js'
import { noopLogger } from '../core/defaults.js'
import { matchesFilter } from './binary-node.js'
import { decodeBinaryNode } from './binary-reader.js'
import { encodeBinaryNode } from './binary-writer.js'
import type { BinaryNode, NodeCodec, NodeFilter } from './protocol-types.js'
import { parseIqError } from './stanza-parser.js'
import { createTagGenerator } from './stanza-builder.js'
import { getDefaultTokenDictionary, type TokenDictionary } from './token-dictionary.js'

export type NodeHandler = (node: BinaryNode) => void | Promise<void>

export function createNodeCodec(
  dictionary: TokenDictionary = getDefaultTokenDictionary(),
): NodeCodec {
  return {
    encode: (node) => encodeBinaryNode(node, dictionary),
    decode: (data) => decodeBinaryNode(data, dictionary),
  }
}

export interface ProtocolEngineOptions {
  /** Mengirim node ke server (biasanya via StreamHandler). */
  send: (node: BinaryNode) => Promise<void>
  dictionary?: TokenDictionary
  logger?: Logger
  defaultTimeoutMs?: number
  generateTag?: () => string
}

interface Pending {
  resolve: (node: BinaryNode) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

/**
 * Menghubungkan codec, routing node masuk, dan korelasi request/response
 * (`query`) berdasarkan atribut `id`.
 */
export class ProtocolEngine {
  readonly codec: NodeCodec
  readonly generateTag: () => string

  readonly #send: (node: BinaryNode) => Promise<void>
  readonly #logger: Logger
  readonly #defaultTimeoutMs: number
  readonly #handlers = new Set<{ filter: NodeFilter; handler: NodeHandler }>()
  readonly #anyHandlers = new Set<NodeHandler>()
  readonly #pending = new Map<string, Pending>()

  constructor(options: ProtocolEngineOptions) {
    this.#send = options.send
    this.#logger = options.logger ?? noopLogger
    this.#defaultTimeoutMs = options.defaultTimeoutMs ?? 60_000
    this.generateTag = options.generateTag ?? createTagGenerator()
    this.codec = createNodeCodec(options.dictionary)
  }

  get pendingCount(): number {
    return this.#pending.size
  }

  /** Daftarkan handler untuk node yang cocok dengan `filter`. */
  on(filter: NodeFilter, handler: NodeHandler): Unsubscribe {
    const entry = { filter, handler }
    this.#handlers.add(entry)
    return () => {
      this.#handlers.delete(entry)
    }
  }

  onAny(handler: NodeHandler): Unsubscribe {
    this.#anyHandlers.add(handler)
    return () => {
      this.#anyHandlers.delete(handler)
    }
  }

  sendNode(node: BinaryNode): Promise<void> {
    return this.#send(node)
  }

  /** Kirim node dan tunggu respons ber-`id` sama. */
  async query(node: BinaryNode, timeoutMs: number = this.#defaultTimeoutMs): Promise<BinaryNode> {
    const id = node.attrs.id ?? this.generateTag()
    if (this.#pending.has(id)) throw new ProtocolError(`Duplicate query id: ${id}`)
    const request: BinaryNode = node.attrs.id ? node : { ...node, attrs: { ...node.attrs, id } }

    const response = new Promise<BinaryNode>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#pending.delete(id)
        reject(new TimeoutError(`Query ${id} timed out after ${timeoutMs}ms`, { timeoutMs }))
      }, timeoutMs)
      this.#pending.set(id, { resolve, reject, timer })
    })

    try {
      await this.#send(request)
    } catch (error) {
      const pending = this.#pending.get(id)
      if (pending) clearTimeout(pending.timer)
      this.#pending.delete(id)
      throw error
    }
    return response
  }

  /** Tunggu node masuk berikutnya yang cocok dengan `filter`. */
  waitForNode(filter: NodeFilter, timeoutMs: number = this.#defaultTimeoutMs): Promise<BinaryNode> {
    return new Promise<BinaryNode>((resolve, reject) => {
      const off = this.on(filter, (node) => {
        clearTimeout(timer)
        off()
        resolve(node)
      })
      const timer = setTimeout(() => {
        off()
        reject(new TimeoutError('Timed out waiting for node', { timeoutMs }))
      }, timeoutMs)
    })
  }

  /** Dipanggil untuk setiap node dari server. */
  handleNode(node: BinaryNode): void {
    this.#settlePending(node)

    for (const { filter, handler } of [...this.#handlers]) {
      if (matchesFilter(node, filter)) this.#invoke(handler, node)
    }
    for (const handler of [...this.#anyHandlers]) this.#invoke(handler, node)
  }

  /** Gagalkan semua query yang masih menunggu (mis. koneksi putus). */
  rejectAll(error: Error): void {
    for (const [id, pending] of this.#pending) {
      clearTimeout(pending.timer)
      this.#pending.delete(id)
      pending.reject(error)
    }
  }

  #settlePending(node: BinaryNode): void {
    const id = node.attrs.id
    if (id === undefined) return
    const pending = this.#pending.get(id)
    if (!pending) return

    // iq masuk bertipe get/set adalah permintaan server, bukan jawaban
    if (node.tag === 'iq' && node.attrs.type !== 'result' && node.attrs.type !== 'error') return

    clearTimeout(pending.timer)
    this.#pending.delete(id)

    const error = parseIqError(node)
    if (error) {
      pending.reject(new ProtocolError(error.text, { statusCode: error.code, data: { node } }))
    } else {
      pending.resolve(node)
    }
  }

  #invoke(handler: NodeHandler, node: BinaryNode): void {
    try {
      const result = handler(node)
      if (result && typeof (result as Promise<void>).then === 'function') {
        ;(result as Promise<void>).catch((err: unknown) =>
          this.#logger.error({ err, tag: node.tag }, 'node handler failed'),
        )
      }
    } catch (err) {
      this.#logger.error({ err, tag: node.tag }, 'node handler failed')
    }
  }
}
