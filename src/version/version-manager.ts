import { VersionError, toError } from '../core/errors.js'
import { TypedEventEmitter } from '../core/event-emitter.js'
import { compareVersions } from '../protocol/protocol-version.js'
import { MemoryVersionCache, isFresh } from './version-cache.js'
import { DEFAULT_VERSION_TTL_MS } from './version-defaults.js'
import type { VersionEvents } from './version-events.js'
import { fetchLatestVersion } from './version-fetcher.js'
import { assertValidVersion } from './version-validator.js'
import type { VersionCache, VersionInfo, VersionManagerOptions, WAVersion } from './version-types.js'

/**
 * Menentukan versi klien yang dipakai, dengan urutan:
 * versi tetap (`version`) → cache yang masih segar → fetch → cache lama → `fallback`.
 */
export class VersionManager {
  readonly ev = new TypedEventEmitter<VersionEvents>()
  readonly #options: VersionManagerOptions
  readonly #cache: VersionCache | undefined
  readonly #ttlMs: number
  #current: VersionInfo | undefined
  #inflight: Promise<VersionInfo> | undefined
  #timer: ReturnType<typeof setInterval> | undefined

  constructor(options: VersionManagerOptions = {}) {
    this.#options = options
    this.#ttlMs = options.ttlMs ?? DEFAULT_VERSION_TTL_MS
    this.#cache = options.cache === false ? undefined : (options.cache ?? new MemoryVersionCache())
    if (options.version) assertValidVersion(options.version)
    if (options.fallback) assertValidVersion(options.fallback)
  }

  /** Versi yang terakhir ditentukan (undefined sebelum `resolve()` pertama). */
  get current(): VersionInfo | undefined {
    return this.#current
  }

  async get(): Promise<WAVersion> {
    return (await this.resolve()).version
  }

  /** Tentukan versi. `force` melewati cache dan mengambil ulang dari sumber remote. */
  resolve(options: { force?: boolean } = {}): Promise<VersionInfo> {
    // Permintaan paralel berbagi satu proses.
    this.#inflight ??= this.#resolve(options.force === true).finally(() => {
      this.#inflight = undefined
    })
    return this.#inflight
  }

  refresh(): Promise<VersionInfo> {
    return this.resolve({ force: true })
  }

  async #resolve(force: boolean): Promise<VersionInfo> {
    const { version, fallback, logger } = this.#options

    if (version) return this.#set({ version, source: 'config', fetchedAt: Date.now() })

    if (!force) {
      if (this.#current && isFresh(this.#current, this.#ttlMs)) return this.#current
      const cached = await this.#cache?.get().catch(() => undefined)
      if (cached && isFresh(cached, this.#ttlMs)) {
        return this.#set({ version: cached.version, source: 'cache', fetchedAt: cached.fetchedAt, sourceName: cached.sourceName })
      }
    }

    try {
      const info = await fetchLatestVersion(this.#options)
      await this.#cache?.set({ version: info.version, fetchedAt: info.fetchedAt, sourceName: info.sourceName }).catch((error) => {
        logger?.warn({ err: error }, 'could not write the version cache')
      })
      return this.#set(info)
    } catch (cause) {
      const error = toError(cause)
      this.ev.emit('version.error', { error })
      logger?.warn({ err: error }, 'could not fetch the latest WhatsApp version')

      if (this.#options.staleIfError !== false) {
        const stale = this.#current ?? (await this.#cache?.get().catch(() => undefined))
        if (stale) {
          const info: VersionInfo = { version: stale.version, source: 'cache', fetchedAt: stale.fetchedAt, sourceName: stale.sourceName }
          this.ev.emit('version.stale', { info, error })
          return this.#set(info)
        }
      }
      if (fallback) return this.#set({ version: fallback, source: 'fallback', fetchedAt: Date.now() })
      throw new VersionError('Could not determine the client version. Pass `version` or `fallback`.', { cause: error })
    }
  }

  #set(info: VersionInfo): VersionInfo {
    const previous = this.#current
    this.#current = info
    const changed = !previous || compareVersions(previous.version, info.version) !== 0
    if (changed) this.ev.emit('version.update', { previous, current: info })
    return info
  }

  /** Ambil ulang versi secara berkala. Kegagalan dilaporkan lewat event `version.error`. */
  startAutoRefresh(intervalMs: number): void {
    if (!Number.isFinite(intervalMs) || intervalMs <= 0) throw new VersionError('intervalMs must be a positive number')
    this.stopAutoRefresh()
    this.#timer = setInterval(() => {
      this.refresh().catch(() => undefined)
    }, intervalMs)
    this.#timer.unref()
  }

  stopAutoRefresh(): void {
    if (this.#timer) clearInterval(this.#timer)
    this.#timer = undefined
  }

  dispose(): void {
    this.stopAutoRefresh()
    this.ev.removeAllListeners()
  }
}

/** Sekali pakai: tentukan versi lalu kembalikan tuple-nya (siap untuk `makeSocket({ version })`). */
export async function resolveVersion(options: VersionManagerOptions = {}): Promise<WAVersion> {
  const manager = new VersionManager(options)
  try {
    return await manager.get()
  } finally {
    manager.dispose()
  }
}
