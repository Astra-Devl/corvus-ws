import { ChatError } from '../core/errors.js'
import type { ChatUpdate } from '../store/store-events.js'

const HOUR = 3_600_000

export const MUTE_DURATIONS = {
  '8h': 8 * HOUR,
  '1w': 7 * 24 * HOUR,
  always: -1,
} as const

export type MuteDuration = keyof typeof MUTE_DURATIONS | number

/** Hitung akhir mute (epoch ms; `-1` = selamanya). Angka = durasi dalam ms dari sekarang. */
export function muteEndTime(duration: MuteDuration, now: number = Date.now()): number {
  if (typeof duration === 'string') {
    const ms = MUTE_DURATIONS[duration]
    if (ms === undefined) throw new ChatError(`Unknown mute duration: ${duration}`)
    return ms === -1 ? -1 : now + ms
  }
  if (!Number.isFinite(duration) || duration <= 0) throw new ChatError('Mute duration must be a positive number of ms')
  return now + duration
}

export const muteUpdate = (jid: string, endTime: number | null): ChatUpdate => ({
  id: jid,
  muteEndTime: endTime ?? undefined,
})
