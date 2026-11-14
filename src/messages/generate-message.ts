import { MessageError } from '../core/errors.js'
import { buildButtonsMessage } from './button-message.js'
import type {
  ButtonsInput,
  CarouselInput,
  InteractiveInput,
  ListInput,
  TemplateInput,
} from './button-types.js'
import { buildCarouselMessage } from './carousel-message.js'
import { attachContextInfo, buildContextInfo } from './message-context.js'
import { buildDeleteMessage } from './message-delete.js'
import { buildEditMessage } from './message-edit.js'
import { forwardContent } from './message-forward.js'
import { generateMessageId, type MessageKey } from './message-key.js'
import { buildReactionMessage } from './message-reaction.js'
import { MessageStatus } from './message-status.js'
import { buildQuoteContext } from './message-quote.js'
import { buildInteractiveMessage } from './interactive-message.js'
import { buildListMessage } from './list-message.js'
import { buildTemplateMessage } from './template-message.js'
import type { MessageContent, WAMessage } from './message-utils.js'

export interface LocationInput {
  degreesLatitude: number
  degreesLongitude: number
  name?: string
  address?: string
}

export interface ContactInput {
  displayName: string
  /** vCard 3.0 lengkap. */
  vcard: string
}

export type MessageInput =
  | { text: string; mentions?: string[] }
  | { react: MessageKey; emoji: string }
  | { delete: MessageKey }
  | { edit: MessageKey; text: string }
  | { forward: WAMessage; force?: boolean }
  | { location: LocationInput }
  | { contacts: ContactInput[]; displayName?: string }
  | { buttons: ButtonsInput }
  | { list: ListInput }
  | { template: TemplateInput }
  | { interactive: InteractiveInput }
  | { carousel: CarouselInput }
  /** Konten WAProto yang sudah jadi (mis. media yang sudah diunggah). */
  | { raw: MessageContent }

export interface GenerateOptions {
  quoted?: WAMessage
  messageId?: string
  /** Epoch detik. */
  timestamp?: number
  /** JID akun sendiri. */
  userJid?: string
  /** Durasi pesan sementara (detik). */
  ephemeralExpiration?: number
}

const has = <K extends string>(input: object, key: K): input is Record<K, never> => key in input

/** Ubah input tingkat-tinggi menjadi isi pesan WAProto. */
export function generateMessageContent(input: MessageInput, options: GenerateOptions = {}): MessageContent {
  let content: MessageContent
  let mentions: string[] | undefined

  if (has(input, 'text') && !has(input, 'edit')) {
    if (!(input as { text: string }).text) throw new MessageError('"text" must not be empty')
    content = { conversation: (input as { text: string }).text }
    mentions = (input as { mentions?: string[] }).mentions
  } else if (has(input, 'react')) {
    content = buildReactionMessage(input.react as MessageKey, (input as { emoji: string }).emoji)
  } else if (has(input, 'delete')) {
    content = buildDeleteMessage(input.delete as MessageKey)
  } else if (has(input, 'edit')) {
    const text = (input as { text: string }).text
    if (!text) throw new MessageError('"text" must not be empty')
    content = buildEditMessage(input.edit as MessageKey, { conversation: text })
  } else if (has(input, 'forward')) {
    content = forwardContent(input.forward as WAMessage, { force: (input as { force?: boolean }).force ?? false })
  } else if (has(input, 'location')) {
    content = { locationMessage: input.location }
  } else if (has(input, 'contacts')) {
    const contacts = input.contacts as ContactInput[]
    if (contacts.length === 0) throw new MessageError('"contacts" must not be empty')
    content =
      contacts.length === 1
        ? { contactMessage: { displayName: contacts[0]!.displayName, vcard: contacts[0]!.vcard } }
        : {
            contactsArrayMessage: {
              displayName: (input as { displayName?: string }).displayName ?? `${contacts.length} kontak`,
              contacts,
            },
          }
  } else if (has(input, 'buttons')) content = buildButtonsMessage(input.buttons as ButtonsInput)
  else if (has(input, 'list')) content = buildListMessage(input.list as ListInput)
  else if (has(input, 'template')) content = buildTemplateMessage(input.template as TemplateInput)
  else if (has(input, 'interactive')) content = buildInteractiveMessage(input.interactive as InteractiveInput)
  else if (has(input, 'carousel')) content = buildCarouselMessage(input.carousel as CarouselInput)
  else if (has(input, 'raw')) content = structuredClone(input.raw as MessageContent)
  else throw new MessageError('Unsupported message input')

  const quote = options.quoted
    ? buildQuoteContext(options.quoted, options.userJid ? { ownJid: options.userJid } : {})
    : undefined
  const contextInfo = buildContextInfo({
    ...(mentions && { mentions }),
    ...(options.ephemeralExpiration !== undefined && { expiration: options.ephemeralExpiration }),
    ...(quote && { extra: quote }),
  })

  const isControl = 'protocolMessage' in content || 'reactionMessage' in content
  return isControl ? content : attachContextInfo(content, contextInfo)
}

/** Buat `WAMessage` lengkap (key, isi, timestamp, status PENDING) untuk dikirim ke `jid`. */
export function generateWAMessage(jid: string, input: MessageInput, options: GenerateOptions = {}): WAMessage {
  return {
    key: { remoteJid: jid, fromMe: true, id: options.messageId ?? generateMessageId() },
    message: generateMessageContent(input, options),
    messageTimestamp: options.timestamp ?? Math.floor(Date.now() / 1000),
    status: MessageStatus.PENDING,
    ...(options.userJid && { participant: options.userJid }),
  }
}
