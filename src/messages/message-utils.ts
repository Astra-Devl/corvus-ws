import type { MessageKey } from './message-key.js'

/** Isi pesan dalam bentuk JSON WAProto (`IMessage`). */
export type MessageContent = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

export interface MessageReaction {
  key: MessageKey
  text: string
  senderTimestampMs?: number | undefined
}

export interface UserReceipt {
  userJid: string
  receiptTimestamp?: number | undefined
  readTimestamp?: number | undefined
  playedTimestamp?: number | undefined
}

export interface WAMessage {
  key: MessageKey
  message?: MessageContent | null | undefined
  messageTimestamp?: number | undefined
  status?: number | undefined
  pushName?: string | undefined
  participant?: string | undefined
  broadcast?: boolean | undefined
  reactions?: MessageReaction[] | undefined
  userReceipt?: UserReceipt[] | undefined
  messageStubType?: number | undefined
  [extra: string]: unknown
}

const IGNORED_KEYS = new Set(['messageContextInfo', 'senderKeyDistributionMessage'])

/** Nama field konten utama (mis. `conversation`, `imageMessage`). */
export function getContentType(content: MessageContent | null | undefined): string | undefined {
  if (!content) return undefined
  return Object.keys(content).find((k) => !IGNORED_KEYS.has(k) && content[k] !== null && content[k] !== undefined)
}

const WRAPPERS = [
  'ephemeralMessage',
  'viewOnceMessage',
  'viewOnceMessageV2',
  'viewOnceMessageV2Extension',
  'documentWithCaptionMessage',
  'editedMessage',
  'deviceSentMessage',
] as const

/** Buka pembungkus (ephemeral, view-once, dll.) sampai ke konten sebenarnya. */
export function normalizeMessageContent(content: MessageContent | null | undefined): MessageContent | undefined {
  let current = content ?? undefined
  for (let depth = 0; current && depth < 8; depth++) {
    const wrapper = WRAPPERS.find((w) => current![w]?.message)
    if (!wrapper) break
    current = current[wrapper].message as MessageContent
  }
  return current
}

/** Teks yang bisa dibaca manusia dari sebuah pesan (jika ada). */
export function extractText(content: MessageContent | null | undefined): string | undefined {
  const c = normalizeMessageContent(content)
  if (!c) return undefined
  return (
    c.conversation ??
    c.extendedTextMessage?.text ??
    c.imageMessage?.caption ??
    c.videoMessage?.caption ??
    c.documentMessage?.caption ??
    c.buttonsResponseMessage?.selectedDisplayText ??
    c.listResponseMessage?.title ??
    c.templateButtonReplyMessage?.selectedDisplayText ??
    c.interactiveMessage?.body?.text ??
    c.buttonsMessage?.contentText ??
    undefined
  )
}

export {
  jidDecode,
  jidEncode,
  jidKind,
  jidNormalizedUser,
  jidUser,
  isSameUser,
  isJidGroup as isGroupJid,
} from '../utils/jid.js'
export type { DecodedJid, JidKind } from '../utils/jid.js'
