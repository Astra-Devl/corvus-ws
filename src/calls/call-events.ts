import { noopLogger } from '../core/defaults.js'
import type { Logger } from '../core/socket-config.js'
import type { SocketContext, SocketModule } from '../core/socket.js'
import { getChild } from '../protocol/binary-node.js'
import type { ProtocolEngine } from '../protocol/protocol-engine.js'
import type { BinaryNode } from '../protocol/protocol-types.js'
import type { CallInfo, CallStatus } from './call-types.js'

const STATUS_BY_TAG: Record<string, CallStatus> = {
  offer: 'offer',
  offer_notice: 'offer',
  reject: 'reject',
  accept: 'accept',
}

/** Terjemahkan node `<call>` menjadi `CallInfo`; `undefined` bila tidak ada info panggilan. */
export function parseCallNode(node: BinaryNode): CallInfo | undefined {
  const info = Array.isArray(node.content) ? node.content[0] : undefined
  const id = info?.attrs['call-id']
  if (!info || !id) return undefined

  const from = info.attrs.from ?? info.attrs['call-creator'] ?? node.attrs.from ?? ''
  const status: CallStatus =
    info.tag === 'terminate' ? (info.attrs.reason === 'timeout' ? 'timeout' : 'terminate') : (STATUS_BY_TAG[info.tag] ?? 'ringing')
  const groupJid = info.attrs['group-jid']
  const date = Number(node.attrs.t)

  return {
    id,
    chatId: groupJid ?? node.attrs.from ?? from,
    from,
    date: Number.isFinite(date) && node.attrs.t !== undefined ? date : Math.floor(Date.now() / 1000),
    isVideo: !!getChild(info, 'video'),
    isGroup: info.attrs.type === 'group' || groupJid !== undefined,
    status,
    offline: node.attrs.offline !== undefined,
    groupJid,
    reason: info.attrs.reason,
  }
}

export interface CallEventsOptions {
  engine: Pick<ProtocolEngine, 'on' | 'sendNode'>
  /** Dipanggil untuk setiap pembaruan panggilan (mis. `CallManager.handle`). */
  onCall?: (call: CallInfo) => void
  logger?: Logger
}

/** Modul socket: ubah node `<call>` menjadi event `call` dan kirim ack. */
export class CallEventsModule implements SocketModule {
  readonly name = 'call-events'
  readonly #opts: CallEventsOptions
  readonly #logger: Logger
  #ctx: SocketContext | undefined
  #off: (() => void) | undefined

  constructor(options: CallEventsOptions) {
    this.#opts = options
    this.#logger = options.logger ?? noopLogger
  }

  setup(ctx: SocketContext): void {
    this.#ctx = ctx
    if (this.#off) return
    this.#off = this.#opts.engine.on({ tag: 'call' }, (node) => this.#handle(node))
  }

  dispose(): void {
    this.#off?.()
    this.#off = undefined
    this.#ctx = undefined
  }

  async #handle(node: BinaryNode): Promise<void> {
    const call = parseCallNode(node)
    if (call) {
      this.#ctx?.ev.emit('call', [call as unknown as Record<string, unknown>])
      try {
        this.#opts.onCall?.(call)
      } catch (error) {
        this.#logger.error({ err: error }, 'call handler failed')
      }
    }
    if (node.attrs.id && node.attrs.from) {
      await this.#opts.engine.sendNode({ tag: 'ack', attrs: { id: node.attrs.id, to: node.attrs.from, class: 'call' } })
    }
  }
}
