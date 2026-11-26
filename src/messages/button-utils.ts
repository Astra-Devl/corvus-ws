import { MessageError } from '../core/errors.js'
import type {
  PaymentParams,
  ButtonLimits,
  ButtonResponse,
  InteractiveButton,
  ListSection,
  NativeFlowButton,
  ReplyButton,
} from './button-types.js'
import { normalizeMessageContent, type MessageContent } from './message-utils.js'

/** Batas sisi-klien (sanity check); sesuaikan lewat parameter `limits` bila perlu. */
export const BUTTON_LIMITS: ButtonLimits = {
  replyButtons: 3,
  templateButtons: 4,
  listRows: 10,
  nativeFlowButtons: 10,
  carouselCards: 10,
}

export function assertText(name: string, value: unknown, max = 4096): asserts value is string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new MessageError(`"${name}" must be a non-empty string`, { data: { name } })
  }
  if (value.length > max) throw new MessageError(`"${name}" is too long (max ${max})`, { data: { name } })
}

export function assertUrl(name: string, value: string): void {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new MessageError(`"${name}" is not a valid URL`, { data: { name, value } })
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new MessageError(`"${name}" must be http(s)`, { data: { name, value } })
  }
}

export function assertPhone(name: string, value: string): void {
  if (!/^\+?[0-9][0-9\s-]{5,19}$/.test(value)) {
    throw new MessageError(`"${name}" is not a valid phone number`, { data: { name, value } })
  }
}

export function assertUniqueIds(ids: readonly string[], what: string): void {
  if (new Set(ids).size !== ids.length) throw new MessageError(`Duplicate ${what} ids`)
}

export function assertCount(name: string, count: number, max: number, min = 1): void {
  if (count < min || count > max) {
    throw new MessageError(`"${name}" must have between ${min} and ${max} items (got ${count})`)
  }
}

export function validateReplyButtons(buttons: readonly ReplyButton[], max = BUTTON_LIMITS.replyButtons): void {
  assertCount('buttons', buttons.length, max)
  for (const b of buttons) {
    assertText('button.id', b.id, 256)
    assertText('button.text', b.text, 25 * 4)
  }
  assertUniqueIds(buttons.map((b) => b.id), 'button')
}

export function validateSections(sections: readonly ListSection[], maxRows = BUTTON_LIMITS.listRows): void {
  assertCount('sections', sections.length, maxRows)
  const ids: string[] = []
  let rows = 0
  for (const s of sections) {
    assertText('section.title', s.title, 24 * 4)
    assertCount('section.rows', s.rows.length, maxRows)
    for (const r of s.rows) {
      assertText('row.id', r.id, 200)
      assertText('row.title', r.title, 24 * 4)
      ids.push(r.id)
      rows++
    }
  }
  if (rows > maxRows) throw new MessageError(`Too many list rows (max ${maxRows})`)
  assertUniqueIds(ids, 'row')
}

/** Ubah tombol interaktif menjadi entri native flow (`name` + `buttonParamsJson`). */
export function toNativeFlowButton(button: InteractiveButton): NativeFlowButton {
  const json = (name: string, params: Record<string, unknown>): NativeFlowButton => ({
    name,
    buttonParamsJson: JSON.stringify(params),
  })

  switch (button.type) {
    case 'reply':
      assertText('button.text', button.text, 100)
      assertText('button.id', button.id, 256)
      return json('quick_reply', { display_text: button.text, id: button.id })
    case 'url':
      assertText('button.text', button.text, 100)
      assertUrl('button.url', button.url)
      return json('cta_url', { display_text: button.text, url: button.url, merchant_url: button.merchantUrl ?? button.url })
    case 'call':
      assertText('button.text', button.text, 100)
      assertPhone('button.phoneNumber', button.phoneNumber)
      return json('cta_call', { display_text: button.text, phone_number: button.phoneNumber })
    case 'copy':
      assertText('button.text', button.text, 100)
      assertText('button.code', button.code, 1000)
      return json('cta_copy', { display_text: button.text, copy_code: button.code })
    case 'select':
      assertText('select.title', button.title, 100)
      validateSections(button.sections)
      return json('single_select', {
        title: button.title,
        sections: button.sections.map((s) => ({
          title: s.title,
          highlight_label: '',
          rows: s.rows.map((r) => ({ header: r.header ?? '', title: r.title, description: r.description ?? '', id: r.id })),
        })),
      })
    case 'location':
      return json('send_location', { display_text: button.text ?? 'Kirim Lokasi' })
    case 'reminder':
      return json('cta_reminder', { display_text: button.text, ...(button.id && { id: button.id }) })
    case 'cancel_reminder':
      return json('cta_cancel_reminder', { display_text: button.text, ...(button.id && { id: button.id }) })
    case 'address':
      return json('address_message', { display_text: button.text ?? 'Isi Alamat', ...button.params })
    case 'catalog':
      return json('cta_catalog', { display_text: button.text ?? 'Lihat Katalog', ...(button.businessPhoneNumber && { business_phone_number: button.businessPhoneNumber }) })
    case 'webview':
      assertText('button.text', button.text, 100)
      assertUrl('button.url', button.url)
      return json('open_webview', { title: button.text, link: { in_app_webview: true, url: button.url } })
    case 'payment':
      return json(button.name ?? 'review_and_pay', buildPaymentParams(button.payment))
    case 'raw':
      return { name: button.name, buttonParamsJson: typeof button.params === 'string' ? button.params : JSON.stringify(button.params ?? {}) }
    default:
      throw new MessageError(`Unknown button type: ${String((button as { type?: unknown }).type)}`)
  }
}

/** `PaymentParams` → parameter JSON `review_and_pay` (nilai dalam satuan minor, offset 100). */
export function buildPaymentParams(input: PaymentParams | Record<string, unknown>): Record<string, unknown> {
  if (!('referenceId' in input)) return input as Record<string, unknown> // sudah berbentuk parameter mentah
  const p = input as PaymentParams
  if (!(p.total > 0)) throw new MessageError('payment.total harus > 0')
  const minor = (n: number): { value: number; offset: number } => ({ value: Math.round(n * 100), offset: 100 })
  const items = p.items ?? []
  return {
    currency: p.currency ?? 'IDR',
    total_amount: minor(p.total),
    reference_id: p.referenceId,
    type: p.type ?? 'physical-goods',
    payment_settings: p.paymentSettings ?? [],
    share_payment_status: p.sharePaymentStatus ?? false,
    order: {
      status: p.status ?? 'pending',
      ...(p.description !== undefined && { description: p.description }),
      subtotal: minor(items.length ? items.reduce((sum, it) => sum + it.price * (it.quantity ?? 1), 0) : p.total),
      order_type: 'ORDER',
      items: items.map((it) => ({
        name: it.name,
        amount: minor(it.price),
        quantity: it.quantity ?? 1,
        ...(it.retailerId && { retailer_id: it.retailerId }),
        ...(it.productId && { product_id: it.productId }),
      })),
    },
  }
}

/** Baca balasan pengguna atas pesan tombol/list/template/interaktif. */
export function parseButtonResponse(content: MessageContent | null | undefined): ButtonResponse | undefined {
  const c = normalizeMessageContent(content)
  if (!c) return undefined

  if (c.buttonsResponseMessage) {
    return { kind: 'button', id: c.buttonsResponseMessage.selectedButtonId, text: c.buttonsResponseMessage.selectedDisplayText }
  }
  if (c.listResponseMessage) {
    return { kind: 'list', id: c.listResponseMessage.singleSelectReply?.selectedRowId, text: c.listResponseMessage.title }
  }
  if (c.templateButtonReplyMessage) {
    const r = c.templateButtonReplyMessage
    return { kind: 'template', id: r.selectedId, text: r.selectedDisplayText, index: r.selectedIndex }
  }
  const flow = c.interactiveResponseMessage?.nativeFlowResponseMessage
  if (flow) {
    let params: Record<string, unknown> = {}
    try {
      params = JSON.parse(flow.paramsJson || '{}') as Record<string, unknown>
    } catch {
      /* biarkan kosong bila bukan JSON valid */
    }
    return { kind: 'native_flow', name: flow.name, params }
  }
  return undefined
}
