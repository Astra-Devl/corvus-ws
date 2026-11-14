import type { CarouselInput } from './button-types.js'
import { assertCount, assertText, BUTTON_LIMITS } from './button-utils.js'
import { buildHeader, wrapInteractive } from './interactive-message.js'
import { buildNativeFlow } from './native-flow.js'
import type { MessageContent } from './message-utils.js'

/** Carousel: beberapa kartu interaktif dalam satu pesan. */
export function buildCarouselMessage(input: CarouselInput): MessageContent {
  assertCount('cards', input.cards.length, BUTTON_LIMITS.carouselCards)

  const cards = input.cards.map((card) => {
    assertText('card.body', card.body)
    const header = buildHeader(card.header)
    return {
      ...(header && { header }),
      body: { text: card.body },
      ...(card.footer !== undefined && { footer: { text: card.footer } }),
      nativeFlowMessage: buildNativeFlow(card.buttons),
    }
  })

  const header = buildHeader(input.header)
  const content: MessageContent = {
    interactiveMessage: {
      ...(header && { header }),
      ...(input.body !== undefined && { body: { text: input.body } }),
      ...(input.footer !== undefined && { footer: { text: input.footer } }),
      carouselMessage: { cards, messageVersion: 1 },
    },
  }
  return input.wrap === false ? content : wrapInteractive(content)
}
