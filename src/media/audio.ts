import { MediaError } from '../core/errors.js'
import { withLocalFile, type MediaProcessor } from './media-processor.js'
import { detectMime } from './media-types.js'

/** Durasi (detik) dari berkas OGG/Opus; `undefined` bila bukan OGG Opus. */
export function getOggOpusDuration(data: Uint8Array): number | undefined {
  const b = Buffer.from(data.buffer, data.byteOffset, data.length)
  const head = b.indexOf('OpusHead')
  if (head < 0 || head + 12 > b.length) return undefined
  const preSkip = b.readUInt16LE(head + 10)

  const lastPage = b.lastIndexOf('OggS')
  if (lastPage < 0 || lastPage + 14 > b.length) return undefined
  const granule = b.readBigUInt64LE(lastPage + 6)
  if (granule < 0n || granule === 0xffffffffffffffffn) return undefined
  const samples = Number(granule) - preSkip
  return samples > 0 ? Math.ceil(samples / 48_000) : 0
}

/** Waveform 0-100 sebanyak `bins` batang dari sampel PCM (Int16). */
export function computeWaveform(samples: ArrayLike<number>, bins = 64): Uint8Array {
  const out = new Uint8Array(bins)
  if (samples.length === 0) return out
  const block = Math.max(Math.floor(samples.length / bins), 1)
  const averages = new Array<number>(bins).fill(0)

  for (let i = 0; i < bins; i++) {
    let sum = 0
    let count = 0
    for (let j = i * block; j < Math.min((i + 1) * block, samples.length); j++) {
      sum += Math.abs(samples[j]!)
      count++
    }
    averages[i] = count ? sum / count : 0
  }
  const max = Math.max(...averages)
  if (max === 0) return out
  for (let i = 0; i < bins; i++) out[i] = Math.floor((100 * averages[i]!) / max)
  return out
}

export interface PreparedAudio {
  mimetype: string
  seconds?: number
  ptt?: boolean
  waveform?: Uint8Array
  /** Data yang harus diunggah (bisa hasil konversi). */
  data: Buffer
}

export interface PrepareAudioOptions {
  processor?: MediaProcessor
  ptt?: boolean
  mimetype?: string
  tmpDir?: string
}

export async function prepareAudio(data: Buffer, options: PrepareAudioOptions = {}): Promise<PreparedAudio> {
  let mimetype = options.mimetype ?? detectMime(data)
  if (!mimetype?.startsWith('audio/')) throw new MediaError('Data is not a recognised audio file')
  const { processor, ptt } = options
  let payload = data

  // voice note harus OGG/Opus
  if (ptt && !(mimetype === 'audio/ogg' && getOggOpusDuration(data) !== undefined)) {
    if (!processor?.convertToOpus) {
      throw new MediaError('Voice notes must be OGG/Opus; provide a processor with convertToOpus (ffmpeg)')
    }
    payload = await withLocalFile({ buffer: data }, (p) => processor.convertToOpus!(p), options.tmpDir ? { tmpDir: options.tmpDir } : {})
    mimetype = 'audio/ogg'
  }

  let seconds = mimetype === 'audio/ogg' ? getOggOpusDuration(payload) : undefined
  let waveform: Uint8Array | undefined

  if (processor && (seconds === undefined || ptt)) {
    await withLocalFile(
      { buffer: payload },
      async (path) => {
        if (seconds === undefined) seconds = (await processor.videoInfo?.(path).catch(() => undefined))?.durationSeconds
        if (ptt && processor.decodeAudio) waveform = computeWaveform(await processor.decodeAudio(path))
      },
      options.tmpDir ? { tmpDir: options.tmpDir } : {},
    ).catch(() => undefined)
  }

  return {
    mimetype: ptt ? 'audio/ogg; codecs=opus' : mimetype,
    data: payload,
    ...(seconds !== undefined && { seconds }),
    ...(ptt && { ptt: true }),
    ...(waveform && { waveform }),
  }
}
