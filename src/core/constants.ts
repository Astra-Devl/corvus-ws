/** Konstanta global untuk layer core. */

export const LIBRARY_NAME = 'corvus-ws'

export const DEFAULT_WS_URL = 'wss://web.whatsapp.com/ws/chat'
export const DEFAULT_ORIGIN = 'https://web.whatsapp.com'

/** [platform, browser, version] */
export const DEFAULT_BROWSER = ['Corvus', 'Chrome', '1.0.0'] as const

export const DEFAULT_CONNECT_TIMEOUT_MS = 20_000
export const DEFAULT_KEEP_ALIVE_INTERVAL_MS = 30_000
export const DEFAULT_QUERY_TIMEOUT_MS = 60_000
export const DEFAULT_RETRY_DELAY_MS = 250
export const DEFAULT_MAX_RETRIES = 5

export const CONNECTION_STATUSES = ['idle', 'connecting', 'open', 'closing', 'closed'] as const
