import type { MessageKey } from '../messages/message-key.js'
import { isSameKey } from '../messages/message-key.js'
import { isStatusUpgrade } from '../messages/message-status.js'
import type { MessageReaction, UserReceipt, WAMessage } from '../messages/message-utils.js'

interface ChatMessages {
  /** Terurut naik berdasarkan `messageTimestamp`. */
  list: WAMessage[]
  index: Map<string, WAMessage>
}

export interface MessageStoreOptions {
  /** Batas pesan per chat; yang terlama dibuang (default 1000). */
  maxPerChat?: number
}

export interface ListOptions {
  limit?: number
  /** Ambil pesan yang lebih lama dari pesan ini. */
  before?: MessageKey
}

const ts = (m: WAMessage): number => m.messageTimestamp ?? Number.MAX_SAFE_INTEGER

export class MessageStore {
  readonly #chats = new Map<string, ChatMessages>()
  readonly #max: number

  constructor(options: MessageStoreOptions = {}) {
    this.#max = Math.max(options.maxPerChat ?? 1000, 1)
  }

  get chatIds(): string[] {
    return [...this.#chats.keys()]
  }

  count(jid: string): number {
    return this.#chats.get(jid)?.list.length ?? 0
  }

  get(key: MessageKey): WAMessage | undefined {
    const message = this.#chats.get(key.remoteJid)?.index.get(key.id)
    return message && isSameKey(message.key, key) ? message : undefined
  }

  /** Tambah/ganti pesan (berdasarkan id), menjaga urutan waktu. */
  upsert(message: WAMessage): void {
    const chat = this.#chat(message.key.remoteJid)
    const existing = chat.index.get(message.key.id)

    if (existing) {
      Object.assign(existing, message)
      return
    }
    chat.index.set(message.key.id, message)

    // sisipkan dari belakang (kasus umum: pesan terbaru)
    let i = chat.list.length
    while (i > 0 && ts(chat.list[i - 1]!) > ts(message)) i--
    chat.list.splice(i, 0, message)

    while (chat.list.length > this.#max) {
      const dropped = chat.list.shift()!
      chat.index.delete(dropped.key.id)
    }
  }

  /** Gabungkan perubahan. Status hanya diterapkan jika naik. */
  update(key: MessageKey, update: Partial<WAMessage>): boolean {
    const message = this.get(key)
    if (!message) return false
    const { status, key: _ignored, ...rest } = update
    Object.assign(message, rest)
    if (status !== undefined && isStatusUpgrade(message.status, status)) message.status = status
    return true
  }

  delete(keys: readonly MessageKey[]): number {
    let removed = 0
    for (const key of keys) {
      const chat = this.#chats.get(key.remoteJid)
      const message = chat?.index.get(key.id)
      if (!chat || !message) continue
      chat.index.delete(key.id)
      chat.list.splice(chat.list.indexOf(message), 1)
      removed++
    }
    return removed
  }

  clearChat(jid: string): void {
    this.#chats.delete(jid)
  }

  /** Pesan terbaru dulu dibaca dari belakang; hasil terurut naik (lama -> baru). */
  list(jid: string, options: ListOptions = {}): WAMessage[] {
    const chat = this.#chats.get(jid)
    if (!chat) return []
    let end = chat.list.length
    if (options.before) {
      const at = chat.list.findIndex((m) => isSameKey(m.key, options.before!))
      if (at >= 0) end = at
    }
    const start = options.limit === undefined ? 0 : Math.max(end - options.limit, 0)
    return chat.list.slice(start, end)
  }

  /** Pesan terakhir di chat. */
  last(jid: string): WAMessage | undefined {
    return this.#chats.get(jid)?.list.at(-1)
  }

  /** Tambah/ubah reaksi; `text` kosong menghapus reaksi dari pengirim tsb. */
  addReaction(key: MessageKey, reaction: MessageReaction): boolean {
    const message = this.get(key)
    if (!message) return false
    const sender = (r: MessageReaction): string => (r.key.fromMe ? 'me' : (r.key.participant ?? r.key.remoteJid))
    const list = (message.reactions ?? []).filter((r) => sender(r) !== sender(reaction))
    if (reaction.text) list.push(reaction)
    message.reactions = list
    return true
  }

  addReceipt(key: MessageKey, receipt: UserReceipt): boolean {
    const message = this.get(key)
    if (!message) return false
    const receipts = message.userReceipt ?? (message.userReceipt = [])
    const existing = receipts.find((r) => r.userJid === receipt.userJid)
    if (existing) Object.assign(existing, receipt)
    else receipts.push({ ...receipt })
    return true
  }

  clear(): void {
    this.#chats.clear()
  }

  toJSON(): Record<string, WAMessage[]> {
    return Object.fromEntries([...this.#chats].map(([jid, c]) => [jid, c.list]))
  }

  #chat(jid: string): ChatMessages {
    let chat = this.#chats.get(jid)
    if (!chat) {
      chat = { list: [], index: new Map() }
      this.#chats.set(jid, chat)
    }
    return chat
  }
}
