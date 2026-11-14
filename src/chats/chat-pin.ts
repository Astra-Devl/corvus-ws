import type { ChatUpdate } from '../store/store-events.js'

/** `pinned` berisi epoch detik saat di-pin; `undefined` jika tidak di-pin. */
export const pinUpdate = (jid: string, pinned: boolean, now: number = Date.now()): ChatUpdate => ({
  id: jid,
  pinned: pinned ? Math.floor(now / 1000) : undefined,
})
