import { inflateSync } from 'node:zlib'
import { HistoryError } from '../core/errors.js'
import { downloadMediaToBuffer, type DownloadOptions } from '../media/media-download.js'
import type { WAMessage } from '../messages/message-utils.js'
import type { Chat } from '../store/chat-store.js'
import type { Contact } from '../store/contact-store.js'
import type { HistoryResult, HistorySyncData, HistorySyncNotification } from './history-events.js'

/** Decode bytes `HistorySync` (protobuf WAProto) menjadi objek. */
export type HistoryDecoder = (bytes: Uint8Array) => HistorySyncData

const MAX_INFLATED_BYTES = 256 * 1024 * 1024

export function inflateHistory(data: Uint8Array): Buffer {
  try {
    return inflateSync(data, { maxOutputLength: MAX_INFLATED_BYTES })
  } catch (cause) {
    throw new HistoryError('Failed to inflate history blob', { cause })
  }
}

/** Ambil blob riwayat: inline bila ada, kalau tidak unduh + dekripsi (`md-msg-hist`). */
export async function fetchHistoryBlob(notification: HistorySyncNotification, options: DownloadOptions = {}): Promise<Buffer> {
  if (notification.initialHistBootstrapInlinePayload?.length) {
    return inflateHistory(notification.initialHistBootstrapInlinePayload)
  }
  if (!notification.mediaKey || (!notification.directPath && !notification.url)) {
    throw new HistoryError('History notification has no downloadable blob')
  }
  const encrypted = await downloadMediaToBuffer(
    { url: notification.url, directPath: notification.directPath, mediaKey: notification.mediaKey, fileEncSha256: notification.fileEncSha256 },
    'md-msg-hist',
    options,
  )
  return inflateHistory(encrypted)
}

/** Pisahkan `HistorySync` menjadi chat, kontak (push name), dan pesan. */
export function processHistoryData(data: HistorySyncData): HistoryResult {
  const chats: Chat[] = []
  const messages: WAMessage[] = []

  for (const conversation of data.conversations ?? []) {
    if (!conversation.id) continue
    const { messages: items, ...chat } = conversation
    chats.push(chat as Chat)
    for (const item of items ?? []) {
      const message = item.message
      if (!message?.key) continue
      messages.push({ ...message, key: { ...message.key, remoteJid: message.key.remoteJid || conversation.id } })
    }
  }

  const contacts: Contact[] = (data.pushnames ?? [])
    .filter((p): p is { id: string; pushname: string } => !!p.id && !!p.pushname)
    .map((p) => ({ id: p.id, notify: p.pushname }))

  return {
    syncType: data.syncType,
    progress: data.progress,
    chunkOrder: data.chunkOrder,
    chats,
    contacts,
    messages,
    isLatest: (data.progress ?? 0) >= 100,
  }
}
