import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { MediaError } from '../core/errors.js'
import type { MediaSource } from './media-types.js'

export interface ResizeOptions {
  width: number
  height?: number
  fit?: 'inside' | 'cover'
  quality?: number
  format?: 'jpeg' | 'webp' | 'png'
}

export interface VideoInfo {
  durationSeconds?: number | undefined
  width?: number | undefined
  height?: number | undefined
}

/** Kemampuan pemrosesan media; semuanya opsional. */
export interface MediaProcessor {
  resizeImage?(input: Buffer, options: ResizeOptions): Promise<Buffer>
  toWebp?(input: Buffer, options: { size: number; animated?: boolean }): Promise<Buffer>
  videoInfo?(path: string): Promise<VideoInfo>
  videoThumbnail?(path: string, options: { width: number; atSeconds?: number }): Promise<Buffer>
  /** PCM mono 16-bit (untuk waveform). */
  decodeAudio?(path: string): Promise<Int16Array>
  convertToOpus?(path: string): Promise<Buffer>
}

/** Gabungkan beberapa processor; kemampuan pertama yang ada dipakai. */
export function combineProcessors(...processors: MediaProcessor[]): MediaProcessor {
  const out: Record<string, unknown> = {}
  for (const p of processors) {
    for (const key of Object.keys(p) as Array<keyof MediaProcessor>) {
      if (typeof p[key] === 'function' && !(key in out)) out[key] = (p[key] as (...a: unknown[]) => unknown).bind(p)
    }
  }
  return out as MediaProcessor
}

// ---- sharp (opsional) ------------------------------------------------------------------

interface SharpLike {
  (input: Buffer, options?: object): SharpInstance
}
interface SharpInstance {
  resize(options: object): SharpInstance
  jpeg(options: object): SharpInstance
  webp(options: object): SharpInstance
  png(): SharpInstance
  toBuffer(): Promise<Buffer>
}

export async function loadSharp(): Promise<SharpLike | undefined> {
  const specifier = 'sharp'
  try {
    const mod = (await import(specifier)) as { default?: SharpLike }
    return mod.default ?? (mod as unknown as SharpLike)
  } catch {
    return undefined
  }
}

export function createSharpProcessor(sharp: SharpLike): MediaProcessor {
  return {
    async resizeImage(input, o) {
      const img = sharp(input).resize({
        width: o.width,
        ...(o.height !== undefined && { height: o.height }),
        fit: o.fit ?? 'inside',
        withoutEnlargement: true,
      })
      if (o.format === 'webp') return img.webp({ quality: o.quality ?? 80 }).toBuffer()
      if (o.format === 'png') return img.png().toBuffer()
      return img.jpeg({ quality: o.quality ?? 50 }).toBuffer()
    },
    async toWebp(input, o) {
      return sharp(input, { animated: o.animated ?? false })
        .resize({ width: o.size, height: o.size, fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
        .webp({ quality: 80 })
        .toBuffer()
    },
  }
}

// ---- ffmpeg (opsional) -------------------------------------------------------------------

function run(command: string, args: string[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    const out: Buffer[] = []
    const err: Buffer[] = []
    child.stdout.on('data', (c: Buffer) => out.push(c))
    child.stderr.on('data', (c: Buffer) => err.push(c))
    child.on('error', (cause) => reject(new MediaError(`Failed to run ${command}`, { cause })))
    child.on('close', (code) =>
      code === 0
        ? resolve(Buffer.concat(out))
        : reject(new MediaError(`${command} exited with ${code}: ${Buffer.concat(err).toString().slice(-300)}`)),
    )
  })
}

export async function hasFfmpeg(ffmpegPath = 'ffmpeg'): Promise<boolean> {
  try {
    await run(ffmpegPath, ['-version'])
    return true
  } catch {
    return false
  }
}

export function createFfmpegProcessor(ffmpegPath = 'ffmpeg', ffprobePath = 'ffprobe'): MediaProcessor {
  return {
    async videoInfo(path) {
      const json = JSON.parse(
        (await run(ffprobePath, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', path])).toString(),
      ) as { format?: { duration?: string }; streams?: Array<{ codec_type?: string; width?: number; height?: number }> }
      const video = json.streams?.find((s) => s.codec_type === 'video')
      const duration = Number(json.format?.duration)
      return {
        durationSeconds: Number.isFinite(duration) ? Math.ceil(duration) : undefined,
        width: video?.width,
        height: video?.height,
      }
    },
    videoThumbnail(path, o) {
      return run(ffmpegPath, ['-v', 'error', '-ss', String(o.atSeconds ?? 0), '-i', path, '-frames:v', '1', '-vf', `scale=${o.width}:-1`, '-f', 'image2pipe', '-vcodec', 'mjpeg', '-']).then(
        (b) => b,
      )
    },
    async decodeAudio(path) {
      const raw = await run(ffmpegPath, ['-v', 'error', '-i', path, '-f', 's16le', '-ac', '1', '-ar', '8000', '-'])
      return new Int16Array(raw.buffer, raw.byteOffset, Math.floor(raw.length / 2))
    },
    convertToOpus(path) {
      return run(ffmpegPath, ['-v', 'error', '-i', path, '-vn', '-c:a', 'libopus', '-b:a', '48k', '-ac', '1', '-f', 'ogg', '-'])
    },
  }
}

/** Processor otomatis: sharp dan/atau ffmpeg bila tersedia. */
export async function createDefaultProcessor(): Promise<MediaProcessor> {
  const parts: MediaProcessor[] = []
  const sharp = await loadSharp()
  if (sharp) parts.push(createSharpProcessor(sharp))
  if (await hasFfmpeg()) parts.push(createFfmpegProcessor())
  return combineProcessors(...parts)
}

// ---- file lokal sementara -----------------------------------------------------------------

/** Pastikan sumber tersedia sebagai file lokal selama `fn` berjalan. */
export async function withLocalFile<T>(
  source: MediaSource,
  fn: (path: string) => Promise<T>,
  options: { tmpDir?: string; fetch?: typeof fetch } = {},
): Promise<T> {
  if ('path' in source) return fn(source.path)

  const tmp = join(options.tmpDir ?? tmpdir(), `corvus-${randomUUID()}.tmp`)
  try {
    if ('buffer' in source) {
      await writeFile(tmp, source.buffer, { mode: 0o600 })
    } else if ('stream' in source) {
      await pipeline(source.stream, createWriteStream(tmp, { mode: 0o600 }))
    } else {
      const res = await (options.fetch ?? fetch)(source.url)
      if (!res.ok || !res.body) throw new MediaError(`Failed to fetch media (${res.status})`, { statusCode: res.status })
      await pipeline(Readable.fromWeb(res.body as never), createWriteStream(tmp, { mode: 0o600 }))
    }
    return await fn(tmp)
  } finally {
    await rm(tmp, { force: true })
  }
}

/**
 * Processor yang baru memuat sharp/ffmpeg saat pertama dipakai. Metode yang tidak
 * didukung lingkungan melempar `MediaError` yang menjelaskan dependensi yang kurang.
 */
export function createLazyProcessor(load: () => Promise<MediaProcessor> = createDefaultProcessor): MediaProcessor {
  let loaded: Promise<MediaProcessor> | undefined
  const get = (): Promise<MediaProcessor> => (loaded ??= load())
  const missing = (name: string): MediaError =>
    new MediaError(`Media operation "${name}" is not available (install sharp and/or ffmpeg)`, { code: 'ERR_MEDIA_UNSUPPORTED' })

  return {
    async resizeImage(input, options) {
      const p = await get()
      if (!p.resizeImage) throw missing('resizeImage')
      return p.resizeImage(input, options)
    },
    async toWebp(input, options) {
      const p = await get()
      if (!p.toWebp) throw missing('toWebp')
      return p.toWebp(input, options)
    },
    async videoInfo(path) {
      const p = await get()
      if (!p.videoInfo) throw missing('videoInfo')
      return p.videoInfo(path)
    },
    async videoThumbnail(path, options) {
      const p = await get()
      if (!p.videoThumbnail) throw missing('videoThumbnail')
      return p.videoThumbnail(path, options)
    },
    async decodeAudio(path) {
      const p = await get()
      if (!p.decodeAudio) throw missing('decodeAudio')
      return p.decodeAudio(path)
    },
    async convertToOpus(path) {
      const p = await get()
      if (!p.convertToOpus) throw missing('convertToOpus')
      return p.convertToOpus(path)
    },
  }
}
