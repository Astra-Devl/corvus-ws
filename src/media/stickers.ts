import { randomBytes } from 'node:crypto'
import { MediaError } from '../core/errors.js'
import { probeImageSize } from './image.js'
import type { MediaProcessor } from './media-processor.js'
import { detectMime } from './media-types.js'

export const STICKER_SIZE = 512

export interface StickerMeta {
  packId?: string
  packName?: string
  publisher?: string
  emojis?: string[]
}

export const isWebp = (data: Uint8Array): boolean => detectMime(data) === 'image/webp'

/** WebP beranimasi (flag animasi pada chunk VP8X). */
export function isAnimatedWebp(data: Uint8Array): boolean {
  const b = Buffer.from(data.buffer, data.byteOffset, data.length)
  return isWebp(b) && b.toString('latin1', 12, 16) === 'VP8X' && (b[20]! & 0x02) !== 0
}

/** Blok EXIF metadata paket stiker. */
export function buildStickerExif(meta: StickerMeta): Buffer {
  const json = Buffer.from(
    JSON.stringify({
      'sticker-pack-id': meta.packId ?? randomBytes(16).toString('hex'),
      'sticker-pack-name': meta.packName ?? '',
      'sticker-pack-publisher': meta.publisher ?? '',
      ...(meta.emojis && { emojis: meta.emojis }),
    }),
    'utf8',
  )
  const header = Buffer.from([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00, 0x00, 0x00, 0x16, 0x00, 0x00, 0x00])
  const exif = Buffer.concat([header, json])
  exif.writeUInt32LE(json.length, 14)
  return exif
}

interface RiffChunk {
  fourcc: string
  data: Buffer
}

function parseRiff(webp: Buffer): RiffChunk[] {
  const chunks: RiffChunk[] = []
  let pos = 12
  while (pos + 8 <= webp.length) {
    const size = webp.readUInt32LE(pos + 4)
    if (pos + 8 + size > webp.length) throw new MediaError('Corrupt WebP chunk')
    chunks.push({ fourcc: webp.toString('latin1', pos, pos + 4), data: webp.subarray(pos + 8, pos + 8 + size) })
    pos += 8 + size + (size % 2)
  }
  return chunks
}

function buildRiff(chunks: RiffChunk[]): Buffer {
  const parts: Buffer[] = []
  for (const { fourcc, data } of chunks) {
    const header = Buffer.alloc(8)
    header.write(fourcc, 0, 'latin1')
    header.writeUInt32LE(data.length, 4)
    parts.push(header, data, ...(data.length % 2 ? [Buffer.alloc(1)] : []))
  }
  const body = Buffer.concat(parts)
  const riff = Buffer.alloc(12)
  riff.write('RIFF', 0, 'latin1')
  riff.writeUInt32LE(4 + body.length, 4)
  riff.write('WEBP', 8, 'latin1')
  return Buffer.concat([riff, body])
}

/** Sisipkan metadata paket stiker ke dalam WebP (menambah VP8X + chunk EXIF). */
export function addStickerExif(webp: Buffer, meta: StickerMeta): Buffer {
  if (!isWebp(webp)) throw new MediaError('Not a WebP image')
  const chunks = parseRiff(webp).filter((c) => c.fourcc !== 'EXIF')

  if (chunks[0]?.fourcc === 'VP8X') {
    const vp8x = Buffer.from(chunks[0].data)
    vp8x[0] = vp8x[0]! | 0x08
    chunks[0] = { fourcc: 'VP8X', data: vp8x }
  } else {
    const size = probeImageSize(webp)
    if (!size) throw new MediaError('Cannot determine WebP dimensions')
    const vp8x = Buffer.alloc(10)
    vp8x[0] = 0x08
    vp8x.writeUIntLE(size.width - 1, 4, 3)
    vp8x.writeUIntLE(size.height - 1, 7, 3)
    chunks.unshift({ fourcc: 'VP8X', data: vp8x })
  }
  chunks.push({ fourcc: 'EXIF', data: buildStickerExif(meta) })
  return buildRiff(chunks)
}

export interface PreparedSticker {
  data: Buffer
  mimetype: 'image/webp'
  width: number
  height: number
  isAnimated: boolean
}

/** Pastikan gambar menjadi stiker WebP 512x512 (dengan metadata bila diberikan). */
export async function prepareSticker(
  data: Buffer,
  options: { processor?: MediaProcessor; meta?: StickerMeta } = {},
): Promise<PreparedSticker> {
  let webp = data
  const size = isWebp(data) ? probeImageSize(data) : undefined
  const ready = size && size.width === STICKER_SIZE && size.height === STICKER_SIZE

  if (!ready) {
    if (!options.processor?.toWebp) {
      throw new MediaError('Sticker must be 512x512 WebP; provide a processor with toWebp (sharp) to convert')
    }
    webp = await options.processor.toWebp(data, { size: STICKER_SIZE, animated: isAnimatedWebp(data) })
  }
  if (options.meta) webp = addStickerExif(webp, options.meta)

  return { data: webp, mimetype: 'image/webp', width: STICKER_SIZE, height: STICKER_SIZE, isAnimated: isAnimatedWebp(webp) }
}
