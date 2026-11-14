import { authJsonReplacer, authJsonReviver } from '../auth/auth-utils.js'
import { StoreError } from '../core/errors.js'
import { SNAPSHOT_VERSION, type StoreSnapshot } from './store-adapter.js'

export function serializeSnapshot(snapshot: StoreSnapshot): string {
  return JSON.stringify(snapshot, authJsonReplacer)
}

/** Parse + validasi bentuk snapshot. Melempar `StoreError` bila rusak. */
export function deserializeSnapshot(text: string): StoreSnapshot {
  let data: unknown
  try {
    data = JSON.parse(text, authJsonReviver)
  } catch (cause) {
    throw new StoreError('Store snapshot is not valid JSON', { cause })
  }
  return validateSnapshot(data)
}

export function validateSnapshot(data: unknown): StoreSnapshot {
  const s = data as Partial<StoreSnapshot> | null
  if (!s || typeof s !== 'object') throw new StoreError('Store snapshot must be an object')
  if (s.version !== SNAPSHOT_VERSION) {
    throw new StoreError(`Unsupported store snapshot version: ${String(s.version)}`)
  }
  const isArray = (v: unknown): boolean => Array.isArray(v)
  if (!isArray(s.chats) || !isArray(s.contacts) || !isArray(s.groups)) {
    throw new StoreError('Store snapshot is missing chats/contacts/groups')
  }
  if (!s.messages || typeof s.messages !== 'object' || Object.values(s.messages).some((v) => !isArray(v))) {
    throw new StoreError('Store snapshot has invalid messages')
  }
  return s as StoreSnapshot
}
