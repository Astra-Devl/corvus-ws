import { ChatError } from '../core/errors.js'
import type { MessageKey } from '../messages/message-key.js'
import type { WAMessage } from '../messages/message-utils.js'

export interface MessageRange {
  lastMessageTimestamp: number
  lastSystemMessageTimestamp?: number
  messages: Array<{ key: MessageKey; messageTimestamp: number }>
}

export type ChatModification =
  | { archive: boolean; lastMessages: readonly WAMessage[] }
  /** Epoch ms akhir mute; `-1` = selamanya; `null` = unmute. */
  | { mute: number | null }
  | { pin: boolean }
  | { markRead: boolean; lastMessages: readonly WAMessage[] }
  | { clear: true; lastMessages: readonly WAMessage[] }
  | { delete: true; lastMessages: readonly WAMessage[] }
  | { star: { messages: ReadonlyArray<{ id: string; fromMe?: boolean }>; star: boolean } }

export type AppStatePatchType = 'regular' | 'regular_low' | 'regular_high' | 'critical_block' | 'critical_unblock_low'

/** Deskripsi satu mutasi app-state (dienkripsi & dikirim oleh layer app-state sync). */
export interface AppStatePatch {
  type: AppStatePatchType
  index: string[]
  syncAction: Record<string, unknown>
  apiVersion: number
  operation: 'set' | 'remove'
  timestamp: number
}

/** Backend yang menerapkan patch (belum tersedia di library ini; diisi oleh modul app-state). */
export interface AppStateSync {
  patch(patch: AppStatePatch): Promise<void>
}

export function buildMessageRange(messages: readonly WAMessage[]): MessageRange {
  const usable = messages.filter((m) => m.messageTimestamp !== undefined)
  if (usable.length === 0) throw new ChatError('This chat modification needs at least one recent message (lastMessages)')
  return {
    lastMessageTimestamp: Math.max(...usable.map((m) => m.messageTimestamp!)),
    messages: usable.map((m) => ({ key: m.key, messageTimestamp: m.messageTimestamp! })),
  }
}

const bit = (v: boolean | undefined): string => (v ? '1' : '0')

/**
 * Ubah modifikasi chat menjadi patch app-state.
 * CATATAN: indeks, tipe, dan versi API di sini mengikuti pengetahuan tentang
 * protokol dan belum diverifikasi terhadap server.
 */
export function chatModificationToPatch(jid: string, mod: ChatModification, now: number = Date.now()): AppStatePatch {
  const base = { timestamp: now }

  if ('mute' in mod) {
    return {
      ...base, type: 'regular_high', apiVersion: 2, operation: 'set', index: ['mute', jid],
      syncAction: { muteAction: { muted: mod.mute !== null, ...(mod.mute !== null && { muteEndTimestamp: mod.mute }) } },
    }
  }
  if ('pin' in mod) {
    return {
      ...base, type: 'regular_low', apiVersion: 5, operation: mod.pin ? 'set' : 'remove', index: ['pin_v1', jid],
      syncAction: { pinAction: { pinned: mod.pin } },
    }
  }
  if ('archive' in mod) {
    return {
      ...base, type: 'regular_low', apiVersion: 3, operation: 'set', index: ['archive', jid],
      syncAction: { archiveChatAction: { archived: mod.archive, messageRange: buildMessageRange(mod.lastMessages) } },
    }
  }
  if ('markRead' in mod) {
    return {
      ...base, type: 'regular_low', apiVersion: 3, operation: 'set', index: ['markChatAsRead', jid],
      syncAction: { markChatAsReadAction: { read: mod.markRead, messageRange: buildMessageRange(mod.lastMessages) } },
    }
  }
  if ('clear' in mod) {
    return {
      ...base, type: 'regular_high', apiVersion: 6, operation: 'set', index: ['clearChat', jid, '1', '0'],
      syncAction: { clearChatAction: { messageRange: buildMessageRange(mod.lastMessages) } },
    }
  }
  if ('delete' in mod) {
    return {
      ...base, type: 'regular_high', apiVersion: 6, operation: 'set', index: ['deleteChat', jid, '1'],
      syncAction: { deleteChatAction: { messageRange: buildMessageRange(mod.lastMessages) } },
    }
  }
  if ('star' in mod) {
    if (mod.star.messages.length !== 1) throw new ChatError('Star/unstar one message at a time')
    const m = mod.star.messages[0]!
    return {
      ...base, type: 'regular_low', apiVersion: 2, operation: mod.star.star ? 'set' : 'remove',
      index: ['star', jid, m.id, bit(m.fromMe), '0'],
      syncAction: { starAction: { starred: mod.star.star } },
    }
  }
  throw new ChatError('Unsupported chat modification')
}
