export type { Contact } from '../store/contact-store.js'

export type USyncProtocol = 'contact' | 'status' | 'devices' | 'lid' | 'picture' | 'disappearing_mode'

export interface USyncUser {
  jid?: string
  /** Nomor telepon internasional (digit saja / dengan +). */
  phone?: string
}

export interface DeviceInfo {
  jid: string
  id: number
  keyIndex?: number | undefined
  isHosted: boolean
}

export interface USyncUserResult {
  jid: string
  /** Nomor yang ditanyakan (bila server mengembalikannya). */
  query?: string | undefined
  exists?: boolean | undefined
  lid?: string | undefined
  status?: { text: string; setAt?: number | undefined } | undefined
  devices?: DeviceInfo[] | undefined
}

export interface OnWhatsAppResult {
  query: string
  jid: string | undefined
  exists: boolean
  lid?: string | undefined
}

export interface StatusResult {
  jid: string
  status: string
  setAt?: number | undefined
}

export type BlockAction = 'block' | 'unblock'
export type ProfilePictureType = 'preview' | 'image'
