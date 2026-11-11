import type { ConnectionStatus } from './socket-state.js'

/**
 * Peta event publik beserta tipe payload-nya.
 *
 * Beberapa payload masih berupa placeholder (`Record<string, unknown>`)
 * dan akan dipersempit setelah `types/` dan `messages/` dibuat.
 */
type Placeholder = Record<string, unknown>

export type ConnectionUpdateStatus = 'connecting' | 'open' | 'close'

export interface ConnectionUpdate {
  connection?: ConnectionUpdateStatus
  lastDisconnect?: { error: Error | undefined; date: Date }
  isNewLogin?: boolean
  qr?: string
  pairingCode?: string
  receivedPendingNotifications?: boolean
  isOnline?: boolean
}

export interface CorvusEventMap {
  'connection.update': ConnectionUpdate
  'creds.update': Placeholder
  'messages.upsert': { messages: Placeholder[]; type: 'notify' | 'append' }
  'messages.update': Placeholder[]
  'messages.delete': Placeholder
  'messages.reaction': Placeholder[]
  'message-receipt.update': Placeholder[]
  'chats.upsert': Placeholder[]
  'chats.update': Placeholder[]
  'chats.delete': string[]
  'contacts.upsert': Placeholder[]
  'contacts.update': Placeholder[]
  'groups.upsert': Placeholder[]
  'groups.update': Placeholder[]
  'group-participants.update': Placeholder
  'presence.update': Placeholder
  'call': Placeholder[]
  'history.set': Placeholder
  'error': Error
}

export type EventName = keyof CorvusEventMap
export type EventPayload<K extends EventName> = CorvusEventMap[K]

export const EVENT_NAMES = [
  'connection.update',
  'creds.update',
  'messages.upsert',
  'messages.update',
  'messages.delete',
  'messages.reaction',
  'message-receipt.update',
  'chats.upsert',
  'chats.update',
  'chats.delete',
  'contacts.upsert',
  'contacts.update',
  'groups.upsert',
  'groups.update',
  'group-participants.update',
  'presence.update',
  'call',
  'history.set',
  'error',
] as const satisfies readonly EventName[]

const EVENT_NAME_SET: ReadonlySet<string> = new Set(EVENT_NAMES)

export function isEventName(value: string): value is EventName {
  return EVENT_NAME_SET.has(value)
}

/** Petakan status internal state machine ke status pada `connection.update`. */
export function toConnectionUpdateStatus(
  status: ConnectionStatus,
): ConnectionUpdateStatus | undefined {
  switch (status) {
    case 'connecting':
      return 'connecting'
    case 'open':
      return 'open'
    case 'closed':
      return 'close'
    default:
      return undefined
  }
}
