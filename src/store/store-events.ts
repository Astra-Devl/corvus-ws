import type { MessageKey } from '../messages/message-key.js'
import type { MessageReaction, UserReceipt, WAMessage } from '../messages/message-utils.js'
import type { Chat } from './chat-store.js'
import type { Contact } from './contact-store.js'
import type { GroupMetadata } from './group-store.js'
import type { PresenceData } from './session-store.js'

/** Event perubahan yang dipancarkan store sendiri. */
export interface StoreEventMap {
  'chats.changed': { ids: string[] }
  'contacts.changed': { ids: string[] }
  'groups.changed': { ids: string[] }
  'messages.changed': { jid: string; ids: string[] }
  'presence.changed': { id: string }
  cleared: undefined
}

/**
 * Kontrak payload event socket yang dipakai store. Layer yang memancarkan
 * event (messages/, groups/, dst.) harus mengikuti bentuk ini.
 */
export interface MessagesUpsertPayload {
  messages: WAMessage[]
  type: 'notify' | 'append'
}
export type MessagesUpdatePayload = Array<{ key: MessageKey; update: Partial<WAMessage> }>
export type MessagesDeletePayload = { keys: MessageKey[] } | { jid: string; all: true }
export type MessagesReactionPayload = Array<{ key: MessageKey; reaction: MessageReaction }>
export type ReceiptUpdatePayload = Array<{ key: MessageKey; receipt: UserReceipt }>
export type ChatUpdate = Partial<Chat> & { id: string }
export type ContactUpdate = Partial<Contact> & { id: string }
export type GroupUpdate = Partial<GroupMetadata> & { id: string }
export interface GroupParticipantsUpdatePayload {
  id: string
  participants: string[]
  action: 'add' | 'remove' | 'promote' | 'demote'
}
export interface PresenceUpdatePayload {
  id: string
  presences: Record<string, PresenceData>
}
export interface HistorySetPayload {
  chats?: Chat[]
  contacts?: Contact[]
  messages?: WAMessage[]
  isLatest?: boolean
}
