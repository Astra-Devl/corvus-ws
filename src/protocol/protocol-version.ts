import { ProtocolError } from '../core/errors.js'

export type ProtocolVersion = readonly [number, number, number]

/** Versi kamus token yang diumumkan di header intro. */
export const DICT_VERSION = 3
export const WA_MAGIC = 6
/** Header intro: "WA" + magic + versi kamus. Dikirim sekali di awal stream. */
export const WA_HEADER: Uint8Array = Uint8Array.of(0x57, 0x41, WA_MAGIC, DICT_VERSION)
export const NOISE_MODE = 'Noise_XX_25519_AESGCM_SHA256\0\0\0\0'

export function parseVersion(text: string): ProtocolVersion {
  const parts = text.trim().split('.').map(Number)
  if (parts.length !== 3 || parts.some((n) => !Number.isInteger(n) || n < 0)) {
    throw new ProtocolError(`Invalid version string: "${text}"`)
  }
  return [parts[0]!, parts[1]!, parts[2]!]
}

export function formatVersion(version: ProtocolVersion): string {
  return version.join('.')
}

export function compareVersions(a: ProtocolVersion, b: ProtocolVersion): number {
  for (let i = 0; i < 3; i++) {
    const diff = a[i]! - b[i]!
    if (diff !== 0) return diff < 0 ? -1 : 1
  }
  return 0
}

/**
 * Versi klien harus diberikan lewat config (`version`); nilainya berubah-ubah
 * sehingga tidak di-hardcode di library.
 */
export function requireVersion(version: ProtocolVersion | undefined): ProtocolVersion {
  if (!version) {
    throw new ProtocolError('Client version is not set. Provide `version` in the socket config.')
  }
  return version
}
