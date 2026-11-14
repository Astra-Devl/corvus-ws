import type { MediaProcessor } from './media-processor.js'

export const THUMBNAIL_WIDTH = 32
export const THUMBNAIL_QUALITY = 50

/** Thumbnail JPEG kecil; `undefined` bila tidak ada kemampuan resize. */
export async function generateThumbnail(
  image: Buffer,
  processor: MediaProcessor | undefined,
  options: { width?: number; quality?: number } = {},
): Promise<Buffer | undefined> {
  if (!processor?.resizeImage) return undefined
  try {
    return await processor.resizeImage(image, {
      width: options.width ?? THUMBNAIL_WIDTH,
      quality: options.quality ?? THUMBNAIL_QUALITY,
      format: 'jpeg',
    })
  } catch {
    return undefined // thumbnail bersifat opsional
  }
}

/** Thumbnail dari frame video; `undefined` bila tidak didukung. */
export async function generateVideoThumbnail(
  path: string,
  processor: MediaProcessor | undefined,
  atSeconds = 0,
): Promise<Buffer | undefined> {
  if (!processor?.videoThumbnail) return undefined
  try {
    const frame = await processor.videoThumbnail(path, { width: 256, atSeconds })
    return (await generateThumbnail(frame, processor)) ?? frame
  } catch {
    return undefined
  }
}
