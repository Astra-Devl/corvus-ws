import { AsyncLocalStorage } from 'node:async_hooks'
import { AuthError } from '../core/errors.js'
import type { Logger } from '../core/socket-config.js'
import { KeyedMutex } from './auth-utils.js'
import type { KeyPair } from './credentials.js'

type Placeholder = Record<string, unknown>

/** Jenis data yang disimpan key store. */
export interface SignalDataTypeMap {
  'pre-key': KeyPair
  session: Uint8Array
  'sender-key': Uint8Array
  'sender-key-memory': Record<string, boolean>
  'app-state-sync-key': Placeholder
  'app-state-sync-version': Placeholder
  'lid-mapping': string
  'device-list': string[]
}

export type SignalDataType = keyof SignalDataTypeMap

/** `null` berarti hapus. */
export type SignalDataSet = {
  [T in SignalDataType]?: Record<string, SignalDataTypeMap[T] | null>
}

export interface SignalKeyStore {
  get<T extends SignalDataType>(
    type: T,
    ids: readonly string[],
  ): Promise<Record<string, SignalDataTypeMap[T]>>
  set(data: SignalDataSet): Promise<void>
  clear?(): Promise<void>
}

export interface TransactionalKeyStore extends SignalKeyStore {
  /**
   * Jalankan `work` dalam transaksi: pembacaan di-cache, penulisan ditahan
   * dan baru di-commit setelah `work` sukses. Jika `work` melempar error,
   * semua penulisan dibuang.
   */
  transaction<T>(work: () => Promise<T>, key?: string): Promise<T>
  isInTransaction(): boolean
}

export interface TransactionOptions {
  logger?: Logger
  maxCommitRetries?: number
  retryDelayMs?: number
}

interface TxContext {
  cache: Map<string, Map<string, unknown>>
  mutations: Map<string, Map<string, unknown>>
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

function bucket(map: Map<string, Map<string, unknown>>, type: string): Map<string, unknown> {
  let inner = map.get(type)
  if (!inner) {
    inner = new Map()
    map.set(type, inner)
  }
  return inner
}

export function createTransactionalKeyStore(
  store: SignalKeyStore,
  options: TransactionOptions = {},
): TransactionalKeyStore {
  const { logger, maxCommitRetries = 3, retryDelayMs = 200 } = options
  const als = new AsyncLocalStorage<TxContext>()
  const mutex = new KeyedMutex()

  async function commit(ctx: TxContext): Promise<void> {
    if (ctx.mutations.size === 0) return

    const data: Record<string, Record<string, unknown>> = {}
    for (const [type, entries] of ctx.mutations) data[type] = Object.fromEntries(entries)

    for (let attempt = 1; ; attempt++) {
      try {
        await store.set(data as SignalDataSet)
        return
      } catch (error) {
        logger?.warn({ err: error, attempt }, 'key store commit failed')
        if (attempt >= maxCommitRetries) {
          throw new AuthError('Failed to commit key store transaction', { cause: error })
        }
        await sleep(retryDelayMs)
      }
    }
  }

  return {
    async get<T extends SignalDataType>(type: T, ids: readonly string[]) {
      const tx = als.getStore()
      if (!tx) return store.get(type, ids)

      const result: Record<string, SignalDataTypeMap[T]> = {}
      const cached = tx.cache.get(type)
      const missing: string[] = []

      for (const id of ids) {
        if (cached?.has(id)) {
          const value = cached.get(id)
          if (value !== null && value !== undefined) result[id] = value as SignalDataTypeMap[T]
        } else {
          missing.push(id)
        }
      }

      if (missing.length > 0) {
        const fetched = await store.get(type, missing)
        const target = bucket(tx.cache, type)
        for (const id of missing) {
          const value = fetched[id]
          if (value !== undefined) {
            target.set(id, value)
            result[id] = value
          }
        }
      }
      return result
    },

    async set(data: SignalDataSet) {
      const tx = als.getStore()
      if (!tx) return store.set(data)

      for (const type of Object.keys(data) as SignalDataType[]) {
        const entries = data[type] as Record<string, unknown> | undefined
        if (!entries) continue
        const cache = bucket(tx.cache, type)
        const mutations = bucket(tx.mutations, type)
        for (const [id, value] of Object.entries(entries)) {
          cache.set(id, value)
          mutations.set(id, value)
        }
      }
    },

    async clear() {
      await store.clear?.()
    },

    isInTransaction: () => als.getStore() !== undefined,

    async transaction<T>(work: () => Promise<T>, key = 'default'): Promise<T> {
      // transaksi bersarang memakai konteks yang sama (hindari deadlock)
      if (als.getStore()) return work()

      return mutex.run(key, async () => {
        const ctx: TxContext = { cache: new Map(), mutations: new Map() }
        const result = await als.run(ctx, work)
        await commit(ctx)
        return result
      })
    },
  }
}
