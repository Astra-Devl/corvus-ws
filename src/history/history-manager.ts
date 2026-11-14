import { noopLogger } from '../core/defaults.js'
import { HistoryError, toError } from '../core/errors.js'
import { TypedEventEmitter, type Unsubscribe } from '../core/event-emitter.js'
import type { CorvusEventMap } from '../core/event-mapping.js'
import type { Logger } from '../core/socket-config.js'
import type { DownloadOptions } from '../media/media-download.js'
import { buildReceiptNode } from '../messages/message-receipt.js'
import { normalizeMessageContent, type WAMessage } from '../messages/message-utils.js'
import type { BinaryNode } from '../protocol/protocol-types.js'
import type { HistoryEventMap, HistoryResult, HistorySyncNotification } from './history-events.js'
import { fetchHistoryBlob, processHistoryData, type HistoryDecoder } from './history-sync.js'

export interface HistoryManagerOptions {
  decode: HistoryDecoder
  /** Ganti cara mengambil blob (default: unduh + dekripsi + inflate). */
  fetchBlob?: (notification: HistorySyncNotification) => Promise<Buffer>
  download?: DownloadOptions
  ev?: TypedEventEmitter<CorvusEventMap>
  /** Kirim receipt `hist_sync` (mis. `engine.sendNode`). */
  sendNode?: (node: BinaryNode) => Promise<void>
  /** Saring jenis sinkronisasi yang diproses (default: semua). */
  shouldSync?: (notification: HistorySyncNotification) => boolean
  /** Kunci pesan yang sudah diproses, agar tidak diproses ulang (mis. dari creds). */
  isProcessed?: (key: string) => boolean
  markProcessed?: (key: string) => void
  logger?: Logger
}

const keyOf = (m: WAMessage): string => `${m.key.remoteJid}|${m.key.id}`

/** Memproses notifikasi sinkronisasi riwayat dan memancarkan `history.set`. */
export class HistoryManager {
  readonly events = new TypedEventEmitter<HistoryEventMap>()

  readonly #opts: HistoryManagerOptions
  readonly #logger: Logger
  readonly #seen = new Set<string>()

  constructor(options: HistoryManagerOptions) {
    this.#opts = options
    this.#logger = options.logger ?? noopLogger
  }

  /** Dengarkan `messages.upsert` pada `ev` dan proses pesan sinkronisasi riwayat. */
  attach(ev: TypedEventEmitter<CorvusEventMap>): Unsubscribe {
    return ev.on('messages.upsert', async (payload) => {
      for (const message of (payload as unknown as { messages: WAMessage[] }).messages) {
        const notification = HistoryManager.notificationOf(message)
        if (!notification) continue
        await this.handleMessage(message).catch((error: unknown) => this.#logger.error({ err: error }, 'history sync failed'))
      }
    })
  }

  static notificationOf(message: WAMessage): HistorySyncNotification | undefined {
    return normalizeMessageContent(message.message)?.protocolMessage?.historySyncNotification as HistorySyncNotification | undefined
  }

  /** Proses satu pesan; `undefined` bila bukan sinkronisasi riwayat / dilewati. */
  async handleMessage(message: WAMessage): Promise<HistoryResult | undefined> {
    const notification = HistoryManager.notificationOf(message)
    if (!notification) return undefined

    const key = keyOf(message)
    const acknowledge = (): Promise<void> | undefined =>
      this.#opts.sendNode?.(buildReceiptNode({ jid: message.key.remoteJid, messageIds: [message.key.id], type: 'hist_sync' }))

    if (this.#seen.has(key) || this.#opts.isProcessed?.(key)) {
      this.events.emit('history.skipped', { key, reason: 'already-processed' })
      await acknowledge()
      return undefined
    }
    if (this.#opts.shouldSync && !this.#opts.shouldSync(notification)) {
      this.events.emit('history.skipped', { key, reason: 'filtered' })
      await acknowledge()
      return undefined
    }

    let result: HistoryResult
    try {
      const blob = await (this.#opts.fetchBlob?.(notification) ?? fetchHistoryBlob(notification, this.#opts.download))
      result = processHistoryData(this.#opts.decode(blob))
    } catch (error) {
      const err = error instanceof HistoryError ? error : new HistoryError('Failed to process history sync', { cause: toError(error) })
      this.events.emit('history.error', { key, error: err })
      throw err
    }

    this.#seen.add(key)
    this.#opts.markProcessed?.(key)
    this.#opts.ev?.emit('history.set', {
      chats: result.chats,
      contacts: result.contacts,
      messages: result.messages,
      isLatest: result.isLatest,
    } as unknown as Record<string, unknown>)
    this.events.emit('history.processed', {
      key,
      syncType: result.syncType,
      progress: result.progress,
      chats: result.chats.length,
      contacts: result.contacts.length,
      messages: result.messages.length,
    })
    await acknowledge()
    return result
  }
}
