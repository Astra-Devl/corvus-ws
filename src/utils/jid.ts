export const S_WHATSAPP_NET = 's.whatsapp.net'
export const G_US = 'g.us'
export const LID_SERVER = 'lid'
export const NEWSLETTER_SERVER = 'newsletter'
export const STATUS_BROADCAST_JID = 'status@broadcast'

export interface DecodedJid {
  user: string
  server: string
  device: number | undefined
}

export type JidKind = 'user' | 'group' | 'broadcast' | 'newsletter' | 'unknown'

/** Bangun JID: device 0/undefined tidak ditulis (`user@server`), selain itu `user:device@server`. */
export function jidEncode(user: string, server: string, device?: number): string {
  return `${user}${device ? `:${device}` : ''}@${server}`
}

export function jidDecode(jid: string): DecodedJid | undefined {
  const at = jid.indexOf('@')
  if (at < 0) return undefined
  const [userPart = '', device] = jid.slice(0, at).split(':')
  const deviceNumber = device === undefined ? undefined : Number(device)
  return {
    user: userPart.split('_')[0]!,
    server: jid.slice(at + 1),
    device: deviceNumber !== undefined && Number.isInteger(deviceNumber) ? deviceNumber : undefined,
  }
}

/** `62812:5@s.whatsapp.net` -> `62812@s.whatsapp.net` (tanpa device/agent). */
export function jidNormalizedUser(jid: string): string {
  const decoded = jidDecode(jid)
  return decoded ? `${decoded.user}@${decoded.server}` : jid
}

/** Bagian user (tanpa device/agent/server). */
export function jidUser(jid: string): string {
  return jidDecode(jid)?.user ?? jid
}

export const isSameUser = (a: string, b: string): boolean => jidNormalizedUser(a) === jidNormalizedUser(b)

export function jidKind(jid: string): JidKind {
  const server = jidDecode(jid)?.server
  if (server === S_WHATSAPP_NET || server === LID_SERVER || server === 'c.us') return 'user'
  if (server === G_US) return 'group'
  if (server === 'broadcast') return 'broadcast'
  if (server === NEWSLETTER_SERVER) return 'newsletter'
  return 'unknown'
}

export const isJidUser = (jid: string): boolean => jidKind(jid) === 'user'
export const isJidGroup = (jid: string): boolean => jidKind(jid) === 'group'
export const isJidBroadcast = (jid: string): boolean => jidKind(jid) === 'broadcast'
export const isJidNewsletter = (jid: string): boolean => jidKind(jid) === 'newsletter'
export const isJidStatusBroadcast = (jid: string): boolean => jid === STATUS_BROADCAST_JID
export const isLidUser = (jid: string): boolean => jidDecode(jid)?.server === LID_SERVER

/** Nomor telepon internasional (boleh pakai +/spasi/strip) -> JID pengguna. */
export function phoneToJid(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 5 || digits.length > 15) throw new RangeError(`Invalid phone number: ${phone}`)
  return jidEncode(digits, S_WHATSAPP_NET)
}

/** JID pengguna -> nomor (digit saja); `undefined` untuk non-pengguna / LID. */
export function jidToPhone(jid: string): string | undefined {
  const decoded = jidDecode(jid)
  return decoded?.server === S_WHATSAPP_NET && /^\d+$/.test(decoded.user) ? decoded.user : undefined
}
