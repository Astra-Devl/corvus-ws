import type { CorvusClient } from '../make-socket.js'
import type { AiAgent } from './agent.js'
import type { WAMessage } from '../messages/message-utils.js'

/** Skema JSON (subset) untuk parameter tool. */
export interface AiJsonSchema {
  type?: 'object' | 'string' | 'number' | 'integer' | 'boolean' | 'array'
  description?: string
  enum?: Array<string | number>
  properties?: Record<string, AiJsonSchema>
  required?: string[]
  items?: AiJsonSchema
  minimum?: number
  maximum?: number
  maxItems?: number
}

export type AiPart =
  | { type: 'text'; text: string }
  | { type: 'image'; mimeType: string; /** base64 */ data: string }

export interface AiToolCall {
  id: string
  name: string
  args: Record<string, unknown>
}

export interface AiMessage {
  role: 'user' | 'assistant' | 'tool'
  /** Teks biasa (pengganti `parts` untuk pesan teks saja). */
  text?: string
  parts?: AiPart[]
  /** Hanya `assistant`: tool yang diminta model. */
  toolCalls?: AiToolCall[]
  /** Hanya `tool`: id panggilan dan hasilnya. */
  toolCallId?: string
  name?: string
  result?: unknown
  /** Data mentah dari provider (mis. bagian Gemini beserta `thoughtSignature`) untuk diputar ulang. */
  raw?: unknown
}

export interface AiToolDeclaration {
  name: string
  description: string
  parameters?: AiJsonSchema
}

export interface AiRequest {
  system: string
  messages: AiMessage[]
  tools: AiToolDeclaration[]
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal
}

export interface AiResponse {
  text: string
  toolCalls: AiToolCall[]
  raw?: unknown
  usage?: { inputTokens?: number; outputTokens?: number }
}

/** Satu penyedia model (Gemini, Groq, atau yang kompatibel OpenAI). */
export interface AiProvider {
  readonly name: string
  chat(request: AiRequest): Promise<AiResponse>
}

export class AiError extends Error {
  readonly provider: string
  readonly status?: number
  readonly retryable: boolean
  constructor(message: string, options: { provider: string; status?: number; retryable?: boolean; cause?: unknown }) {
    super(message, options.cause ? { cause: options.cause } : undefined)
    this.name = 'AiError'
    this.provider = options.provider
    if (options.status !== undefined) this.status = options.status
    this.retryable = options.retryable ?? (options.status === undefined || options.status === 429 || options.status >= 500)
  }
}

// ---- tool & konteks ----

export interface AiToolContext {
  sock: CorvusClient
  /** Chat tempat percakapan berlangsung. */
  jid: string
  /** Pengirim (di grup: anggota yang bertanya). */
  sender: string
  pushName?: string
  isGroup: boolean
  isOwner: boolean
  /** Pesan pemicu (bila ada). */
  message?: WAMessage
  agent: AiAgent
}

export interface AiTool {
  name: string
  description: string
  parameters?: AiJsonSchema
  /** Hanya pemilik bot (`ownerJids`) yang boleh memicu tool ini. */
  ownerOnly?: boolean
  run(args: Record<string, unknown>, ctx: AiToolContext): Promise<unknown> | unknown
}
