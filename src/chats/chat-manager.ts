import { ChatError } from '../core/errors.js'
import type { TypedEventEmitter } from '../core/event-emitter.js'
import type { CorvusEventMap } from '../core/event-mapping.js'
import type { MessageKey } from '../messages/message-key.js'
import type { WAMessage } from '../messages/message-utils.js'
import type { ChatUpdate } from '../store/store-events.js'
import { archiveUpdate } from './chat-archive.js'
import { clearEvents, deleteEvents } from './chat-delete.js'
import { chatModificationToPatch, type AppStateSync, type ChatModification } from './chat-modify.js'
import { muteEndTime, muteUpdate, type MuteDuration } from './chat-mute.js'
import { pinUpdate } from './chat-pin.js'
import { readUpdate, unreadKeys } from './chat-read.js'

/** Jumlah pesan terakhir yang diperiksa saat mencari pesan masuk yang belum dibaca. */
const READ_WINDOW = 1000

export interface ChatManagerOptions {
  /** Backend app-state; tanpa ini operasi yang mengubah chat akan gagal dengan error jelas. */
  sync?: AppStateSync
  ev?: TypedEventEmitter<CorvusEventMap>
  /** Pesan terbaru sebuah chat (urut lama -> baru), mis. dari `store.messages.list`. */
  lastMessages?: (jid: string, limit: number) => WAMessage[]
  unreadCount?: (jid: string) => number
  /** Kirim receipt baca untuk kunci tertentu (mis. `MessageSender.readMessages`). */
  readMessages?: (keys: readonly MessageKey[]) => Promise<void>
  now?: () => number
}

/** Operasi tingkat-chat: archive, mute, pin, read, delete, clear, star. */
export class ChatManager {
  readonly #opts: ChatManagerOptions
  readonly #now: () => number

  constructor(options: ChatManagerOptions = {}) {
    this.#opts = options
    this.#now = options.now ?? Date.now
  }

  async #apply(jid: string, mod: ChatModification): Promise<void> {
    if (!this.#opts.sync) {
      throw new ChatError('Chat modifications need an AppStateSync backend (not configured)', { code: 'ERR_NOT_CONFIGURED' })
    }
    await this.#opts.sync.patch(chatModificationToPatch(jid, mod, this.#now()))
  }

  #last(jid: string): WAMessage[] {
    const messages = this.#opts.lastMessages?.(jid, 1) ?? []
    if (messages.length === 0) {
      throw new ChatError('No recent messages known for this chat; provide `lastMessages` or load the chat first', { data: { jid } })
    }
    return messages
  }

  #update(update: ChatUpdate): void {
    this.#opts.ev?.emit('chats.update', [update])
  }

  async archive(jid: string, archived = true): Promise<void> {
    await this.#apply(jid, { archive: archived, lastMessages: this.#last(jid) })
    this.#update(archiveUpdate(jid, archived))
  }

  /** `duration` = '8h' | '1w' | 'always' | ms; `null` untuk unmute. */
  async mute(jid: string, duration: MuteDuration | null): Promise<void> {
    const end = duration === null ? null : muteEndTime(duration, this.#now())
    await this.#apply(jid, { mute: end })
    this.#update(muteUpdate(jid, end))
  }

  async pin(jid: string, pinned = true): Promise<void> {
    await this.#apply(jid, { pin: pinned })
    this.#update(pinUpdate(jid, pinned, this.#now()))
  }

  /** Tandai chat sudah dibaca (dan kirim receipt untuk pesan masuk yang belum dibaca) atau belum dibaca. */
  async markRead(jid: string, read = true): Promise<void> {
    if (read && this.#opts.readMessages && this.#opts.lastMessages) {
      const count = this.#opts.unreadCount?.(jid) ?? 0
      // pesan keluar bisa terselip di antara pesan yang belum dibaca, jadi ambil jendela lebar
      const keys = unreadKeys(this.#opts.lastMessages(jid, READ_WINDOW), count)
      if (keys.length > 0) await this.#opts.readMessages(keys)
    }
    await this.#apply(jid, { markRead: read, lastMessages: this.#last(jid) })
    this.#update(readUpdate(jid, read))
  }

  async delete(jid: string): Promise<void> {
    await this.#apply(jid, { delete: true, lastMessages: this.#last(jid) })
    const events = deleteEvents(jid)
    this.#opts.ev?.emit('messages.delete', events.messagesDelete)
    this.#opts.ev?.emit('chats.delete', events.chatsDelete)
  }

  async clear(jid: string): Promise<void> {
    await this.#apply(jid, { clear: true, lastMessages: this.#last(jid) })
    this.#opts.ev?.emit('messages.delete', clearEvents(jid).messagesDelete)
  }

  async star(jid: string, key: Pick<MessageKey, 'id' | 'fromMe'>, starred = true): Promise<void> {
    await this.#apply(jid, { star: { messages: [{ id: key.id, fromMe: key.fromMe }], star: starred } })
  }
}
