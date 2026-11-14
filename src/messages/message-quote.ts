import { MessageError } from '../core/errors.js'
import { attachContextInfo } from './message-context.js'
import { jidNormalizedUser, getContentType, normalizeMessageContent, type MessageContent, type WAMessage } from './message-utils.js'

export interface QuoteOptions {
  /** JID akun sendiri (dipakai bila pesan yang dikutip dikirim oleh kita). */
  ownJid?: string
}

/** `contextInfo` untuk membalas (quote) sebuah pesan. */
export function buildQuoteContext(quoted: WAMessage, options: QuoteOptions = {}): Record<string, unknown> {
  const content = normalizeMessageContent(quoted.message)
  const type = getContentType(content)
  if (!content || !type) throw new MessageError('Cannot quote a message without content')

  // buang contextInfo bersarang agar tidak menumpuk
  let quotedMessage: MessageContent
  if (typeof content[type] === 'object' && content[type] !== null) {
    const { contextInfo: _drop, ...inner } = content[type] as Record<string, unknown>
    quotedMessage = { [type]: inner }
  } else {
    quotedMessage = { [type]: content[type] }
  }

  const { key } = quoted
  const isGroup = key.remoteJid.endsWith('@g.us') || key.remoteJid.endsWith('@broadcast')
  const participant = key.fromMe
    ? options.ownJid
    : (key.participant ?? quoted.participant ?? (isGroup ? undefined : key.remoteJid))

  return {
    stanzaId: key.id,
    ...(participant && { participant: jidNormalizedUser(participant) }),
    quotedMessage,
  }
}

/** Pasang quote pada konten pesan. */
export function withQuote(content: MessageContent, quoted: WAMessage, options?: QuoteOptions): MessageContent {
  return attachContextInfo(content, buildQuoteContext(quoted, options))
}
