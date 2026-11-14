import { MessageError } from '../core/errors.js'
import { getContentType, type MessageContent } from './message-utils.js'

export interface ContextInfoOptions {
  mentions?: readonly string[]
  /** Durasi pesan sementara (detik); 0 = nonaktif. */
  expiration?: number
  /** Field mentah tambahan (mis. hasil `buildQuoteContext`). */
  extra?: Record<string, unknown>
}

/** Jenis pesan yang menerima `contextInfo`. */
const CONTEXT_CAPABLE = new Set([
  'extendedTextMessage',
  'imageMessage',
  'videoMessage',
  'audioMessage',
  'documentMessage',
  'stickerMessage',
  'locationMessage',
  'liveLocationMessage',
  'contactMessage',
  'contactsArrayMessage',
  'buttonsMessage',
  'listMessage',
  'templateMessage',
  'interactiveMessage',
  'pollCreationMessage',
])

export function buildContextInfo(options: ContextInfoOptions): Record<string, unknown> {
  return {
    ...(options.mentions?.length && { mentionedJid: [...new Set(options.mentions)] }),
    ...(options.expiration !== undefined && { expiration: options.expiration }),
    ...options.extra,
  }
}

/**
 * Pasang `contextInfo` pada konten. `conversation` otomatis diubah menjadi
 * `extendedTextMessage`. Konten yang dibungkus (viewOnce dll.) dibuka dulu.
 */
export function attachContextInfo(content: MessageContent, contextInfo: Record<string, unknown>): MessageContent {
  if (Object.keys(contextInfo).length === 0) return content

  const wrapperKey = ['viewOnceMessage', 'viewOnceMessageV2', 'ephemeralMessage', 'documentWithCaptionMessage']
    .find((k) => content[k]?.message)
  if (wrapperKey) {
    return { ...content, [wrapperKey]: { ...content[wrapperKey], message: attachContextInfo(content[wrapperKey].message, contextInfo) } }
  }

  const type = getContentType(content)
  if (!type) throw new MessageError('Cannot attach contextInfo to empty content')

  if (type === 'conversation') {
    const { conversation, ...rest } = content
    return { ...rest, extendedTextMessage: { text: conversation, contextInfo } }
  }
  if (!CONTEXT_CAPABLE.has(type)) {
    throw new MessageError(`Message type "${type}" does not support contextInfo`, { data: { type } })
  }
  const inner = content[type] as Record<string, unknown>
  return { ...content, [type]: { ...inner, contextInfo: { ...(inner.contextInfo as object | undefined), ...contextInfo } } }
}
