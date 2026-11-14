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
  buttons: TemplateButton[]
}

export interface InteractiveInput {
  header?: HeaderInput
  body: string
  footer?: string
  buttons: InteractiveButton[]
  /** Bungkus dengan `viewOnceMessage` + messageContextInfo (default true). */
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
