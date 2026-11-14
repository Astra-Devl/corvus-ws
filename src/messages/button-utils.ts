import { MessageError } from '../core/errors.js'
import type {
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
    default:
      throw new MessageError(`Unknown button type: ${String((button as { type?: unknown }).type)}`)
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
