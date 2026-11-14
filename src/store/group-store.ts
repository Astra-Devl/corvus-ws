export interface GroupParticipant {
  id: string
  admin?: 'admin' | 'superadmin' | null | undefined
}

export interface GroupMetadata {
  id: string
  subject?: string | undefined
  subjectOwner?: string | undefined
  subjectTime?: number | undefined
  creation?: number | undefined
  owner?: string | undefined
  desc?: string | undefined
  descId?: string | undefined
  /** Hanya admin yang boleh mengubah info grup. */
  restrict?: boolean | undefined
  /** Hanya admin yang boleh mengirim pesan. */
  announce?: boolean | undefined
  ephemeralDuration?: number | undefined
  participants: GroupParticipant[]
  [extra: string]: unknown
}

export type ParticipantAction = 'add' | 'remove' | 'promote' | 'demote'

export class GroupStore {
  readonly #groups = new Map<string, GroupMetadata>()

  get size(): number {
    return this.#groups.size
  }

  get(id: string): GroupMetadata | undefined {
    return this.#groups.get(id)
  }

  upsert(groups: readonly GroupMetadata[]): string[] {
    for (const g of groups) this.#groups.set(g.id, { ...this.#groups.get(g.id), ...g })
    return groups.map((g) => g.id)
  }

  update(updates: ReadonlyArray<Partial<GroupMetadata> & { id: string }>): string[] {
    const changed: string[] = []
    for (const u of updates) {
      const existing = this.#groups.get(u.id)
      if (!existing) continue
      this.#groups.set(u.id, { ...existing, ...u, participants: u.participants ?? existing.participants })
      changed.push(u.id)
    }
    return changed
  }

  updateParticipants(id: string, participants: readonly string[], action: ParticipantAction): boolean {
    const group = this.#groups.get(id)
    if (!group) return false
    const set = new Set(participants)

    switch (action) {
      case 'add':
        for (const p of participants) if (!group.participants.some((x) => x.id === p)) group.participants.push({ id: p, admin: null })
        break
      case 'remove':
        group.participants = group.participants.filter((p) => !set.has(p.id))
        break
      case 'promote':
      case 'demote':
        for (const p of group.participants) if (set.has(p.id)) p.admin = action === 'promote' ? 'admin' : null
        break
    }
    return true
  }

  delete(ids: readonly string[]): string[] {
    return ids.filter((id) => this.#groups.delete(id))
  }

  list(): GroupMetadata[] {
    return [...this.#groups.values()]
  }

  clear(): void {
    this.#groups.clear()
  }

  toJSON(): GroupMetadata[] {
    return this.list()
  }
}
