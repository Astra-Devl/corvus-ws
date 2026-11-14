import { MessageError } from '../core/errors.js'
import { attachContextInfo } from './message-context.js'
import { getContentType, normalizeMessageContent, type MessageContent, type WAMessage } from './message-utils.js'

export interface ForwardOptions {
  /** Naikkan skor forward walau pesan berasal dari kita. */
  force?: boolean
}

/** Siapkan konten untuk diteruskan (forward). Quote lama dibuang. */
export function forwardContent(message: WAMessage, options: ForwardOptions = {}): MessageContent {
  const source = normalizeMessageContent(message.message)
  const type = getContentType(source)
  if (!source || !type) throw new MessageError('Cannot forward a message without content')
  if (type === 'protocolMessage' || type === 'reactionMessage') {
    throw new MessageError(`Cannot forward "${type}"`)
  }

  const copy = structuredClone(source) as MessageContent
  const inner = copy[type]
  const previous = (typeof inner === 'object' && inner ? (inner as { contextInfo?: Record<string, unknown> }).contextInfo : undefined) ?? {}
  const score = ((previous.forwardingScore as number | undefined) ?? 0) + (message.key.fromMe && !options.force ? 0 : 1)

  // hapus info quote bawaan
  const { stanzaId: _s, participant: _p, quotedMessage: _q, remoteJid: _r, ...kept } = previous
  if (typeof inner === 'object' && inner) delete (inner as { contextInfo?: unknown }).contextInfo

  return attachContextInfo(copy, { ...kept, isForwarded: true, forwardingScore: score })
}
