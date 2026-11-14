export type PrivacyCategory = 'last' | 'online' | 'profile' | 'status' | 'readreceipts' | 'groupadd' | 'calladd' | 'messages'

export type PrivacyValue = 'all' | 'contacts' | 'contact_blacklist' | 'none' | 'match_last_seen' | 'known'

/** Nilai yang diterima tiap kategori (validasi sisi-klien). */
export const PRIVACY_OPTIONS: Record<PrivacyCategory, readonly PrivacyValue[]> = {
  last: ['all', 'contacts', 'contact_blacklist', 'none'],
  online: ['all', 'match_last_seen'],
  profile: ['all', 'contacts', 'contact_blacklist', 'none'],
  status: ['all', 'contacts', 'contact_blacklist', 'none'],
  readreceipts: ['all', 'none'],
  groupadd: ['all', 'contacts', 'contact_blacklist'],
  calladd: ['all', 'known'],
  messages: ['all', 'contacts'],
}

/** Nilai yang tidak dikenal tetap dipertahankan sebagai string. */
export type PrivacySettings = Partial<Record<PrivacyCategory, PrivacyValue | (string & {})>> & Record<string, string | undefined>

/** Durasi pesan sementara bawaan (detik); 0 = nonaktif. */
export const DISAPPEARING_DURATIONS = [0, 86_400, 604_800, 7_776_000] as const
