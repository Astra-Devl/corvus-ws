/**
 * Jenis pesan langka WhatsApp: event, poll, pin, album, pembayaran, produk, order, undangan grup,
 * panggilan terjadwal, dan lain-lain. Struktur proto mengikuti WAProto WhatsApp (nomor field sama).
 * Penerimaan di sisi penerima bergantung kebijakan WhatsApp (belum diverifikasi ke server asli).
 */
import { randomBytes } from 'node:crypto'
import { MessageError } from '../core/errors.js'
import type { MessageKey } from './message-key.js'
import type { MessageContent } from './message-utils.js'

const secret = (): Uint8Array => randomBytes(32)
const toSeconds = (v: Date | number): number => (v instanceof Date ? Math.floor(v.getTime() / 1000) : v > 1e12 ? Math.floor(v / 1000) : Math.floor(v))
const toMs = (v: Date | number): number => (v instanceof Date ? v.getTime() : v < 1e12 ? v * 1000 : v)

export interface EventInput {
  name: string
  description?: string
  startDate: Date | number
  endDate?: Date | number
  location?: { degreesLatitude: number; degreesLongitude: number; name?: string; address?: string }
  isCancelled?: boolean
  extraGuestsAllowed?: boolean
  /** Tautan panggilan (mis. dari `createCallLink`). */
  joinLink?: string
  isScheduleCall?: boolean
}
export interface PollInput {
  name: string
  values: string[]
  /** 0 = bebas, 1 = pilih satu. */
  selectableCount?: number
  /** Poll untuk grup pengumuman komunitas (V2). */
  toAnnouncementGroup?: boolean
}
export interface PinInput { key: MessageKey; type?: 'pin' | 'unpin'; /** Detik: 86400 (24 jam), 604800 (7 hari), 2592000 (30 hari). */ duration?: number }
export interface RequestPaymentInput {
  /** Nominal dalam satuan mata uang utama (mis. 50000 = Rp 50.000). */
  amount: number
  currency?: string
  /** JID yang diminta membayar. */
  from: string
  note?: string
  expiresAt?: Date | number
}
export interface ProductInput {
  productId: string
  title: string
  description?: string
  currency?: string
  /** Harga dalam satuan mata uang utama. */
  price: number
  salePrice?: number
  retailerId?: string
  url?: string
  businessOwnerJid: string
  /** `imageMessage` hasil `media.prepare('image', ...)`. */
  image?: Record<string, unknown>
  body?: string
  footer?: string
}
export interface OrderInput {
  orderId: string
  title?: string
  message?: string
  itemCount: number
  sellerJid: string
  token?: string
  total: number
  currency?: string
  thumbnail?: Uint8Array
  status?: 'inquiry' | 'accepted' | 'declined'
}
export interface GroupInviteInput { groupJid: string; inviteCode: string; groupName: string; caption?: string; expiresAt?: Date | number; thumbnail?: Uint8Array }

export type RareMessageInput =
  | { event: EventInput }
  | { poll: PollInput }
  | { pin: PinInput }
  | { album: { images?: number; videos?: number } }
  | { requestPayment: RequestPaymentInput }
  | { sendPayment: { requestKey: MessageKey; note?: string } }
  | { cancelPaymentRequest: MessageKey }
  | { declinePaymentRequest: MessageKey }
  | { paymentInvite: { service?: 'FBPAY' | 'NOVI' | 'UPI'; expiresAt?: Date | number } }
  | { product: ProductInput }
  | { order: OrderInput }
  | { invoice: { note: string; token?: string } }
  | { groupInvite: GroupInviteInput }
  | { scheduledCall: { title: string; at: Date | number; type?: 'voice' | 'video' } }
  | { cancelScheduledCall: MessageKey }
  | { requestPhoneNumber: true }
  | { ptv: Record<string, unknown> }
  | { groupStatus: MessageContent }

export const RARE_KEYS = [
  'event', 'poll', 'pin', 'album', 'requestPayment', 'sendPayment', 'cancelPaymentRequest', 'declinePaymentRequest',
  'paymentInvite', 'product', 'order', 'invoice', 'groupInvite', 'scheduledCall', 'cancelScheduledCall',
  'requestPhoneNumber', 'ptv', 'groupStatus',
] as const

export const isRareInput = (input: object): boolean => RARE_KEYS.some((k) => k in input)

/** Ubah input langka menjadi isi pesan WAProto. */
export function buildRareMessage(input: RareMessageInput): MessageContent {
  const i = input as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

  if (i.event) {
    const e = i.event as EventInput
    if (!e.name) throw new MessageError('event.name wajib diisi')
    return {
      eventMessage: {
        name: e.name,
        ...(e.description !== undefined && { description: e.description }),
        startTime: toSeconds(e.startDate),
        ...(e.endDate !== undefined && { endTime: toSeconds(e.endDate) }),
        isCanceled: e.isCancelled ?? false,
        ...(e.extraGuestsAllowed !== undefined && { extraGuestsAllowed: e.extraGuestsAllowed }),
        ...(e.isScheduleCall !== undefined && { isScheduleCall: e.isScheduleCall }),
        ...(e.joinLink && { joinLink: e.joinLink }),
        ...(e.location && { location: e.location }),
      },
      messageContextInfo: { messageSecret: secret() },
    }
  }
  if (i.poll) {
    const p = i.poll as PollInput
    if (!p.name || !Array.isArray(p.values) || p.values.length < 2) throw new MessageError('poll butuh name dan minimal 2 pilihan')
    const selectable = p.selectableCount ?? 0
    if (selectable < 0 || selectable > p.values.length) throw new MessageError(`poll.selectableCount harus 0..${p.values.length}`)
    const creation = { name: p.name, selectableOptionsCount: selectable, options: p.values.map((optionName) => ({ optionName })) }
    const key = p.toAnnouncementGroup ? 'pollCreationMessageV2' : selectable === 1 ? 'pollCreationMessageV3' : 'pollCreationMessage'
    return { [key]: creation, messageContextInfo: { messageSecret: secret() } }
  }
  if (i.pin) {
    const p = i.pin as PinInput
    const unpin = p.type === 'unpin'
    return {
      pinInChatMessage: { key: p.key, type: unpin ? 2 : 1, senderTimestampMs: Date.now() },
      messageContextInfo: { messageAddOnDurationInSecs: unpin ? 0 : p.duration ?? 86400 },
    }
  }
  if (i.album) return { albumMessage: { expectedImageCount: i.album.images ?? 0, expectedVideoCount: i.album.videos ?? 0 } }
  if (i.requestPayment) {
    const r = i.requestPayment as RequestPaymentInput
    if (!(r.amount > 0) || !r.from) throw new MessageError('requestPayment butuh amount > 0 dan from')
    const amount1000 = Math.round(r.amount * 1000)
    const currency = r.currency ?? 'IDR'
    return {
      requestPaymentMessage: {
        currencyCodeIso4217: currency,
        amount1000,
        requestFrom: r.from,
        ...(r.expiresAt !== undefined && { expiryTimestamp: toSeconds(r.expiresAt) }),
        amount: { value: amount1000, offset: 1000, currencyCode: currency },
        ...(r.note && { noteMessage: { extendedTextMessage: { text: r.note } } }),
      },
    }
  }
  if (i.sendPayment) {
    return { sendPaymentMessage: { requestMessageKey: i.sendPayment.requestKey, ...(i.sendPayment.note && { noteMessage: { conversation: i.sendPayment.note } }) } }
  }
  if (i.cancelPaymentRequest) return { cancelPaymentRequestMessage: { key: i.cancelPaymentRequest } }
  if (i.declinePaymentRequest) return { declinePaymentRequestMessage: { key: i.declinePaymentRequest } }
  if (i.paymentInvite) {
    const service = { FBPAY: 1, NOVI: 2, UPI: 3 }[i.paymentInvite.service as 'FBPAY' | 'NOVI' | 'UPI' ?? 'UPI']
    return { paymentInviteMessage: { serviceType: service, ...(i.paymentInvite.expiresAt !== undefined && { expiryTimestamp: toSeconds(i.paymentInvite.expiresAt) }) } }
  }
  if (i.product) {
    const p = i.product as ProductInput
    return {
      productMessage: {
        product: {
          productId: p.productId,
          title: p.title,
          ...(p.description !== undefined && { description: p.description }),
          currencyCode: p.currency ?? 'IDR',
          priceAmount1000: Math.round(p.price * 1000),
          ...(p.salePrice !== undefined && { salePriceAmount1000: Math.round(p.salePrice * 1000) }),
          ...(p.retailerId && { retailerId: p.retailerId }),
          ...(p.url && { url: p.url }),
          ...(p.image && { productImage: p.image }),
        },
        businessOwnerJid: p.businessOwnerJid,
        ...(p.body !== undefined && { body: p.body }),
        ...(p.footer !== undefined && { footer: p.footer }),
      },
    }
  }
  if (i.order) {
    const o = i.order as OrderInput
    return {
      orderMessage: {
        orderId: o.orderId,
        itemCount: o.itemCount,
        status: { inquiry: 1, accepted: 2, declined: 3 }[o.status ?? 'inquiry'],
        surface: 1,
        ...(o.message !== undefined && { message: o.message }),
        ...(o.title !== undefined && { orderTitle: o.title }),
        sellerJid: o.sellerJid,
        ...(o.token && { token: o.token }),
        totalAmount1000: Math.round(o.total * 1000),
        totalCurrencyCode: o.currency ?? 'IDR',
        ...(o.thumbnail && { thumbnail: o.thumbnail }),
      },
    }
  }
  if (i.invoice) return { invoiceMessage: { note: i.invoice.note, ...(i.invoice.token && { token: i.invoice.token }), attachmentType: 0 } }
  if (i.groupInvite) {
    const g = i.groupInvite as GroupInviteInput
    return {
      groupInviteMessage: {
        groupJid: g.groupJid,
        inviteCode: g.inviteCode,
        groupName: g.groupName,
        inviteExpiration: g.expiresAt !== undefined ? toSeconds(g.expiresAt) : Math.floor(Date.now() / 1000) + 3 * 86400,
        ...(g.caption !== undefined && { caption: g.caption }),
        ...(g.thumbnail && { jpegThumbnail: g.thumbnail }),
      },
    }
  }
  if (i.scheduledCall) {
    const s = i.scheduledCall
    return { scheduledCallCreationMessage: { scheduledTimestampMs: toMs(s.at), callType: s.type === 'video' ? 2 : 1, title: s.title } }
  }
  if (i.cancelScheduledCall) return { scheduledCallEditMessage: { key: i.cancelScheduledCall, editType: 1 } }
  if (i.requestPhoneNumber) return { requestPhoneNumberMessage: {} }
  if (i.ptv) {
    const video = (i.ptv as Record<string, any>).videoMessage // eslint-disable-line @typescript-eslint/no-explicit-any
    if (!video) throw new MessageError('ptv butuh hasil media.prepare("video", ...)')
    return { ptvMessage: video }
  }
  if (i.groupStatus) return { groupStatusMessageV2: { message: i.groupStatus } }
  throw new MessageError('Jenis pesan langka tidak dikenal')
}
