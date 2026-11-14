import type { MessageKey } from '../messages/message-key.js'
import type { WAMessage } from '../messages/message-utils.js'
import type { ChatUpdate } from '../store/store-events.js'

/** WhatsApp menandai chat "belum dibaca" dengan `unreadCount = -1`. */
export const readUpdate = (jid: string, read: boolean): ChatUpdate => ({ id: jid, unreadCount: read ? 0 : -1 })

/** Kunci pesan masuk yang belum dibaca (maksimal `unreadCount` terakhir). */
export function unreadKeys(messages: readonly WAMessage[], unreadCount: number): MessageKey[] {
  if (unreadCount <= 0) return []
  return messages
    .filter((m) => !m.key.fromMe)
    .slice(-unreadCount)
    .map((m) => m.key)
}
