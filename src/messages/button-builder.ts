import type { HeaderInput, InteractiveButton, InteractiveInput, ListSection } from './button-types.js'
import { buildInteractiveMessage } from './interactive-message.js'
import type { MessageContent } from './message-utils.js'

/** Builder fluent untuk pesan interaktif. */
export class ButtonBuilder {
  #header: HeaderInput | undefined
  #body = ''
  #footer: string | undefined
  #wrap = true
  readonly #buttons: InteractiveButton[] = []

  header(header: HeaderInput | string): this {
    this.#header = typeof header === 'string' ? { title: header } : header
    return this
  }
  body(text: string): this {
    this.#body = text
    return this
  }
  footer(text: string): this {
    this.#footer = text
    return this
  }
  wrap(enabled: boolean): this {
    this.#wrap = enabled
    return this
  }
  reply(text: string, id: string): this {
    this.#buttons.push({ type: 'reply', text, id })
    return this
  }
  url(text: string, url: string, merchantUrl?: string): this {
    this.#buttons.push({ type: 'url', text, url, ...(merchantUrl !== undefined && { merchantUrl }) })
    return this
  }
  call(text: string, phoneNumber: string): this {
    this.#buttons.push({ type: 'call', text, phoneNumber })
    return this
  }
  copy(text: string, code: string): this {
    this.#buttons.push({ type: 'copy', text, code })
    return this
  }
  select(title: string, sections: ListSection[]): this {
    this.#buttons.push({ type: 'select', title, sections })
    return this
  }

  build(): InteractiveInput {
    return {
      body: this.#body,
      buttons: [...this.#buttons],
      wrap: this.#wrap,
      ...(this.#header && { header: this.#header }),
      ...(this.#footer !== undefined && { footer: this.#footer }),
    }
  }

  /** Langsung menjadi isi pesan. */
  toMessage(): MessageContent {
    return buildInteractiveMessage(this.build())
  }
}
