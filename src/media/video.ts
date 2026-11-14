import { MediaError } from '../core/errors.js'
import type { MediaProcessor } from './media-processor.js'
import { detectMime, mimeFromFileName } from './media-types.js'
import { generateVideoThumbnail } from './thumbnails.js'

export interface PreparedVideo {
  mimetype: string
  seconds?: number
  width?: number
  height?: number
  jpegThumbnail?: Buffer
  gifPlayback?: boolean
}

export interface PrepareVideoOptions {
  processor?: MediaProcessor
  mimetype?: string
  gif?: boolean
  thumbnail?: boolean
}

/** Metadata video dari file lokal (durasi, dimensi, thumbnail) bila ffmpeg tersedia. */
export async function prepareVideo(path: string, head: Uint8Array, options: PrepareVideoOptions = {}): Promise<PreparedVideo> {
  const mimetype = options.mimetype ?? detectMime(head) ?? mimeFromFileName(path)
  if (!mimetype?.startsWith('video/')) throw new MediaError('Data is not a recognised video')

  const info = await options.processor?.videoInfo?.(path).catch(() => undefined)
  const thumb = options.thumbnail === false ? undefined : await generateVideoThumbnail(path, options.processor)

  return {
    mimetype,
    ...(info?.durationSeconds !== undefined && { seconds: info.durationSeconds }),
    ...(info?.width !== undefined && { width: info.width }),
    ...(info?.height !== undefined && { height: info.height }),
    ...(thumb && { jpegThumbnail: thumb }),
    ...(options.gif && { gifPlayback: true }),
  }
}
