import type { HeaderInput, InteractiveInput } from './button-types.js'
import { assertText } from './button-utils.js'
import { buildNativeFlow } from './native-flow.js'
import type { MessageContent } from './message-utils.js'

/** Pembungkus yang lazim dipakai agar pesan interaktif dirender. */
export function wrapInteractive(content: MessageContent): MessageContent {
  return {
    viewOnceMessage: {
      message: {
        messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2 },
        ...content,
      },
    },
  }
}

export function buildHeader(header: HeaderInput | undefined): MessageContent | undefined {
  if (!header) return undefined
  if (header.title !== undefined) assertText('header.title', header.title, 60 * 4)
  return {
    ...(header.title !== undefined && { title: header.title }),
    ...(header.subtitle !== undefined && { subtitle: header.subtitle }),
    hasMediaAttachment: header.media !== undefined,
    ...header.media,
  }
}

/** Bangun `interactiveMessage` dengan native flow (balas cepat, URL, telepon, salin, pilihan). */
export function buildInteractiveMessage(input: InteractiveInput): MessageContent {
  assertText('body', input.body)
  const header = buildHeader(input.header)

  const content: MessageContent = {
    interactiveMessage: {
      ...(header && { header }),
      body: { text: input.body },
      ...(input.footer !== undefined && { footer: { text: input.footer } }),
      nativeFlowMessage: buildNativeFlow(input.buttons),
    },
  }
  return input.wrap === false ? content : wrapInteractive(content)
}
