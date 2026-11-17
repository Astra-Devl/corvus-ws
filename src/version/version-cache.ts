import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { isValidVersion } from './version-validator.js'
import type { VersionCache, VersionCacheEntry } from './version-types.js'

/** Apakah `entry` masih segar menurut `ttlMs`. */
export function isFresh(entry: VersionCacheEntry, ttlMs: number, now = Date.now()): boolean {
  return now - entry.fetchedAt >= 0 && now - entry.fetchedAt < ttlMs
}

function parseEntry(value: unknown): VersionCacheEntry | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const { version, fetchedAt, sourceName } = value as Partial<VersionCacheEntry>
  if (!isValidVersion(version) || typeof fetchedAt !== 'number' || !Number.isFinite(fetchedAt)) return undefined
  return { version, fetchedAt, ...(typeof sourceName === 'string' && { sourceName }) }
}

export class MemoryVersionCache implements VersionCache {
  #entry: VersionCacheEntry | undefined

  async get(): Promise<VersionCacheEntry | undefined> {
    return this.#entry
  }

  async set(entry: VersionCacheEntry): Promise<void> {
    this.#entry = entry
  }

  async clear(): Promise<void> {
    this.#entry = undefined
  }
}

/** Cache di file JSON. File rusak/tidak valid dianggap kosong. */
export class FileVersionCache implements VersionCache {
  readonly #path: string

  constructor(path: string) {
    this.#path = path
  }

  async get(): Promise<VersionCacheEntry | undefined> {
    try {
      return parseEntry(JSON.parse(await readFile(this.#path, 'utf8')))
    } catch {
      return undefined
    }
  }

  async set(entry: VersionCacheEntry): Promise<void> {
    await mkdir(dirname(this.#path), { recursive: true })
    // Tulis ke file sementara lalu rename agar tidak pernah ada file setengah jadi.
    const temp = `${this.#path}.${process.pid}.tmp`
    await writeFile(temp, JSON.stringify(entry))
    await rename(temp, this.#path)
  }

  async clear(): Promise<void> {
    await rm(this.#path, { force: true })
  }
}
