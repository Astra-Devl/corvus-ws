export interface Chat {
  id: string
  name?: string | undefined
  unreadCount?: number | undefined
  archived?: boolean | undefined
  /** Waktu pin (epoch detik); `undefined`/`0` = tidak di-pin. */
  pinned?: number | undefined
  muteEndTime?: number | undefined
  conversationTimestamp?: number | undefined
  readOnly?: boolean | undefined
  ephemeralExpiration?: number | undefined
  [extra: string]: unknown
}

export class ChatStore {
  readonly #chats = new Map<string, Chat>()

  get size(): number {
    return this.#chats.size
  }

  get(id: string): Chat | undefined {
    return this.#chats.get(id)
  }

  has(id: string): boolean {
    return this.#chats.has(id)
  }

  /** Tambah atau gabungkan chat. Mengembalikan id yang berubah. */
  upsert(chats: readonly Chat[]): string[] {
    for (const chat of chats) this.#chats.set(chat.id, { ...this.#chats.get(chat.id), ...chat })
    return chats.map((c) => c.id)
  }

  /** Gabungkan perubahan ke chat yang ada (yang tidak ada diabaikan). */
  update(updates: ReadonlyArray<Partial<Chat> & { id: string }>): string[] {
    const changed: string[] = []
    for (const update of updates) {
      const existing = this.#chats.get(update.id)
      if (!existing) continue
      this.#chats.set(update.id, { ...existing, ...update })
      changed.push(update.id)
    }
    return changed
  }

  delete(ids: readonly string[]): string[] {
    return ids.filter((id) => this.#chats.delete(id))
  }

  /** Chat yang di-pin dulu, lalu berdasarkan aktivitas terbaru. */
  list(): Chat[] {
    return [...this.#chats.values()].sort(
      (a, b) =>
        (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) ||
        (b.pinned ?? 0) - (a.pinned ?? 0) ||
        (b.conversationTimestamp ?? 0) - (a.conversationTimestamp ?? 0),
    )
  }

  clear(): void {
    this.#chats.clear()
  }

  toJSON(): Chat[] {
    return [...this.#chats.values()]
  }
}
