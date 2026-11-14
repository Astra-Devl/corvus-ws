import { MediaError } from '../core/errors.js'
import { detectMime } from './media-types.js'
import type { MediaProcessor } from './media-processor.js'
import { generateThumbnail } from './thumbnails.js'

export interface ImageSize {
  width: number
  height: number
}

/** Baca dimensi gambar dari header (PNG, JPEG, GIF, WebP) tanpa dekode. */
export function probeImageSize(data: Uint8Array): ImageSize | undefined {
  const b = Buffer.from(data.buffer, data.byteOffset, data.length)
  const mime = detectMime(b)

  if (mime === 'image/png' && b.length >= 24) {
    return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) }
  }
  if (mime === 'image/gif' && b.length >= 10) {
    return { width: b.readUInt16LE(6), height: b.readUInt16LE(8) }
  }
  if (mime === 'image/jpeg') {
    let i = 2
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i++
        continue
      }
      const marker = b[i + 1]!
      if (marker === 0xff) {
        i++
        continue
      }
      const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
      if (isSof) return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) }
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
        i += 2
        continue
      }
      i += 2 + b.readUInt16BE(i + 2)
    }
    return undefined
  }
  if (mime === 'image/webp' && b.length >= 30) {
    const kind = b.toString('latin1', 12, 16)
    if (kind === 'VP8X') return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) }
    if (kind === 'VP8L') {
      const bits = b.readUInt32LE(21)
      return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
    }
    if (kind === 'VP8 ') return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff }
  }
  return undefined
}

export interface PreparedImage {
  mimetype: string
  width?: number
  height?: number
  jpegThumbnail?: Buffer
}

export interface PrepareImageOptions {
  processor?: MediaProcessor
  mimetype?: string
  thumbnail?: boolean
}

/** Kumpulkan metadata gambar (mimetype, dimensi, thumbnail JPEG). */
export async function prepareImage(data: Buffer, options: PrepareImageOptions = {}): Promise<PreparedImage> {
  const mimetype = options.mimetype ?? detectMime(data)
  if (!mimetype?.startsWith('image/')) throw new MediaError('Data is not a recognised image')

  const size = probeImageSize(data)
  const thumb = options.thumbnail === false ? undefined : await generateThumbnail(data, options.processor)
  return {
    mimetype,
    ...(size && size),
    ...(thumb && { jpegThumbnail: thumb }),
  }
}
