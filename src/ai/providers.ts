/**
 * Penyedia model: Gemini (Google), Groq, dan endpoint kompatibel OpenAI. API key dan model
 * HARUS diberikan pemilik bot; library tidak menyertakan key maupun model bawaan.
 */
import { AiError, type AiJsonSchema, type AiMessage, type AiProvider, type AiRequest, type AiResponse, type AiToolCall } from './types.js'

type FetchLike = typeof fetch

export interface ProviderOptions {
  apiKey: string
  /** Nama model (wajib), mis. `gemini-3.6-flash` atau `gemini-2.5-flash`. Nama model sering berganti. */
  model: string
  baseUrl?: string
  fetch?: FetchLike
  temperature?: number
  maxTokens?: number
  /** Batas waktu satu panggilan (ms, default 45000). */
  timeoutMs?: number
}

function requireOptions(name: string, o: ProviderOptions): void {
  if (!o.apiKey?.trim()) throw new AiError(`${name}: apiKey wajib diisi (kunci API milik Anda sendiri)`, { provider: name, retryable: false })
  if (!o.model?.trim()) throw new AiError(`${name}: model wajib diisi (mis. "gemini-3.6-flash")`, { provider: name, retryable: false })
}

async function postJson(name: string, url: string, headers: Record<string, string>, body: unknown, o: ProviderOptions, signal?: AbortSignal): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
  const timeout = AbortSignal.timeout(o.timeoutMs ?? 45_000)
  const merged = signal ? AbortSignal.any([timeout, signal]) : timeout
  let res: Response
  try {
    res = await (o.fetch ?? fetch)(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal: merged })
  } catch (cause) {
    throw new AiError(`${name}: koneksi gagal (${cause instanceof Error ? cause.message : String(cause)})`, { provider: name, cause })
  }
  const text = await res.text()
  let json: any // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    json = text ? JSON.parse(text) : {}
  } catch {
    json = { raw: text.slice(0, 300) }
  }
  if (!res.ok) {
    const detail = json?.error?.message ?? json?.error ?? json?.raw ?? res.statusText
    // jangan pernah menyertakan header/kunci dalam pesan error
    throw new AiError(`${name}: HTTP ${res.status} — ${String(detail).slice(0, 300)}`, { provider: name, status: res.status })
  }
  return json
}

const safeParse = (s: unknown): Record<string, unknown> => {
  if (s && typeof s === 'object') return s as Record<string, unknown>
  try {
    const v = JSON.parse(String(s || '{}'))
    return v && typeof v === 'object' ? v : {}
  } catch {
    return {}
  }
}

// ======================================================== Gemini

const upperTypes = (schema: AiJsonSchema | undefined): unknown => {
  if (!schema) return undefined
  const out: Record<string, unknown> = { ...schema }
  if (schema.type) out.type = schema.type.toUpperCase()
  if (schema.properties) out.properties = Object.fromEntries(Object.entries(schema.properties).map(([k, v]) => [k, upperTypes(v)]))
  if (schema.items) out.items = upperTypes(schema.items)
  return out
}

export function createGeminiProvider(o: ProviderOptions): AiProvider {
  requireOptions('gemini', o)
  const base = (o.baseUrl ?? 'https://generativelanguage.googleapis.com/v1beta').replace(/\/$/, '')

  const toContents = (messages: AiMessage[]): unknown[] => {
    const contents: any[] = [] // eslint-disable-line @typescript-eslint/no-explicit-any
    for (const m of messages) {
      if (m.role === 'user') {
        const parts = (m.parts ?? [{ type: 'text', text: m.text ?? '' }]).map((p) => (p.type === 'text' ? { text: p.text } : { inlineData: { mimeType: p.mimeType, data: p.data } }))
        contents.push({ role: 'user', parts })
      } else if (m.role === 'assistant') {
        const parts = Array.isArray(m.raw) && m.raw.length > 0
          ? m.raw // putar ulang persis (termasuk thoughtSignature) agar pemanggilan fungsi tetap valid
          : [...(m.text ? [{ text: m.text }] : []), ...(m.toolCalls ?? []).map((c) => ({ functionCall: { name: c.name, args: c.args } }))]
        if (parts.length) contents.push({ role: 'model', parts })
      } else {
        const part = { functionResponse: { name: m.name ?? 'tool', response: m.result && typeof m.result === 'object' && !Array.isArray(m.result) ? m.result : { result: m.result ?? null } } }
        const last = contents.at(-1)
        if (last?.role === 'user' && last.parts.every((p: any) => p.functionResponse)) last.parts.push(part) // eslint-disable-line @typescript-eslint/no-explicit-any
        else contents.push({ role: 'user', parts: [part] })
      }
    }
    return contents
  }

  return {
    name: 'gemini',
    async chat(req: AiRequest): Promise<AiResponse> {
      const body = {
        systemInstruction: { parts: [{ text: req.system }] },
        contents: toContents(req.messages),
        ...(req.tools.length > 0 && {
          tools: [{ functionDeclarations: req.tools.map((t) => ({ name: t.name, description: t.description, ...(t.parameters?.properties && Object.keys(t.parameters.properties).length > 0 && { parameters: upperTypes(t.parameters) }) })) }],
        }),
        generationConfig: {
          ...(req.temperature !== undefined || o.temperature !== undefined ? { temperature: req.temperature ?? o.temperature } : {}),
          ...(req.maxTokens !== undefined || o.maxTokens !== undefined ? { maxOutputTokens: req.maxTokens ?? o.maxTokens } : {}),
        },
      }
      const json = await postJson('gemini', `${base}/models/${encodeURIComponent(o.model)}:generateContent`, { 'x-goog-api-key': o.apiKey }, body, o, req.signal)
      if (json.promptFeedback?.blockReason) throw new AiError(`gemini: permintaan diblokir (${json.promptFeedback.blockReason})`, { provider: 'gemini', status: 400, retryable: false })
      const parts: any[] = json.candidates?.[0]?.content?.parts ?? [] // eslint-disable-line @typescript-eslint/no-explicit-any
      const toolCalls: AiToolCall[] = parts.filter((p) => p.functionCall).map((p, i) => ({ id: `call_${i}_${p.functionCall.name}`, name: p.functionCall.name, args: safeParse(p.functionCall.args) }))
      const text = parts.filter((p) => typeof p.text === 'string' && !p.thought).map((p) => p.text).join('').trim()
      return {
        text, toolCalls, raw: parts,
        usage: { inputTokens: json.usageMetadata?.promptTokenCount, outputTokens: json.usageMetadata?.candidatesTokenCount },
      }
    },
  }
}

// ======================================================== OpenAI-compatible (Groq, dll.)

export function createOpenAICompatibleProvider(name: string, o: ProviderOptions & { baseUrl: string }): AiProvider {
  requireOptions(name, o)
  const base = o.baseUrl.replace(/\/$/, '')

  const toMessages = (system: string, messages: AiMessage[]): unknown[] => {
    const out: unknown[] = [{ role: 'system', content: system }]
    for (const m of messages) {
      if (m.role === 'user') {
        const hasImage = m.parts?.some((p) => p.type === 'image')
        out.push({
          role: 'user',
          content: hasImage
            ? m.parts!.map((p) => (p.type === 'text' ? { type: 'text', text: p.text } : { type: 'image_url', image_url: { url: `data:${p.mimeType};base64,${p.data}` } }))
            : m.parts ? m.parts.map((p) => (p.type === 'text' ? p.text : '')).join('\n') : m.text ?? '',
        })
      } else if (m.role === 'assistant') {
        out.push({
          role: 'assistant',
          content: m.text || null,
          ...(m.toolCalls?.length && { tool_calls: m.toolCalls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args) } })) }),
        })
      } else {
        out.push({ role: 'tool', tool_call_id: m.toolCallId, content: typeof m.result === 'string' ? m.result : JSON.stringify(m.result ?? null) })
      }
    }
    return out
  }

  return {
    name,
    async chat(req: AiRequest): Promise<AiResponse> {
      const body = {
        model: o.model,
        messages: toMessages(req.system, req.messages),
        ...(req.tools.length > 0 && {
          tools: req.tools.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters ?? { type: 'object', properties: {} } } })),
          tool_choice: 'auto',
        }),
        ...((req.temperature ?? o.temperature) !== undefined && { temperature: req.temperature ?? o.temperature }),
        ...((req.maxTokens ?? o.maxTokens) !== undefined && { max_tokens: req.maxTokens ?? o.maxTokens }),
      }
      const json = await postJson(name, `${base}/chat/completions`, { Authorization: `Bearer ${o.apiKey}` }, body, o, req.signal)
      const msg = json.choices?.[0]?.message
      if (!msg) throw new AiError(`${name}: respons tanpa pesan`, { provider: name, status: 502 })
      const toolCalls: AiToolCall[] = (msg.tool_calls ?? []).map((c: any, i: number) => ({ id: c.id ?? `call_${i}`, name: c.function?.name, args: safeParse(c.function?.arguments) })) // eslint-disable-line @typescript-eslint/no-explicit-any
      return { text: String(msg.content ?? '').trim(), toolCalls, usage: { inputTokens: json.usage?.prompt_tokens, outputTokens: json.usage?.completion_tokens } }
    },
  }
}

export const createGroqProvider = (o: ProviderOptions): AiProvider =>
  createOpenAICompatibleProvider('groq', { ...o, baseUrl: o.baseUrl ?? 'https://api.groq.com/openai/v1' })

// ======================================================== failover

/** Coba penyedia berurutan; pindah ke berikutnya bila gagal (kecuali kesalahan konfigurasi / permintaan salah). */
export function createFailoverProvider(providers: AiProvider[], onFallback?: (from: string, error: Error) => void): AiProvider {
  if (providers.length === 0) throw new AiError('Minimal satu provider AI harus dikonfigurasi', { provider: 'failover', retryable: false })
  return {
    name: providers.map((p) => p.name).join('>'),
    async chat(req) {
      let last: Error | undefined
      for (const p of providers) {
        try {
          return await p.chat(req)
        } catch (error) {
          last = error instanceof Error ? error : new Error(String(error))
          onFallback?.(p.name, last)
          if (error instanceof AiError && !error.retryable && error.status === 400) break // permintaan salah: provider lain pasti sama
        }
      }
      throw last!
    },
  }
}
