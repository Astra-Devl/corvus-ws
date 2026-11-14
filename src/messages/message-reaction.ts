import type { MessageKey } from './message-key.js'
import type { MessageContent } from './message-utils.js'

/** Reaksi emoji pada pesan; `emoji` kosong menghapus reaksi. */
export function buildReactionMessage(key: MessageKey, emoji: string, timestampMs = Date.now()): MessageContent {
  return { reactionMessage: { key, text: emoji, senderTimestampMs: timestampMs } }
}
