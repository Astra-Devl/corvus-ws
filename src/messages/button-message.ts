import { MessageError } from '../core/errors.js'
import type { ButtonsInput } from './button-types.js'
import { assertText, validateReplyButtons } from './button-utils.js'
import type { MessageContent } from './message-utils.js'

const HEADER_TYPE = { EMPTY: 1, TEXT: 2, DOCUMENT: 3, IMAGE: 4, VIDEO: 5, LOCATION: 6 } as const

/** Pilih header media dari konten yang sudah disiapkan. */
function mediaHeader(media: MessageContent | undefined): { key: string; type: number } | undefined {
  if (!media) return undefined
  if (media.imageMessage) return { key: 'imageMessage', type: HEADER_TYPE.IMAGE }
  if (media.videoMessage) return { key: 'videoMessage', type: HEADER_TYPE.VIDEO }
  if (media.documentMessage) return { key: 'documentMessage', type: HEADER_TYPE.DOCUMENT }
  throw new MessageError('buttons.media harus berisi imageMessage / videoMessage / documentMessage (hasil media.prepare)')
}
const BUTTON_TYPE_RESPONSE = 1

/** `buttonsMessage` klasik (maks. 3 tombol balas cepat). */
export function buildButtonsMessage(input: ButtonsInput): MessageContent {
  assertText('text', input.text)
  validateReplyButtons(input.buttons)
  if (input.footer !== undefined) assertText('footer', input.footer, 60 * 4)
  if (input.header !== undefined) assertText('header', input.header, 60 * 4)

  const header = mediaHeader(input.media)
  return {
    buttonsMessage: {
      contentText: input.text,
      ...(input.footer !== undefined && { footerText: input.footer }),
      ...(header ? { [header.key]: input.media![header.key] } : input.locationMessage ? { locationMessage: input.locationMessage } : input.header !== undefined ? { text: input.header } : {}),
      headerType: header ? header.type : input.locationMessage ? HEADER_TYPE.LOCATION : input.header !== undefined ? HEADER_TYPE.TEXT : HEADER_TYPE.EMPTY,
      buttons: input.buttons.map((b) => ({
        buttonId: b.id,
        buttonText: { displayText: b.text },
        type: BUTTON_TYPE_RESPONSE,
      })),
    },
  }
}
