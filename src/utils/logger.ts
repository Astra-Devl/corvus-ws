import type { Logger } from '../core/socket-config.js'

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'silent'

const LEVELS: Record<LogLevel, number> = { trace: 10, debug: 20, info: 30, warn: 40, error: 50, silent: 100 }
const DEFAULT_REDACT = ['private', 'privateKey', 'mediaKey', 'advSecretKey', 'auth', 'password', 'token', 'authorization']

export interface CreateLoggerOptions {
  level?: LogLevel
  name?: string
  bindings?: Record<string, unknown>
  /** Tujuan keluaran satu baris JSON (default stderr). */
  write?: (line: string) => void
  /** Nama field yang nilainya disamarkan (ditambah ke daftar bawaan). */
  redact?: readonly string[]
  /** Fungsi waktu ISO (default `new Date().toISOString()`). */
  time?: () => string
}

function serializeError(error: Error): Record<string, unknown> {
  const { name, message, stack } = error
  const extra = error as Error & { code?: unknown; statusCode?: unknown; cause?: unknown }
  return {
    name,
    message,
    ...(extra.code !== undefined && { code: extra.code }),
    ...(extra.statusCode !== undefined && { statusCode: extra.statusCode }),
    stack,
    ...(extra.cause instanceof Error && { cause: serializeError(extra.cause) }),
  }
}

function sanitize(value: unknown, redact: ReadonlySet<string>, depth = 0): unknown {
  if (value instanceof Error) return serializeError(value)
  if (value instanceof Uint8Array) return `[${value.constructor.name} ${value.length} bytes]`
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'bigint') return value.toString()
  if (value === null || typeof value !== 'object') return value
  if (depth >= 5) return '[Object]'
  if (Array.isArray(value)) return value.slice(0, 50).map((v) => sanitize(v, redact, depth + 1))

  const out: Record<string, unknown> = {}
  for (const [key, v] of Object.entries(value)) out[key] = redact.has(key) ? '[redacted]' : sanitize(v, redact, depth + 1)
  return out
}

/** Logger JSON-lines yang kompatibel dengan antarmuka `Logger` (gaya pino). */
export function createLogger(options: CreateLoggerOptions = {}): Logger {
  const level = options.level ?? 'info'
  const redact = new Set([...DEFAULT_REDACT, ...(options.redact ?? [])])
  const write = options.write ?? ((line: string) => void process.stderr.write(`${line}\n`))
  const time = options.time ?? ((): string => new Date().toISOString())
  const base = { ...(options.name && { name: options.name }), ...options.bindings }

  const emit = (name: Exclude<LogLevel, 'silent'>, obj: unknown, msg?: string): void => {
    if (LEVELS[name] < LEVELS[level]) return
    let fields: Record<string, unknown> = {}
    let message = msg
    if (typeof obj === 'string') message = message ?? obj
    else if (obj instanceof Error) fields = { err: serializeError(obj) }
    else if (obj !== null && typeof obj === 'object') fields = sanitize(obj, redact) as Record<string, unknown>
    else if (obj !== undefined) fields = { value: obj }

    write(JSON.stringify({ level: name, time: time(), ...base, ...fields, ...(message !== undefined && { msg: message }) }))
  }

  return {
    level,
    trace: (obj, msg) => emit('trace', obj, msg),
    debug: (obj, msg) => emit('debug', obj, msg),
    info: (obj, msg) => emit('info', obj, msg),
    warn: (obj, msg) => emit('warn', obj, msg),
    error: (obj, msg) => emit('error', obj, msg),
    child: (bindings) =>
      createLogger({ ...options, level, bindings: { ...options.bindings, ...bindings } }),
  }
}
