import type { VersionInfo } from './version-types.js'

export interface VersionEvents {
  /** Versi yang dipakai berubah (atau pertama kali ditentukan). */
  'version.update': { previous?: VersionInfo | undefined; current: VersionInfo }
  /** Pengambilan versi gagal. */
  'version.error': { error: Error }
  /** Pengambilan gagal sehingga data lama (kedaluwarsa) dipakai. */
  'version.stale': { info: VersionInfo; error: Error }
}

export type VersionEventName = keyof VersionEvents
