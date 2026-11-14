import type { ListInput } from './button-types.js'
import { assertText, validateSections } from './button-utils.js'
import type { MessageContent } from './message-utils.js'

const LIST_TYPE_SINGLE_SELECT = 1

/** `listMessage` (menu pilihan satu). */
export function buildListMessage(input: ListInput): MessageContent {
  assertText('title', input.title, 60 * 4)
  assertText('text', input.text)
  assertText('buttonText', input.buttonText, 20 * 4)
  validateSections(input.sections)
  if (input.footer !== undefined) assertText('footer', input.footer, 60 * 4)

  return {
    listMessage: {
      title: input.title,
      description: input.text,
      buttonText: input.buttonText,
      listType: LIST_TYPE_SINGLE_SELECT,
      ...(input.footer !== undefined && { footerText: input.footer }),
      sections: input.sections.map((s) => ({
        title: s.title,
        rows: s.rows.map((r) => ({ title: r.title, rowId: r.id, ...(r.description !== undefined && { description: r.description }) })),
      })),
    },
  }
}
