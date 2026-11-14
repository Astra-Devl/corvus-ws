import { randomBytes } from 'node:crypto'
import { MessageError } from '../core/errors.js'
import type { TemplateButton, TemplateInput } from './button-types.js'
import { assertCount, assertPhone, assertText, assertUniqueIds, assertUrl, BUTTON_LIMITS } from './button-utils.js'
import type { MessageContent } from './message-utils.js'

function hydrate(button: TemplateButton, index: number): MessageContent {
  assertText('button.text', button.text, 25 * 4)
  switch (button.type) {
    case 'reply':
      assertText('button.id', button.id, 256)
      return { index, quickReplyButton: { displayText: button.text, id: button.id } }
    case 'url':
      assertUrl('button.url', button.url)
      return { index, urlButton: { displayText: button.text, url: button.url } }
    case 'call':
      assertPhone('button.phoneNumber', button.phoneNumber)
      return { index, callButton: { displayText: button.text, phoneNumber: button.phoneNumber } }
    default:
      throw new MessageError(`Unknown template button type: ${String((button as { type?: unknown }).type)}`)
  }
}

/** `templateMessage` dengan `hydratedTemplate` (maks. 4 tombol). */
export function buildTemplateMessage(input: TemplateInput): MessageContent {
  assertText('text', input.text)
  assertCount('buttons', input.buttons.length, BUTTON_LIMITS.templateButtons)
  assertUniqueIds(input.buttons.flatMap((b) => (b.type === 'reply' ? [b.id] : [])), 'button')

  return {
    templateMessage: {
      hydratedTemplate: {
        hydratedContentText: input.text,
        ...(input.footer !== undefined && { hydratedFooterText: input.footer }),
        ...(input.title !== undefined && { hydratedTitleText: input.title }),
        templateId: input.templateId ?? randomBytes(8).toString('hex'),
        hydratedButtons: input.buttons.map(hydrate),
      },
    },
  }
}
