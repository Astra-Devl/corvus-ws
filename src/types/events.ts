import type { AuthCreds } from '../auth/credentials.js'
import type { CallInfo } from '../calls/call-types.js'
import type { ConnectionUpdate, CorvusEventMap } from '../core/event-mapping.js'
import type { GroupParticipantsEvent } from '../groups/group-events.js'
import type {
  ChatUpdate,
  ContactUpdate,
  GroupUpdate,
  HistorySetPayload,
  MessagesDeletePayload,
  MessagesReactionPayload,
  MessagesUpdatePayload,
  MessagesUpsertPayload,
  PresenceUpdatePayload,
  ReceiptUpdatePayload,
} from '../store/store-events.js'
import type { Chat } from '../store/chat-store.js'
import type { Contact } from '../store/contact-store.js'
import type { GroupMetadata } from '../store/group-store.js'

/**
 * Peta event dengan tipe payload yang tepat. `CorvusEventMap` di `core/` sengaja
 * longgar (agar core tidak bergantung ke layer atas); inilah tampilan publiknya.
 */
export interface CorvusEvents {
  'connection.update': ConnectionUpdate
  'creds.update': Partial<AuthCreds>
  'messages.upsert': MessagesUpsertPayload
  'messages.update': MessagesUpdatePayload
  'messages.delete': MessagesDeletePayload
  'messages.reaction': MessagesReactionPayload
  'message-receipt.update': ReceiptUpdatePayload
  'chats.upsert': Chat[]
  'chats.update': ChatUpdate[]
  'chats.delete': string[]
  'contacts.upsert': Contact[]
  'contacts.update': ContactUpdate[]
  'groups.upsert': GroupMetadata[]
  'groups.update': GroupUpdate[]
  'group-participants.update': GroupParticipantsEvent
  'presence.update': PresenceUpdatePayload
  call: CallInfo[]
  'history.set': HistorySetPayload
  error: Error
}

export type CorvusEventName = keyof CorvusEvents

// Pemeriksaan saat kompilasi: kedua peta harus memiliki nama event yang sama.
type Assert<T extends true> = T
type _MissingInPrecise = Assert<Exclude<keyof CorvusEventMap, keyof CorvusEvents> extends never ? true : false>
type _MissingInCore = Assert<Exclude<keyof CorvusEvents, keyof CorvusEventMap> extends never ? true : false>
export type { _MissingInPrecise, _MissingInCore }
