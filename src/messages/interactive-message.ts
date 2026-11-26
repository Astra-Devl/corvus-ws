import type { HeaderInput, InteractiveInput } from './button-types.js'
import { MessageError } from '../core/errors.js'
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

const RAW_SOURCE_KEYS = ['url', 'path', 'buffer', 'stream']

export function buildHeader(header: HeaderInput | undefined): MessageContent | undefined {
  if (!header) return undefined
  if (header.media && RAW_SOURCE_KEYS.some((k) => k in header.media!)) {
    throw new MessageError(
      'header.media harus hasil client.media.prepare(...) (mis. { imageMessage }). Untuk link/file langsung, pakai header.image / header.video / header.document lewat sock.sendMessage.',
      { code: 'ERR_VALIDATION' },
    )
  }
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
  return input.wrap === true ? wrapInteractive(content) : content
}
