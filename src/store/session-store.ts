import type { ConnectionUpdate } from '../core/event-mapping.js'

export type PresenceType = 'unavailable' | 'available' | 'composing' | 'recording' | 'paused'

export interface PresenceData {
  lastKnownPresence: PresenceType
  lastSeen?: number | undefined
}

/** Keadaan sesi saat ini: koneksi, akun sendiri, dan presence. */
export class SessionStore {
  connection: ConnectionUpdate['connection'] | undefined
  me: { id: string; lid?: string | undefined; name?: string | undefined } | undefined
  isOnline: boolean | undefined
  readonly #presences = new Map<string, Record<string, PresenceData>>()

  applyConnectionUpdate(update: ConnectionUpdate): void {
    if (update.connection !== undefined) this.connection = update.connection
    if (update.isOnline !== undefined) this.isOnline = update.isOnline
  }

  setPresences(chatId: string, presences: Record<string, PresenceData>): void {
    this.#presences.set(chatId, { ...this.#presences.get(chatId), ...presences })
  }

  getPresences(chatId: string): Record<string, PresenceData> | undefined {
    return this.#presences.get(chatId)
  }

  clear(): void {
    this.connection = undefined
    this.me = undefined
    this.isOnline = undefined
    this.#presences.clear()
  }
}
