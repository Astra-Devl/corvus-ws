import type { PairingMethod, PairingStatus } from './pairing-state.js'

/** Umur QR (ms): pertama lebih lama, berikutnya lebih singkat. */
export const DEFAULT_QR_FIRST_TTL_MS = 60_000
export const DEFAULT_QR_NEXT_TTL_MS = 20_000
/** Perkiraan masa berlaku pairing code; bisa diubah lewat opsi. */
export const DEFAULT_PAIRING_CODE_TTL_MS = 180_000

export interface PairingEventMap {
  'pairing.status': { from: PairingStatus; to: PairingStatus; method: PairingMethod | undefined }
  'pairing.qr': { qr: string; index: number; total: number; ttlMs: number }
  'pairing.code': { code: string; phoneNumber: string; expiresAt: number }
  'pairing.success': { me: { id: string; lid?: string | undefined; name?: string | undefined } | undefined }
  'pairing.expired': { method: PairingMethod }
  'pairing.failed': { error: Error; method: PairingMethod | undefined }
}
