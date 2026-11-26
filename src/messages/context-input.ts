/**
 * `contextInfo` tingkat-tinggi: external ad reply (kartu pratinjau link), tanda "diteruskan",
 * diteruskan dari saluran, mention semua, dan field mentah lain. Berlaku untuk semua jenis pesan.
 */
export interface ExternalAdReplyInput {
  title?: string
  body?: string
  /** `image` / `video` / `none` (atau angka proto 0/1/2). */
  mediaType?: 'none' | 'image' | 'video' | number
  thumbnailUrl?: string
  mediaUrl?: string
  /** Bytes JPEG pratinjau. */
  thumbnail?: Uint8Array
  sourceUrl?: string
  sourceType?: string
  sourceId?: string
  containsAutoReply?: boolean
  renderLargerThumbnail?: boolean
  showAdAttribution?: boolean
}

export interface ForwardedNewsletterInput {
  /** JID saluran, mis. `120363...@newsletter`. */
  jid: string
  serverMessageId?: number
  name?: string
}

export interface ContextInfoInput {
  externalAdReply?: ExternalAdReplyInput
  isForwarded?: boolean
  forwardingScore?: number
  /** Tampilkan pesan seolah diteruskan dari saluran WhatsApp. */
  forwardedNewsletter?: ForwardedNewsletterInput
  mentions?: string[]
  /** Mention semua anggota grup (`@everyone`). */
  mentionAll?: boolean
  groupMentions?: Array<{ groupJid: string; groupSubject: string }>
  /** Durasi pesan sementara (detik). */
  expiration?: number
  entryPointConversionSource?: string
  entryPointConversionApp?: string
  alwaysShowAdAttribution?: boolean
  /** Field `ContextInfo` proto mentah tambahan. */
  raw?: Record<string, unknown>
}

const MEDIA_TYPE = { none: 0, image: 1, video: 2 } as const

/** Ubah `ContextInfoInput` menjadi objek `ContextInfo` proto. */
export function contextInfoFromInput(input: ContextInfoInput | undefined): Record<string, unknown> {
  if (!input) return {}
  const ad = input.externalAdReply
  return {
    ...(ad && {
      externalAdReply: {
        ...(ad.title !== undefined && { title: ad.title }),
        ...(ad.body !== undefined && { body: ad.body }),
        mediaType: typeof ad.mediaType === 'number' ? ad.mediaType : MEDIA_TYPE[ad.mediaType ?? 'image'],
        ...(ad.thumbnailUrl !== undefined && { thumbnailUrl: ad.thumbnailUrl }),
        ...(ad.mediaUrl !== undefined && { mediaUrl: ad.mediaUrl }),
        ...(ad.thumbnail && { thumbnail: ad.thumbnail }),
        ...(ad.sourceUrl !== undefined && { sourceUrl: ad.sourceUrl }),
        ...(ad.sourceType !== undefined && { sourceType: ad.sourceType }),
        ...(ad.sourceId !== undefined && { sourceId: ad.sourceId }),
        ...(ad.containsAutoReply !== undefined && { containsAutoReply: ad.containsAutoReply }),
        ...(ad.renderLargerThumbnail !== undefined && { renderLargerThumbnail: ad.renderLargerThumbnail }),
        ...(ad.showAdAttribution !== undefined && { showAdAttribution: ad.showAdAttribution }),
      },
    }),
    ...(input.forwardedNewsletter && {
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterJid: input.forwardedNewsletter.jid,
        serverMessageId: input.forwardedNewsletter.serverMessageId ?? 100,
        ...(input.forwardedNewsletter.name !== undefined && { newsletterName: input.forwardedNewsletter.name }),
      },
    }),
    ...(input.isForwarded !== undefined && { isForwarded: input.isForwarded }),
    ...(input.forwardingScore !== undefined && { forwardingScore: input.forwardingScore }),
    ...(input.mentions?.length && { mentionedJid: [...new Set(input.mentions)] }),
    ...(input.mentionAll && { nonJidMentions: 1 }),
    ...(input.groupMentions?.length && { groupMentions: input.groupMentions }),
    ...(input.expiration !== undefined && { expiration: input.expiration }),
    ...(input.entryPointConversionSource !== undefined && { entryPointConversionSource: input.entryPointConversionSource }),
    ...(input.entryPointConversionApp !== undefined && { entryPointConversionApp: input.entryPointConversionApp }),
    ...(input.alwaysShowAdAttribution !== undefined && { alwaysShowAdAttribution: input.alwaysShowAdAttribution }),
    ...input.raw,
  }
}
