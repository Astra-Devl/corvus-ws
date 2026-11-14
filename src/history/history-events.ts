import type { Chat } from '../store/chat-store.js'
import type { Contact } from '../store/contact-store.js'
import type { WAMessage } from '../messages/message-utils.js'

/** Jenis sinkronisasi riwayat (`HistorySync.SyncType`). */
export const HistorySyncType = {
  INITIAL_BOOTSTRAP: 0,
  INITIAL_STATUS_V3: 1,
  FULL: 2,
  RECENT: 3,
  PUSH_NAME: 4,
  NON_BLOCKING_DATA: 5,
  ON_DEMAND: 6,
} as const

export interface HistorySyncNotification {
  fileSha256?: Uint8Array | null
  fileEncSha256?: Uint8Array | null
  mediaKey?: Uint8Array | null
  directPath?: string | null
  url?: string | null
  fileLength?: number | null
  syncType?: number | null
  chunkOrder?: number | null
  progress?: number | null
  /** Payload kecil yang disertakan langsung (sudah di-zlib), tanpa unduhan. */
  initialHistBootstrapInlinePayload?: Uint8Array | null
}

/** Bentuk `HistorySync` setelah di-decode (subset yang dipakai). */
export interface HistorySyncData {
  syncType?: number
  progress?: number
  chunkOrder?: number
  conversations?: Array<
    {
      id: string
      messages?: Array<{ message?: WAMessage }>
    } & Record<string, unknown>
  >
  pushnames?: Array<{ id?: string; pushname?: string }>
}

export interface HistoryResult {
  syncType: number | undefined
  progress: number | undefined
  chunkOrder: number | undefined
  chats: Chat[]
  contacts: Contact[]
  messages: WAMessage[]
  /** Heuristik: chunk terakhir (progress 100). */
  isLatest: boolean
}

export interface HistoryEventMap {
  'history.processed': { key: string; syncType: number | undefined; progress: number | undefined; chats: number; contacts: number; messages: number }
  'history.skipped': { key: string; reason: 'already-processed' | 'filtered' }
  'history.error': { key: string; error: Error }
}
