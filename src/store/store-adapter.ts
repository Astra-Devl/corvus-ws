import type { WAMessage } from '../messages/message-utils.js'
import type { Chat } from './chat-store.js'
import type { Contact } from './contact-store.js'
import type { GroupMetadata } from './group-store.js'

export const SNAPSHOT_VERSION = 1

export interface StoreSnapshot {
  version: typeof SNAPSHOT_VERSION
  chats: Chat[]
  contacts: Contact[]
  groups: GroupMetadata[]
  messages: Record<string, WAMessage[]>
}

/** Backend penyimpanan snapshot (file, database, dll.). */
export interface StoreAdapter {
  load(): Promise<StoreSnapshot | undefined>
  save(snapshot: StoreSnapshot): Promise<void>
  close?(): Promise<void>
}

/** Adapter di memori, berguna untuk test. */
export class MemoryStoreAdapter implements StoreAdapter {
  #snapshot: string | undefined
  saves = 0

  async load(): Promise<StoreSnapshot | undefined> {
    return this.#snapshot === undefined ? undefined : (JSON.parse(this.#snapshot) as StoreSnapshot)
  }

  async save(snapshot: StoreSnapshot): Promise<void> {
    this.saves++
    this.#snapshot = JSON.stringify(snapshot)
  }
}
