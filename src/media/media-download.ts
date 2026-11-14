import { createHash } from 'node:crypto'
import { PassThrough, Readable, Transform, pipeline } from 'node:stream'
import { MediaError } from '../core/errors.js'
import { createMediaDecryptStream, type MediaType } from '../crypto/media-crypto.js'
import { safeEqual } from '../crypto/decryption.js'
import type { MessageContent } from '../messages/message-utils.js'
import { normalizeMessageContent } from '../messages/message-utils.js'
import type { FetchLike } from './media-upload.js'
import { DEFAULT_MEDIA_HOST } from './media-types.js'

export interface DownloadableMedia {
  url?: string | null | undefined
  directPath?: string | null | undefined
  mediaKey: Uint8Array
  fileEncSha256?: Uint8Array | null | undefined
}

export interface DownloadOptions {
  fetch?: FetchLike
  host?: string
  /** Periksa hash berkas terenkripsi (default true bila tersedia). */
  verifyHash?: boolean
  timeoutMs?: number
}

function hashVerifier(expected: Uint8Array): Transform {
  const hash = createHash('sha256')
  return new Transform({
    transform(chunk: Buffer, _e, cb) {
      hash.update(chunk)
      cb(null, chunk)
    },
    flush(cb) {
      cb(safeEqual(hash.digest(), expected) ? null : new MediaError('Encrypted media hash mismatch', { code: 'ERR_MEDIA_HASH' }))
    },
  })
}

/** Unduh dan dekripsi media sebagai stream. Buang output jika stream berakhir error. */
export async function downloadMedia(
  media: DownloadableMedia,
  type: MediaType,
  options: DownloadOptions = {},
): Promise<Readable> {
  const url = media.url ?? (media.directPath ? `https://${options.host ?? DEFAULT_MEDIA_HOST}${media.directPath}` : undefined)
  if (!url) throw new MediaError('Media has neither url nor directPath')

  const res = await (options.fetch ?? fetch)(url, {
    headers: { Origin: 'https://web.whatsapp.com' },
    signal: AbortSignal.timeout(options.timeoutMs ?? 120_000),
  })
  if (!res.ok || !res.body) {
    throw new MediaError(`Media download failed (${res.status})`, {
      statusCode: res.status,
      code: 'ERR_MEDIA_HTTP',
      // 404/410: media kedaluwarsa, perlu diminta ulang oleh pengirim
      data: { url, expired: res.status === 404 || res.status === 410 },
    })
  }

  const decrypt = createMediaDecryptStream(type, media.mediaKey)
  const out = new PassThrough()
  const stages: Array<NodeJS.ReadWriteStream | Readable> = [Readable.fromWeb(res.body as never)]
  if (media.fileEncSha256 && options.verifyHash !== false) stages.push(hashVerifier(media.fileEncSha256))
  stages.push(decrypt, out)
  pipeline(stages as never, (error: Error | null | undefined) => {
    if (error) out.destroy(error)
  })
  return out
}

export async function downloadMediaToBuffer(media: DownloadableMedia, type: MediaType, options?: DownloadOptions): Promise<Buffer> {
  const stream = await downloadMedia(media, type, options)
  const chunks: Buffer[] = []
  for await (const chunk of stream) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks)
}

/** Cari bagian media pada isi pesan beserta tipe kripto-nya. */
export function extractMedia(content: MessageContent | null | undefined): { media: DownloadableMedia; type: MediaType } | undefined {
  const c = normalizeMessageContent(content)
  if (!c) return undefined
  const pick = (key: string, type: MediaType): { media: DownloadableMedia; type: MediaType } | undefined =>
    c[key]?.mediaKey ? { media: c[key] as DownloadableMedia, type } : undefined

  return (
    pick('imageMessage', 'image') ??
    (c.videoMessage ? pick('videoMessage', c.videoMessage.gifPlayback ? 'gif' : 'video') : undefined) ??
    (c.audioMessage ? pick('audioMessage', c.audioMessage.ptt ? 'ptt' : 'audio') : undefined) ??
    pick('documentMessage', 'document') ??
    pick('stickerMessage', 'sticker')
  )
}
