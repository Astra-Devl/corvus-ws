import { VersionError } from '../core/errors.js'
import type { VersionSourceDefinition, WAVersion } from './version-types.js'

export const WA_WEB_SW_URL = 'https://web.whatsapp.com/sw.js'
/** Angka mayor dan minor versi WhatsApp Web (revisi diambil dari server). */
export const WA_WEB_MAJOR = 2
export const WA_WEB_MINOR = 3000

export const DEFAULT_VERSION_TTL_MS = 6 * 60 * 60 * 1000
export const DEFAULT_VERSION_TIMEOUT_MS = 10_000
/** Batas ukuran respons yang dibaca saat mengambil versi. */
export const MAX_VERSION_BODY_BYTES = 8 * 1024 * 1024

export const DEFAULT_VERSION_HEADERS: Readonly<Record<string, string>> = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'sec-fetch-site': 'none',
  accept: '*/*',
}

const CLIENT_REVISION = /\\?"client_revision\\?":\s*(\d+)/

/** Ambil `client_revision` dari service worker WhatsApp Web. */
export function parseClientRevision(body: string): WAVersion {
  const match = CLIENT_REVISION.exec(body)
  const revision = match ? Number(match[1]) : NaN
  if (!Number.isSafeInteger(revision) || revision <= 0) {
    throw new VersionError('client_revision not found in response')
  }
  return [WA_WEB_MAJOR, WA_WEB_MINOR, revision]
}

export const DEFAULT_VERSION_SOURCES: readonly VersionSourceDefinition[] = Object.freeze([
  { name: 'whatsapp-web', url: WA_WEB_SW_URL, parse: parseClientRevision },
])
