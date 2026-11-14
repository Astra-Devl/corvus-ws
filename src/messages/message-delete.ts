import type { MessageKey } from './message-key.js'
import type { MessageContent } from './message-utils.js'

export const PROTOCOL_TYPE = { REVOKE: 0, MESSAGE_EDIT: 14 } as const

/** Hapus pesan untuk semua orang (revoke). */
export function buildDeleteMessage(key: MessageKey): MessageContent {
  return { protocolMessage: { key, type: PROTOCOL_TYPE.REVOKE } }
}
