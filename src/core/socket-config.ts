import { DEFAULT_SOCKET_CONFIG } from './defaults.js'
import { ConfigError } from './errors.js'

export interface Logger {
  level?: string
  child?(bindings: Record<string, unknown>): Logger
  trace(obj: unknown, msg?: string): void
  debug(obj: unknown, msg?: string): void
  info(obj: unknown, msg?: string): void
  warn(obj: unknown, msg?: string): void
  error(obj: unknown, msg?: string): void
}

/** [platform, browser, version] */
export type BrowserDescription = readonly [platform: string, browser: string, version: string]

export interface SocketConfig {
  /** URL WebSocket server. */
  url?: string | undefined
  /** Header Origin saat handshake. */
  origin?: string | undefined
  /** Header HTTP tambahan saat handshake. */
  headers?: Record<string, string> | undefined
  browser?: BrowserDescription | undefined
  /** Versi protokol client [major, minor, patch]. */
  version?: readonly [number, number, number] | undefined
  logger?: Logger | undefined

  connectTimeoutMs?: number | undefined
  keepAliveIntervalMs?: number | undefined
  defaultQueryTimeoutMs?: number | undefined
  retryRequestDelayMs?: number | undefined
  maxRetries?: number | undefined

  autoReconnect?: boolean | undefined
  markOnlineOnConnect?: boolean | undefined
  syncFullHistory?: boolean | undefined
  emitOwnEvents?: boolean | undefined

  /**
   * State autentikasi. Akan diganti dengan tipe `AuthState`
   * setelah modul `auth/` selesai dibuat.
   */
  auth?: unknown
}

export interface ResolvedSocketConfig {
  readonly url: string
  readonly origin: string
  readonly headers: Readonly<Record<string, string>>
  readonly browser: BrowserDescription
  readonly version: readonly [number, number, number] | undefined
  readonly logger: Logger
  readonly connectTimeoutMs: number
  readonly keepAliveIntervalMs: number
  readonly defaultQueryTimeoutMs: number
  readonly retryRequestDelayMs: number
  readonly maxRetries: number
  readonly autoReconnect: boolean
  readonly markOnlineOnConnect: boolean
  readonly syncFullHistory: boolean
  readonly emitOwnEvents: boolean
  readonly auth: unknown
}

function assertPositive(name: string, value: number, allowZero = false): void {
  const ok = Number.isFinite(value) && (allowZero ? value >= 0 : value > 0)
  if (!ok) {
    throw new ConfigError(`"${name}" must be a ${allowZero ? 'non-negative' : 'positive'} number`, {
      data: { name, value },
    })
  }
}

function assertUrl(name: string, value: string, protocols: readonly string[]): void {
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch (cause) {
    throw new ConfigError(`"${name}" is not a valid URL`, { cause, data: { name, value } })
  }
  if (!protocols.includes(parsed.protocol)) {
    throw new ConfigError(`"${name}" must use one of: ${protocols.join(', ')}`, {
      data: { name, value },
    })
  }
}

/** Gabungkan config user dengan default, lalu validasi. Hasilnya immutable. */
export function resolveSocketConfig(input: SocketConfig = {}): ResolvedSocketConfig {
  const d = DEFAULT_SOCKET_CONFIG

  const config: ResolvedSocketConfig = {
    url: input.url ?? d.url,
    origin: input.origin ?? d.origin,
    headers: { ...d.headers, ...input.headers },
    browser: input.browser ?? d.browser,
    version: input.version,
    logger: input.logger ?? d.logger,
    connectTimeoutMs: input.connectTimeoutMs ?? d.connectTimeoutMs,
    keepAliveIntervalMs: input.keepAliveIntervalMs ?? d.keepAliveIntervalMs,
    defaultQueryTimeoutMs: input.defaultQueryTimeoutMs ?? d.defaultQueryTimeoutMs,
    retryRequestDelayMs: input.retryRequestDelayMs ?? d.retryRequestDelayMs,
    maxRetries: input.maxRetries ?? d.maxRetries,
    autoReconnect: input.autoReconnect ?? d.autoReconnect,
    markOnlineOnConnect: input.markOnlineOnConnect ?? d.markOnlineOnConnect,
    syncFullHistory: input.syncFullHistory ?? d.syncFullHistory,
    emitOwnEvents: input.emitOwnEvents ?? d.emitOwnEvents,
    auth: input.auth,
  }

  assertUrl('url', config.url, ['ws:', 'wss:'])
  assertUrl('origin', config.origin, ['http:', 'https:'])
  assertPositive('connectTimeoutMs', config.connectTimeoutMs)
  assertPositive('keepAliveIntervalMs', config.keepAliveIntervalMs)
  assertPositive('defaultQueryTimeoutMs', config.defaultQueryTimeoutMs)
  assertPositive('retryRequestDelayMs', config.retryRequestDelayMs, true)
  assertPositive('maxRetries', config.maxRetries, true)

  return Object.freeze(config)
}
