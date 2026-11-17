import type { Logger } from '../core/socket-config.js'
import type { ProtocolVersion } from '../protocol/protocol-version.js'

/** Versi klien WhatsApp Web: `[major, minor, revisi]`, mis. `[2, 3000, 1023223821]`. */
export type WAVersion = ProtocolVersion

/** Dari mana versi yang dipakai berasal. */
export type VersionSource = 'config' | 'cache' | 'remote' | 'fallback'

export interface VersionInfo {
  version: WAVersion
  source: VersionSource
  /** Epoch ms saat versi ini ditentukan/diambil. */
  fetchedAt: number
  /** Nama sumber remote (bila `source` = `remote`, atau asal data cache). */
  sourceName?: string | undefined
}

/** Satu sumber remote untuk mengambil versi terbaru. */
export interface VersionSourceDefinition {
  name: string
  url: string
  headers?: Record<string, string> | undefined
  /** Ubah isi respons menjadi versi; lempar error bila format tidak dikenali. */
  parse(body: string): WAVersion
}

export interface FetchVersionOptions {
  /** Daftar sumber, dicoba berurutan sampai ada yang berhasil. */
  sources?: readonly VersionSourceDefinition[] | undefined
  /** Implementasi `fetch` (default: `globalThis.fetch`). */
  fetch?: typeof fetch | undefined
  timeoutMs?: number | undefined
  /** Header tambahan untuk semua sumber. */
  headers?: Record<string, string> | undefined
}

export interface VersionCacheEntry {
  version: WAVersion
  fetchedAt: number
  sourceName?: string | undefined
}

export interface VersionCache {
  get(): Promise<VersionCacheEntry | undefined>
  set(entry: VersionCacheEntry): Promise<void>
  clear(): Promise<void>
}

export interface VersionManagerOptions extends FetchVersionOptions {
  /** Pakai versi ini apa adanya (tanpa fetch maupun cache). */
  version?: WAVersion | undefined
  /** Dipakai bila fetch gagal dan tidak ada cache. */
  fallback?: WAVersion | undefined
  /** `false` = tanpa cache. Default: cache di memori. */
  cache?: VersionCache | false | undefined
  /** Umur cache sebelum diambil ulang (default 6 jam). */
  ttlMs?: number | undefined
  /** Bila fetch gagal, pakai data lama (kedaluwarsa) daripada gagal (default true). */
  staleIfError?: boolean | undefined
  logger?: Logger | undefined
}
