import type { MessageContent } from './message-utils.js'

export interface ReplyButton {
  id: string
  text: string
}

export interface ListRow {
  id: string
  title: string
  description?: string
  header?: string
}

export interface ListSection {
  title: string
  rows: ListRow[]
}

/** Tombol untuk pesan interaktif (native flow). */
export type InteractiveButton =
  | { type: 'reply'; text: string; id: string }
  | { type: 'url'; text: string; url: string; merchantUrl?: string }
  | { type: 'call'; text: string; phoneNumber: string }
  | { type: 'copy'; text: string; code: string }
  | { type: 'select'; title: string; sections: ListSection[] }
  /** Tombol "Kirim lokasi" (`send_location`). */
  | { type: 'location'; text?: string }
  /** Pengingat (`cta_reminder` / `cta_cancel_reminder`). */
  | { type: 'reminder'; text: string; id?: string }
  | { type: 'cancel_reminder'; text: string; id?: string }
  /** Form alamat (`address_message`). */
  | { type: 'address'; text?: string; params?: Record<string, unknown> }
  /** Katalog bisnis (`cta_catalog`). */
  | { type: 'catalog'; text?: string; businessPhoneNumber?: string }
  /** Buka halaman web di dalam WhatsApp (`open_webview`). */
  | { type: 'webview'; text: string; url: string }
  /** Tombol pembayaran (`review_and_pay`, `payment_info`, dll.). */
  | { type: 'payment'; name?: 'review_and_pay' | 'payment_info' | 'order_details' | 'payment_method'; payment: PaymentParams | Record<string, unknown> }
  /** Tombol mentah: nama + parameter JSON apa adanya. */
  | { type: 'raw'; name: string; params?: Record<string, unknown> | string }

export interface PaymentItem {
  name: string
  /** Harga per item, satuan mata uang utama. */
  price: number
  quantity?: number
  retailerId?: string
  productId?: string
}

export interface PaymentParams {
  referenceId: string
  currency?: string
  /** Total, satuan mata uang utama (mis. 50000 = Rp 50.000). */
  total: number
  type?: 'physical-goods' | 'digital-goods'
  items?: PaymentItem[]
  status?: 'pending' | 'payment_requested' | 'processing' | 'completed' | 'canceled'
  description?: string
  /** `payment_settings` WhatsApp, mis. `{ type: 'payment_link', payment_link: { uri } }`. */
  paymentSettings?: Array<Record<string, unknown>>
  sharePaymentStatus?: boolean
}

/** Tombol untuk pesan template (hydrated). */
export type TemplateButton =
  | { type: 'reply'; text: string; id: string }
  | { type: 'url'; text: string; url: string }
  | { type: 'call'; text: string; phoneNumber: string }

export interface NativeFlowButton {
  name: string
  buttonParamsJson: string
}

export interface HeaderInput {
  title?: string
  subtitle?: string
  /** Media yang sudah disiapkan, mis. `{ imageMessage: {...} }`. */
  media?: MessageContent
}

export interface ButtonsInput {
  text: string
  footer?: string
  /** Teks header (opsional). */
  header?: string
  /** Media header (hasil `media.prepare`: `{ imageMessage }` / `{ videoMessage }` / `{ documentMessage }`). */
  media?: MessageContent
  /** Header lokasi + thumbnail (`headerType` 6), seperti yang dipakai fork Baileys untuk menu klasik. */
  locationMessage?: { degreesLatitude?: number; degreesLongitude?: number; name?: string; address?: string; jpegThumbnail?: Uint8Array }
  buttons: ReplyButton[]
}

export interface ListInput {
  title: string
  text: string
  buttonText: string
  footer?: string
  sections: ListSection[]
}

export interface TemplateInput {
  text: string
  footer?: string
  title?: string
  templateId?: string
  /** Media header (hasil `media.prepare`), atau lokasi. Menggantikan `title`. */
  media?: MessageContent
  locationMessage?: { degreesLatitude?: number; degreesLongitude?: number; name?: string; address?: string; jpegThumbnail?: Uint8Array }
  buttons: TemplateButton[]
}

export interface InteractiveInput {
  header?: HeaderInput
  body: string
  footer?: string
  buttons: InteractiveButton[]
  /** Bungkus dengan `viewOnceMessage` + messageContextInfo (default `false`: dikirim langsung seperti WhatsApp Web). */
  wrap?: boolean
}

export interface CarouselCard {
  header?: HeaderInput
  body: string
  footer?: string
  buttons: InteractiveButton[]
}

export interface CarouselInput {
  header?: HeaderInput
  body?: string
  footer?: string
  cards: CarouselCard[]
  /** `hscroll` (default, kartu geser) atau `album` (album gambar). */
  cardType?: 'hscroll' | 'album'
  /** Bungkus dengan `viewOnceMessage` (default `false`). */
  wrap?: boolean
}

export interface ButtonLimits {
  replyButtons: number
  templateButtons: number
  listRows: number
  nativeFlowButtons: number
  carouselCards: number
}

export type ButtonResponse =
  | { kind: 'button'; id: string; text: string | undefined }
  | { kind: 'list'; id: string; text: string | undefined }
  | { kind: 'template'; id: string; text: string | undefined; index: number | undefined }
  | { kind: 'native_flow'; name: string; params: Record<string, unknown> }
