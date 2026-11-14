import { createReadStream } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { MediaError } from '../core/errors.js'
import { noopLogger } from '../core/defaults.js'
import type { Logger } from '../core/socket-config.js'
import type { MessageInput } from '../messages/generate-message.js'
import type { MessageContent } from '../messages/message-utils.js'
import { prepareAudio } from './audio.js'
import { prepareDocument } from './document.js'
import { prepareImage } from './image.js'
import { downloadMedia, downloadMediaToBuffer, extractMedia, type DownloadOptions } from './media-download.js'
import { withLocalFile, type MediaProcessor } from './media-processor.js'
import { MediaUploader, type FetchLike, type MediaUploaderOptions } from './media-upload.js'
import { contentKeyForKind, type MediaKind, type MediaSource, type UploadResult } from './media-types.js'
import { prepareSticker, type StickerMeta } from './stickers.js'
import { prepareVideo } from './video.js'
import { detectMime } from './media-types.js'

export interface MediaManagerOptions {
  query: MediaUploaderOptions['query']
  fetch?: FetchLike
  processor?: MediaProcessor
  tmpDir?: string
  /** Batas ukuran sumber yang dibaca ke memori (default 64 MiB). */
  maxBufferBytes?: number
  logger?: Logger
}

export interface PrepareMediaOptions {
  caption?: string
  fileName?: string
  mimetype?: string
  viewOnce?: boolean
  /** Buat thumbnail bila memungkinkan (default true). */
  thumbnail?: boolean
  sticker?: StickerMeta
}

const DEFAULT_MAX_BUFFER = 64 * 1024 * 1024

export class MediaManager {
  readonly uploader: MediaUploader
  readonly #opts: MediaManagerOptions
  readonly #fetch: FetchLike
  readonly #logger: Logger
  readonly #max: number

  constructor(options: MediaManagerOptions) {
    this.#opts = options
    this.#fetch = options.fetch ?? fetch
    this.#logger = options.logger ?? noopLogger
    this.#max = options.maxBufferBytes ?? DEFAULT_MAX_BUFFER
    this.uploader = new MediaUploader({
      query: options.query,
      fetch: this.#fetch,
      logger: this.#logger,
      ...(options.tmpDir && { tmpDir: options.tmpDir }),
    })
  }

  /** Baca sumber ke memori dengan batas ukuran. */
  async readSource(source: MediaSource): Promise<Buffer> {
    const tooBig = (): MediaError => new MediaError(`Media exceeds ${this.#max} bytes; use a file path for large media`, { code: 'ERR_MEDIA_TOO_LARGE' })

    if ('buffer' in source) {
      if (source.buffer.length > this.#max) throw tooBig()
      return Buffer.from(source.buffer)
    }
    if ('path' in source) {
      if ((await stat(source.path)).size > this.#max) throw tooBig()
      return readFile(source.path)
    }

    let stream: Readable
    if ('stream' in source) stream = source.stream
    else {
      const res = await this.#fetch(source.url)
      if (!res.ok || !res.body) throw new MediaError(`Failed to fetch media (${res.status})`, { statusCode: res.status })
      stream = Readable.fromWeb(res.body as never)
    }
    const chunks: Buffer[] = []
    let total = 0
    for await (const chunk of stream) {
      total += (chunk as Buffer).length
      if (total > this.#max) {
        stream.destroy()
        throw tooBig()
      }
      chunks.push(chunk as Buffer)
    }
    return Buffer.concat(chunks)
  }

  /** Siapkan media: metadata, thumbnail, enkripsi, unggah -> isi pesan WAProto. */
  async prepare(kind: MediaKind, source: MediaSource, options: PrepareMediaOptions = {}): Promise<MessageContent> {
    const processor = this.#opts.processor
    const thumbnail = options.thumbnail ?? true
    let fields: object = {}
    let upload: UploadResult

    if (kind === 'video' || kind === 'gif') {
      upload = await withLocalFile(
        source,
        async (path) => {
          const head = await readHead(path)
          fields = await prepareVideo(path, head, { ...(processor && { processor }), gif: kind === 'gif', thumbnail, ...(options.mimetype && { mimetype: options.mimetype }) })
          return this.uploader.upload(createReadStream(path), kind)
        },
        { ...(this.#opts.tmpDir && { tmpDir: this.#opts.tmpDir }), fetch: this.#fetch },
      )
    } else if (kind === 'document' && 'path' in source) {
      const head = await readHead(source.path)
      fields = { ...prepareDocument({ fileName: options.fileName ?? source.path.split(/[\\/]/).pop()!, head, ...(options.mimetype && { mimetype: options.mimetype }) }) }
      upload = await this.uploader.upload(createReadStream(source.path), 'document')
    } else {
      const data = await this.readSource(source)
      let payload = data
      switch (kind) {
        case 'image':
          fields = await prepareImage(data, { ...(processor && { processor }), thumbnail, ...(options.mimetype && { mimetype: options.mimetype }) })
          break
        case 'audio':
        case 'ptt': {
          const { data: converted, ...rest } = await prepareAudio(data, { ...(processor && { processor }), ptt: kind === 'ptt', ...(options.mimetype && { mimetype: options.mimetype }), ...(this.#opts.tmpDir && { tmpDir: this.#opts.tmpDir }) })
          payload = converted
          fields = rest
          break
        }
        case 'document':
          fields = { ...prepareDocument({ fileName: options.fileName ?? 'file', head: data, ...(options.mimetype && { mimetype: options.mimetype }) }) }
          break
        case 'sticker': {
          const { data: webp, ...rest } = await prepareSticker(data, { ...(processor && { processor }), ...(options.sticker && { meta: options.sticker }) })
          payload = webp
          fields = rest
          break
        }
      }
      upload = await this.uploader.upload(Readable.from([payload]), kind)
    }

    const content: MessageContent = {
      [contentKeyForKind(kind)]: {
        url: upload.url,
        directPath: upload.directPath,
        mediaKey: upload.mediaKey,
        fileSha256: upload.fileSha256,
        fileEncSha256: upload.fileEncSha256,
        fileLength: upload.fileLength,
        mediaKeyTimestamp: upload.mediaKeyTimestamp,
        ...fields,
        ...(options.caption !== undefined && kind !== 'audio' && kind !== 'ptt' && kind !== 'sticker' && { caption: options.caption }),
      },
    }
    return options.viewOnce && (kind === 'image' || kind === 'video') ? { viewOnceMessage: { message: content } } : content
  }

  /** Bentuk siap-kirim untuk `MessageSender.send()`. */
  async toInput(kind: MediaKind, source: MediaSource, options?: PrepareMediaOptions): Promise<MessageInput> {
    return { raw: await this.prepare(kind, source, options) }
  }

  /** Unduh media dari isi pesan sebagai stream (terdekripsi). */
  async download(content: MessageContent, options: DownloadOptions = {}): Promise<Readable> {
    const found = extractMedia(content)
    if (!found) throw new MediaError('Message has no downloadable media')
    return downloadMedia(found.media, found.type, { fetch: this.#fetch, ...options })
  }

  async downloadToBuffer(content: MessageContent, options: DownloadOptions = {}): Promise<Buffer> {
    const found = extractMedia(content)
    if (!found) throw new MediaError('Message has no downloadable media')
    return downloadMediaToBuffer(found.media, found.type, { fetch: this.#fetch, ...options })
  }
}

async function readHead(path: string): Promise<Buffer> {
  const stream = createReadStream(path, { start: 0, end: 31 })
  const chunks: Buffer[] = []
  for await (const c of stream) chunks.push(c as Buffer)
  return Buffer.concat(chunks)
}

export { detectMime }
