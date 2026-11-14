import { randomBytes } from 'node:crypto'

export interface MessageKey {
  remoteJid: string
  fromMe: boolean
  id: string
  /** Pengirim di grup/broadcast. */
  participant?: string | undefined
}

/** ID pesan baru: prefiks "3EB0" + 18 byte acak (hex huruf besar). */
export function generateMessageId(): string {
  return `3EB0${randomBytes(18).toString('hex').toUpperCase()}`
}

export function makeKey(remoteJid: string, fromMe: boolean, id: string, participant?: string): MessageKey {
  return participant === undefined ? { remoteJid, fromMe, id } : { remoteJid, fromMe, id, participant }
}

export function isSameKey(a: MessageKey, b: MessageKey): boolean {
  return (
    a.id === b.id &&
    a.remoteJid === b.remoteJid &&
    a.fromMe === b.fromMe &&
    (a.participant === undefined || b.participant === undefined || a.participant === b.participant)
  )
}

/** Kunci string stabil untuk indeks/map. */
export function keyToString(key: MessageKey): string {
  return `${key.remoteJid}|${key.id}|${key.fromMe ? 1 : 0}`
}
