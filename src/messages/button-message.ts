import type { ButtonsInput } from './button-types.js'
import { assertText, validateReplyButtons } from './button-utils.js'
import type { MessageContent } from './message-utils.js'

const HEADER_TYPE = { EMPTY: 1, TEXT: 2 } as const
const BUTTON_TYPE_RESPONSE = 1

/** `buttonsMessage` klasik (maks. 3 tombol balas cepat). */
export function buildButtonsMessage(input: ButtonsInput): MessageContent {
  assertText('text', input.text)
  validateReplyButtons(input.buttons)
  if (input.footer !== undefined) assertText('footer', input.footer, 60 * 4)
  if (input.header !== undefined) assertText('header', input.header, 60 * 4)

  return {
    buttonsMessage: {
      contentText: input.text,
      ...(input.footer !== undefined && { footerText: input.footer }),
      ...(input.header !== undefined && { text: input.header }),
      headerType: input.header !== undefined ? HEADER_TYPE.TEXT : HEADER_TYPE.EMPTY,
      buttons: input.buttons.map((b) => ({
        buttonId: b.id,
        buttonText: { displayText: b.text },
        type: BUTTON_TYPE_RESPONSE,
      })),
    },
  }
}
