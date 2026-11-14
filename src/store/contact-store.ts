export interface Contact {
  id: string
  lid?: string | undefined
  /** Nama dari buku kontak. */
  name?: string | undefined
  /** Nama tampilan (push name) yang diatur kontak itu sendiri. */
  notify?: string | undefined
  verifiedName?: string | undefined
  imgUrl?: string | null | undefined
  status?: string | undefined
  [extra: string]: unknown
}

export class ContactStore {
  readonly #contacts = new Map<string, Contact>()

  get size(): number {
    return this.#contacts.size
  }

  get(id: string): Contact | undefined {
    return this.#contacts.get(id)
  }

  upsert(contacts: readonly Contact[]): string[] {
    for (const c of contacts) this.#contacts.set(c.id, { ...this.#contacts.get(c.id), ...c })
    return contacts.map((c) => c.id)
  }

  update(updates: ReadonlyArray<Partial<Contact> & { id: string }>): string[] {
    const changed: string[] = []
    for (const u of updates) {
      const existing = this.#contacts.get(u.id)
      if (!existing) continue
      this.#contacts.set(u.id, { ...existing, ...u })
      changed.push(u.id)
    }
    return changed
  }

  delete(ids: readonly string[]): string[] {
    return ids.filter((id) => this.#contacts.delete(id))
  }

  /** Nama terbaik yang diketahui: buku kontak, lalu push name, lalu nama terverifikasi. */
  getName(id: string): string | undefined {
    const c = this.#contacts.get(id)
    return c?.name ?? c?.notify ?? c?.verifiedName
  }

  /** Cari berdasarkan potongan nama atau nomor (tidak peka huruf besar). */
  search(query: string): Contact[] {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return [...this.#contacts.values()].filter((c) =>
      [c.id, c.name, c.notify, c.verifiedName].some((v) => typeof v === 'string' && v.toLowerCase().includes(q)),
    )
  }

  list(): Contact[] {
    return [...this.#contacts.values()]
  }

  clear(): void {
    this.#contacts.clear()
  }

  toJSON(): Contact[] {
    return this.list()
  }
}
