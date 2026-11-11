import { mkdir, readdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { join, resolve, sep } from 'node:path'
import { AuthError, DisconnectReason } from '../core/errors.js'
import type { Logger } from '../core/socket-config.js'
import {
  initAuthCreds,
  isAuthCreds,
  KeyedMutex,
  parseAuthData,
  serializeAuthData,
  type KeyPairProvider,
} from './auth-utils.js'
import type { AuthState, AuthStateProvider } from './auth-state.js'
import type { AuthCreds } from './credentials.js'
import type {
  SignalDataSet,
  SignalDataType,
  SignalDataTypeMap,
  SignalKeyStore,
} from './key-store.js'

const CREDS_FILE = 'creds.json'

export interface MultiFileAuthOptions {
  logger?: Logger
  provider?: KeyPairProvider
}

function isNotFound(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | undefined)?.code === 'ENOENT'
}

/**
 * Simpan auth state sebagai banyak file JSON di satu folder:
 * `creds.json` + `<type>-<id>.json` untuk tiap key.
 */
export async function createMultiFileAuthState(
  folder: string,
  options: MultiFileAuthOptions = {},
): Promise<AuthStateProvider> {
  const { logger } = options
  const root = resolve(folder)
  const mutex = new KeyedMutex()

  await mkdir(root, { recursive: true, mode: 0o700 })

  const pathFor = (name: string): string => {
    if (name.includes('\0')) throw new AuthError('Invalid file name')
    const safe = name.replace(/[\\/]/g, '__').replace(/:/g, '-')
    const full = resolve(join(root, safe))
    if (!full.startsWith(root + sep)) throw new AuthError('Invalid file path', { data: { name } })
    return full
  }

  const writeData = (name: string, data: unknown): Promise<void> => {
    const file = pathFor(name)
    return mutex.run(file, async () => {
      const tmp = `${file}.${process.pid}.tmp`
      await writeFile(tmp, serializeAuthData(data), { mode: 0o600 })
      await rename(tmp, file)
    })
  }

  const readData = async <T>(name: string): Promise<T | undefined> => {
    const file = pathFor(name)
    return mutex.run(file, async () => {
      try {
        return parseAuthData<T>(await readFile(file, 'utf8'))
      } catch (error) {
        if (isNotFound(error)) return undefined
        logger?.warn({ err: error, file: name }, 'failed to read auth file; treating as missing')
        return undefined
      }
    })
  }

  const removeData = (name: string): Promise<void> => {
    const file = pathFor(name)
    return mutex.run(file, () => rm(file, { force: true }))
  }

  // ---- creds ----
  const loaded = await readData<unknown>(CREDS_FILE)
  let creds: AuthCreds
  if (loaded === undefined) {
    creds = initAuthCreds(options.provider)
    await writeData(CREDS_FILE, creds)
  } else if (isAuthCreds(loaded)) {
    creds = loaded
  } else {
    throw new AuthError(`Corrupted ${CREDS_FILE} in "${root}"`, {
      statusCode: DisconnectReason.badSession,
    })
  }

  const state: AuthState = { creds, keys: undefined as unknown as SignalKeyStore }

  const keys: SignalKeyStore = {
    async get<T extends SignalDataType>(type: T, ids: readonly string[]) {
      const result: Record<string, SignalDataTypeMap[T]> = {}
      await Promise.all(
        ids.map(async (id) => {
          const value = await readData<SignalDataTypeMap[T]>(`${type}-${id}.json`)
          if (value !== undefined) result[id] = value
        }),
      )
      return result
    },

    async set(data: SignalDataSet) {
      const tasks: Promise<void>[] = []
      for (const type of Object.keys(data) as SignalDataType[]) {
        const entries = data[type] as Record<string, unknown> | undefined
        if (!entries) continue
        for (const [id, value] of Object.entries(entries)) {
          const name = `${type}-${id}.json`
          tasks.push(value === null || value === undefined ? removeData(name) : writeData(name, value))
        }
      }
      await Promise.all(tasks)
    },

    async clear() {
      const files = await readdir(root)
      await Promise.all(
        files
          .filter((f) => f !== CREDS_FILE && (f.endsWith('.json') || f.endsWith('.tmp')))
          .map((f) => removeData(f)),
      )
    },
  }
  state.keys = keys

  return {
    state,
    saveCreds: () => writeData(CREDS_FILE, state.creds),
    clear: async () => {
      await keys.clear?.()
      await removeData(CREDS_FILE)
    },
  }
}
