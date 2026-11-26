import { readFileSync, writeFileSync } from 'node:fs'
import type { AiMessage } from './types.js'

export interface MemoryOptions {
  /** Jumlah pesan terakhir yang diingat per chat (default 20). */
  maxMessages?: number
  /** Lupa percakapan yang tidak aktif (ms, default 6 jam). */
  ttlMs?: number
  /** Simpan ke berkas JSON ini (opsional). Hanya teks percakapan yang disimpan. */
  file?: string
  now?: () => number
}

interface Entry { updatedAt: number; messages: Array<{ role: 'user' | 'assistant'; text: string }>; persona?: string; disabled?: boolean }

/** Memori percakapan per chat (teks saja) + pengaturan per chat (persona, nonaktif). */
export class AiMemory {
  readonly #max: number
  readonly #ttl: number
  readonly #file?: string
  readonly #now: () => number
  #data: Record<string, Entry> = {}
  #dirty = false
  #timer?: NodeJS.Timeout

  constructor(options: MemoryOptions = {}) {
    this.#max = options.maxMessages ?? 20
    this.#ttl = options.ttlMs ?? 6 * 3_600_000
    this.#file = options.file
    this.#now = options.now ?? Date.now
    if (this.#file) {
      try {
        this.#data = JSON.parse(readFileSync(this.#file, 'utf8'))
      } catch {
        this.#data = {}
      }
    }
  }

  #entry(chat: string): Entry {
    const e = this.#data[chat]
    if (e && this.#now() - e.updatedAt > this.#ttl && !e.persona && !e.disabled) {
      delete this.#data[chat]
    } else if (e && this.#now() - e.updatedAt > this.#ttl) {
      e.messages = [] // percakapan kedaluwarsa, pengaturan chat tetap
    }
    return (this.#data[chat] ??= { updatedAt: this.#now(), messages: [] })
  }

  history(chat: string): AiMessage[] {
    return this.#entry(chat).messages.map((m) => ({ role: m.role, text: m.text }))
  }

  push(chat: string, role: 'user' | 'assistant', text: string): void {
    const e = this.#entry(chat)
    e.messages.push({ role, text: text.slice(0, 4000) })
    if (e.messages.length > this.#max) e.messages.splice(0, e.messages.length - this.#max)
    e.updatedAt = this.#now()
    this.#schedule()
  }

  clear(chat: string): void {
    const e = this.#data[chat]
    if (e) e.messages = []
    this.#schedule()
  }

  persona(chat: string): string | undefined { return this.#data[chat]?.persona }
  setPersona(chat: string, persona: string | undefined): void {
    const e = this.#entry(chat)
    if (persona) e.persona = persona.slice(0, 2000)
    else delete e.persona
    this.#schedule()
  }

  isDisabled(chat: string): boolean | undefined { return this.#data[chat]?.disabled }
  setDisabled(chat: string, disabled: boolean | undefined): void {
    const e = this.#entry(chat)
    if (disabled === undefined) delete e.disabled
    else e.disabled = disabled
    this.#schedule()
  }

  #schedule(): void {
    if (!this.#file) return
    this.#dirty = true
    this.#timer ??= setTimeout(() => {
      this.#timer = undefined
      this.flush()
    }, 1500)
    this.#timer.unref?.()
  }

  /** Tulis ke berkas sekarang. */
  flush(): void {
    if (!this.#file || !this.#dirty) return
    this.#dirty = false
    try {
      writeFileSync(this.#file, JSON.stringify(this.#data), { mode: 0o600 })
    } catch {
      /* penyimpanan opsional */
    }
  }
}
