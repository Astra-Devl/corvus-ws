import { ChannelError } from '../core/errors.js'

/** Ambil kode undangan saluran dari URL `https://whatsapp.com/channel/<kode>` (atau kode polos). */
export function parseChannelCode(input: string): string {
  const text = input.trim()
  const match = /whatsapp\.com\/channel\/([A-Za-z0-9_-]+)/i.exec(text)
  if (match?.[1]) return match[1]
  if (/^[A-Za-z0-9_-]{8,}$/.test(text)) return text
  throw new ChannelError('URL atau kode saluran tidak valid', { data: { input } })
}

/** URL publik saluran dari kode undangan. */
export const channelUrl = (code: string): string => `https://whatsapp.com/channel/${code}`
