import { TypedEventEmitter, type Unsubscribe } from '../core/event-emitter.js'
import type { ConnectionUpdate, CorvusEventMap } from '../core/event-mapping.js'
import type { MessageKey } from '../messages/message-key.js'
import { isGroupJid, type WAMessage } from '../messages/message-utils.js'
import { ChatStore, type Chat } from './chat-store.js'
import { ContactStore } from './contact-store.js'
import { GroupStore } from './group-store.js'
import { MessageStore, type MessageStoreOptions } from './message-store.js'
import { SessionStore } from './session-store.js'
import { SNAPSHOT_VERSION, type StoreSnapshot } from './store-adapter.js'
import type {
  ChatUpdate,
  ContactUpdate,
  GroupParticipantsUpdatePayload,
  GroupUpdate,
  HistorySetPayload,
  MessagesDeletePayload,
  MessagesReactionPayload,
  MessagesUpdatePayload,
  MessagesUpsertPayload,
  PresenceUpdatePayload,
  ReceiptUpdatePayload,
  StoreEventMap,
} from './store-events.js'
import type { Contact } from './contact-store.js'

export interface InMemoryStoreOptions {
  messages?: MessageStoreOptions
}

/** Store lengkap di memori yang mengikuti event socket. */
export class InMemoryStore {
  readonly chats = new ChatStore()
  readonly contacts = new ContactStore()
  readonly groups = new GroupStore()
  readonly messages: MessageStore
  readonly session = new SessionStore()
  readonly events = new TypedEventEmitter<StoreEventMap>()

  constructor(options: InMemoryStoreOptions = {}) {
    this.messages = new MessageStore(options.messages)
  }

  /** Ikuti event dari `socket.ev`. Mengembalikan fungsi untuk berhenti. */
  bind(ev: TypedEventEmitter<CorvusEventMap>): Unsubscribe {
    const offs: Unsubscribe[] = [
      ev.on('connection.update', (u) => this.session.applyConnectionUpdate(u as ConnectionUpdate)),
      ev.on('creds.update', (u) => {
        const me = u.me as { id: string; lid?: string; name?: string } | undefined
        if (me) this.session.me = me
      }),
      ev.on('chats.upsert', (c) => this.#chatsChanged(this.chats.upsert(c as Chat[]))),
      ev.on('chats.update', (c) => this.#chatsChanged(this.chats.update(c as ChatUpdate[]))),
      ev.on('chats.delete', (ids) => {
        const removed = this.chats.delete(ids)
        for (const id of removed) this.messages.clearChat(id)
        this.#chatsChanged(removed)
      }),
      ev.on('contacts.upsert', (c) => this.#contactsChanged(this.contacts.upsert(c as Contact[]))),
      ev.on('contacts.update', (c) => this.#contactsChanged(this.contacts.update(c as ContactUpdate[]))),
      ev.on('groups.upsert', (g) => this.#groupsChanged(this.groups.upsert(g as never[]))),
      ev.on('groups.update', (g) => this.#groupsChanged(this.groups.update(g as GroupUpdate[]))),
      ev.on('group-participants.update', (p) => {
        const { id, participants, action } = p as unknown as GroupParticipantsUpdatePayload
        if (this.groups.updateParticipants(id, participants, action)) this.#groupsChanged([id])
      }),
      ev.on('presence.update', (p) => {
        const { id, presences } = p as unknown as PresenceUpdatePayload
        this.session.setPresences(id, presences)
        this.events.emit('presence.changed', { id })
      }),
      ev.on('messages.upsert', (p) => this.#onUpsert(p as unknown as MessagesUpsertPayload)),
      ev.on('messages.update', (u) => this.#onUpdate(u as unknown as MessagesUpdatePayload)),
      ev.on('messages.delete', (d) => this.#onDelete(d as unknown as MessagesDeletePayload)),
      ev.on('messages.reaction', (r) => {
        for (const { key, reaction } of r as unknown as MessagesReactionPayload) {
          if (this.messages.addReaction(key, reaction)) this.#messagesChanged(key.remoteJid, [key.id])
        }
      }),
      ev.on('message-receipt.update', (r) => {
        for (const { key, receipt } of r as unknown as ReceiptUpdatePayload) {
          if (this.messages.addReceipt(key, receipt)) this.#messagesChanged(key.remoteJid, [key.id])
        }
      }),
      ev.on('history.set', (h) => this.#onHistory(h as unknown as HistorySetPayload)),
    ]
    return () => offs.forEach((off) => off())
  }

  /** Pesan dari store (mis. untuk quote/retry). */
  loadMessage(key: MessageKey): WAMessage | undefined {
    return this.messages.get(key)
  }

  toSnapshot(): StoreSnapshot {
    return {
      version: SNAPSHOT_VERSION,
      chats: this.chats.toJSON(),
      contacts: this.contacts.toJSON(),
      groups: this.groups.toJSON(),
      messages: this.messages.toJSON(),
    }
  }

  loadSnapshot(snapshot: StoreSnapshot): void {
    this.chats.upsert(snapshot.chats)
    this.contacts.upsert(snapshot.contacts)
    this.groups.upsert(snapshot.groups)
    for (const list of Object.values(snapshot.messages)) for (const m of list) this.messages.upsert(m)
  }

  clear(): void {
    this.chats.clear()
    this.contacts.clear()
    this.groups.clear()
    this.messages.clear()
    this.session.clear()
    this.events.emit('cleared', undefined)
  }

  // ---- handler ----

  #onUpsert({ messages, type }: MessagesUpsertPayload): void {
    const byJid = new Map<string, string[]>()
    for (const message of messages) {
      const jid = message.key.remoteJid
      this.messages.upsert(message)
      byJid.set(jid, [...(byJid.get(jid) ?? []), message.key.id])

      const existing = this.chats.get(jid)
      const unread = type === 'notify' && !message.key.fromMe ? 1 : 0
      this.chats.upsert([
        {
          id: jid,
          conversationTimestamp: Math.max(existing?.conversationTimestamp ?? 0, message.messageTimestamp ?? 0) || undefined,
          unreadCount: (existing?.unreadCount ?? 0) + unread,
        },
      ])
      this.#chatsChanged([jid])

      // push name pengirim -> kontak
      const sender = isGroupJid(jid) ? (message.key.participant ?? message.participant) : jid
      if (message.pushName && sender && !message.key.fromMe) {
        this.contacts.upsert([{ id: sender, notify: message.pushName }])
        this.#contactsChanged([sender])
      }
    }
    for (const [jid, ids] of byJid) this.#messagesChanged(jid, ids)
  }

  #onUpdate(updates: MessagesUpdatePayload): void {
    for (const { key, update } of updates) {
      if (this.messages.update(key, update)) this.#messagesChanged(key.remoteJid, [key.id])
    }
  }

  #onDelete(payload: MessagesDeletePayload): void {
    if ('all' in payload) {
      this.messages.clearChat(payload.jid)
      this.#messagesChanged(payload.jid, [])
      return
    }
    this.messages.delete(payload.keys)
    for (const key of payload.keys) this.#messagesChanged(key.remoteJid, [key.id])
  }

  #onHistory({ chats = [], contacts = [], messages = [] }: HistorySetPayload): void {
    this.#chatsChanged(this.chats.upsert(chats))
    this.#contactsChanged(this.contacts.upsert(contacts))
    for (const m of messages) this.messages.upsert(m)
    for (const jid of new Set(messages.map((m) => m.key.remoteJid))) this.#messagesChanged(jid, [])
  }

  #chatsChanged(ids: string[]): void {
    if (ids.length) this.events.emit('chats.changed', { ids })
  }
  #contactsChanged(ids: string[]): void {
    if (ids.length) this.events.emit('contacts.changed', { ids })
  }
  #groupsChanged(ids: string[]): void {
    if (ids.length) this.events.emit('groups.changed', { ids })
  }
  #messagesChanged(jid: string, ids: string[]): void {
    this.events.emit('messages.changed', { jid, ids })
  }
}
