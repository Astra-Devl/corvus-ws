export type ChannelRole = 'OWNER' | 'ADMIN' | 'SUBSCRIBER' | 'GUEST' | (string & {})
export type ReactionCodes = 'ALL' | 'BASIC' | 'NONE'

export interface ChannelMetadata {
  id: string
  name: string | undefined
  description: string | undefined
  /** Kode undangan (bagian dari URL whatsapp.com/channel/<kode>). */
  invite: string | undefined
  subscribers: number | undefined
  verified: boolean
  /** Epoch detik. */
  createdAt: number | undefined
  pictureDirectPath: string | undefined
  state: string | undefined
  role: ChannelRole | undefined
  muted: boolean | undefined
}

export type ChannelOperation =
  | 'create'
  | 'metadata'
  | 'follow'
  | 'unfollow'
  | 'mute'
  | 'unmute'
  | 'delete'
  | 'update'

/**
 * Doc-ID query `w:mex` per operasi. Nilainya berubah mengikuti versi klien
 * WhatsApp Web, jadi HARUS diisi oleh pemakai library.
 */
export type ChannelQueryIds = Partial<Record<ChannelOperation, string>>

export interface ChannelMessage {
  /** ID pesan di server channel. */
  serverId: string
  /** ID pesan sisi-klien (bila ada). */
  id: string | undefined
  channelJid: string
  timestamp: number | undefined
  message: Record<string, unknown> | undefined
  views: number | undefined
  reactions: Array<{ code: string; count: number }>
}
