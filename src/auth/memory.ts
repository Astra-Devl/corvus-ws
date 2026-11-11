import { initAuthCreds, type KeyPairProvider } from './auth-utils.js'
import type { AuthStateProvider } from './auth-state.js'
import type { AuthCreds } from './credentials.js'
import type {
  SignalDataSet,
  SignalDataType,
  SignalDataTypeMap,
  SignalKeyStore,
} from './key-store.js'

export class MemoryKeyStore implements SignalKeyStore {
  readonly #data = new Map<string, Map<string, unknown>>()

  async get<T extends SignalDataType>(type: T, ids: readonly string[]) {
    const result: Record<string, SignalDataTypeMap[T]> = {}
    const bucket = this.#data.get(type)
    if (!bucket) return result
    for (const id of ids) {
      if (bucket.has(id)) result[id] = bucket.get(id) as SignalDataTypeMap[T]
    }
    return result
  }

  async set(data: SignalDataSet) {
    for (const type of Object.keys(data) as SignalDataType[]) {
      const entries = data[type] as Record<string, unknown> | undefined
      if (!entries) continue
      let bucket = this.#data.get(type)
      if (!bucket) {
        bucket = new Map()
        this.#data.set(type, bucket)
      }
      for (const [id, value] of Object.entries(entries)) {
        if (value === null || value === undefined) bucket.delete(id)
        else bucket.set(id, value)
      }
    }
  }

  async clear() {
    this.#data.clear()
  }
}

/** Auth state yang hanya hidup di memori (cocok untuk test / session sementara). */
export function createMemoryAuthState(
  creds?: AuthCreds,
  provider?: KeyPairProvider,
): AuthStateProvider {
  const keys = new MemoryKeyStore()
  const state = { creds: creds ?? initAuthCreds(provider), keys }

  return {
    state,
    saveCreds: async () => {},
    clear: async () => {
      await keys.clear()
    },
  }
}
