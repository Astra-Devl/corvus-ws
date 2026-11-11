import {
  DEFAULT_BROWSER,
  DEFAULT_CONNECT_TIMEOUT_MS,
  DEFAULT_KEEP_ALIVE_INTERVAL_MS,
  DEFAULT_MAX_RETRIES,
  DEFAULT_ORIGIN,
  DEFAULT_QUERY_TIMEOUT_MS,
  DEFAULT_RETRY_DELAY_MS,
  DEFAULT_WS_URL,
} from './constants.js'
import type { Logger, ResolvedSocketConfig } from './socket-config.js'

/** Logger yang tidak melakukan apa-apa. */
export const noopLogger: Logger = {
  level: 'silent',
  child: () => noopLogger,
  trace: () => {},
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

export const DEFAULT_SOCKET_CONFIG = {
  url: DEFAULT_WS_URL,
  origin: DEFAULT_ORIGIN,
  headers: {} as Record<string, string>,
  browser: DEFAULT_BROWSER,
  logger: noopLogger,
  connectTimeoutMs: DEFAULT_CONNECT_TIMEOUT_MS,
  keepAliveIntervalMs: DEFAULT_KEEP_ALIVE_INTERVAL_MS,
  defaultQueryTimeoutMs: DEFAULT_QUERY_TIMEOUT_MS,
  retryRequestDelayMs: DEFAULT_RETRY_DELAY_MS,
  maxRetries: DEFAULT_MAX_RETRIES,
  autoReconnect: true,
  markOnlineOnConnect: true,
  syncFullHistory: false,
  emitOwnEvents: true,
} satisfies Omit<ResolvedSocketConfig, 'version' | 'auth'>
