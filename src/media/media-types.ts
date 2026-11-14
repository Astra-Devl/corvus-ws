import type { Readable } from 'node:stream'
import type { MediaType } from '../crypto/media-crypto.js'

export type MediaKind = 'image' | 'video' | 'gif' | 'audio' | 'ptt' | 'document' | 'sticker'

export type MediaSource =
  | { url: string }
  | { path: string }
  | { buffer: Uint8Array }
  | { stream: Readable }

export const DEFAULT_MEDIA_HOST = 'mmg.whatsapp.net'

/** Path upload per jenis media. */
export const MEDIA_PATHS: Record<MediaType, string> = {
  image: '/mms/image',
  sticker: '/mms/image',
  product: '/mms/image',
  'thumbnail-link': '/mms/image',
  video: '/mms/video',
  gif: '/mms/video',
  audio: '/mms/audio',
  ptt: '/mms/audio',
  document: '/mms/document',
  history: '/mms/md-msg-hist',
  'md-msg-hist': '/mms/md-msg-hist',
  'md-app-state': '/mms/md-app-state',
}

export type MediaContentKey = 'imageMessage' | 'videoMessage' | 'audioMessage' | 'documentMessage' | 'stickerMessage'

const CONTENT_KEYS: Record<MediaKind, MediaContentKey> = {
  image: 'imageMessage',
  video: 'videoMessage',
  gif: 'videoMessage',
  audio: 'audioMessage',
  ptt: 'audioMessage',
  document: 'documentMessage',
  sticker: 'stickerMessage',
}

export const contentKeyForKind = (kind: MediaKind): MediaContentKey => CONTENT_KEYS[kind]

export interface MediaHost {
  hostname: string
  maxContentLengthBytes: number
}

export interface MediaConn {
  auth: string
  /** Detik. */
  ttl: number
  fetchedAt: number
  hosts: MediaHost[]
}

export interface UploadResult {
  mediaKey: Buffer
  fileSha256: Buffer
  fileEncSha256: Buffer
  fileLength: number
  url: string
  directPath: string
  mediaKeyTimestamp: number
}

// ---- deteksi MIME -----------------------------------------------------------------

const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
  mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska', '3gp': 'video/3gpp',
  mp3: 'audio/mpeg', ogg: 'audio/ogg', opus: 'audio/ogg', m4a: 'audio/mp4', wav: 'audio/wav', aac: 'audio/aac',
  pdf: 'application/pdf', zip: 'application/zip', txt: 'text/plain', csv: 'text/csv', json: 'application/json',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
}

export function mimeFromFileName(fileName: string): string | undefined {
  const ext = fileName.split('.').pop()?.toLowerCase()
  return ext ? EXT_MIME[ext] : undefined
}

/** Deteksi MIME dari magic bytes (subset umum). */
export function detectMime(data: Uint8Array): string | undefined {
  const b = Buffer.from(data.buffer, data.byteOffset, Math.min(data.length, 32))
  const at = (offset: number, text: string): boolean => b.toString('latin1', offset, offset + text.length) === text

  if (b.length >= 8 && b[0] === 0x89 && at(1, 'PNG')) return 'image/png'
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg'
  if (at(0, 'GIF8')) return 'image/gif'
  if (at(0, 'RIFF') && at(8, 'WEBP')) return 'image/webp'
  if (at(0, 'RIFF') && at(8, 'WAVE')) return 'audio/wav'
  if (at(4, 'ftyp')) {
    if (at(8, 'qt')) return 'video/quicktime'
    if (at(8, 'M4A')) return 'audio/mp4'
    if (at(8, '3gp')) return 'video/3gpp'
    return 'video/mp4'
  }
  if (b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3) return 'video/webm'
  if (at(0, 'OggS')) return 'audio/ogg'
  if (at(0, 'ID3') || (b[0] === 0xff && (b[1]! & 0xe0) === 0xe0)) return 'audio/mpeg'
  if (at(0, '%PDF')) return 'application/pdf'
  if (at(0, 'PK')) return 'application/zip'
  return undefined
}
