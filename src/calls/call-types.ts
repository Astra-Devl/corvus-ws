export type CallStatus = 'offer' | 'ringing' | 'timeout' | 'reject' | 'accept' | 'terminate'

export interface CallInfo {
  id: string
  /** Chat tempat panggilan terjadi (pemanggil, atau grup). */
  chatId: string
  /** Pemanggil. */
  from: string
  /** Epoch detik. */
  date: number
  isVideo: boolean
  isGroup: boolean
  status: CallStatus
  /** Diterima saat offline (baru sampai setelah terhubung). */
  offline: boolean
  groupJid?: string | undefined
  /** Alasan dari server (mis. pada `terminate`). */
  reason?: string | undefined
}

/** Status akhir: panggilan tidak aktif lagi. */
export const FINAL_CALL_STATUSES: readonly CallStatus[] = ['timeout', 'reject', 'terminate']
