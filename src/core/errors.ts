/** Hirarki error untuk corvus-ws. */

export const DisconnectReason = {
  loggedOut: 401,
  forbidden: 403,
  timedOut: 408,
  multideviceMismatch: 411,
  connectionClosed: 428,
  connectionReplaced: 440,
  badSession: 500,
  unavailableService: 503,
  restartRequired: 515,
} as const

export type DisconnectReason = (typeof DisconnectReason)[keyof typeof DisconnectReason]

export interface CorvusErrorOptions {
  code?: string
  statusCode?: number
  cause?: unknown
  data?: Record<string, unknown>
}

export class CorvusError extends Error {
  readonly code: string
  readonly statusCode: number | undefined
  readonly data: Record<string, unknown> | undefined

  constructor(message: string, options: CorvusErrorOptions = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined)
    this.name = new.target.name
    this.code = options.code ?? 'ERR_CORVUS'
    this.statusCode = options.statusCode
    this.data = options.data
  }
}

export class ConfigError extends CorvusError {
  constructor(message: string, options: CorvusErrorOptions = {}) {
    super(message, { code: 'ERR_CONFIG', ...options })
  }
}

export class InvalidStateError extends CorvusError {
  constructor(message: string, options: CorvusErrorOptions = {}) {
    super(message, { code: 'ERR_INVALID_STATE', ...options })
  }
}

export class ConnectionError extends CorvusError {
  constructor(message: string, options: CorvusErrorOptions = {}) {
    super(message, { code: 'ERR_CONNECTION', ...options })
  }
}

export class ConnectionClosedError extends ConnectionError {
  constructor(message = 'Connection closed', options: CorvusErrorOptions = {}) {
    super(message, {
      code: 'ERR_CONNECTION_CLOSED',
      statusCode: DisconnectReason.connectionClosed,
      ...options,
    })
  }
}

export class TimeoutError extends CorvusError {
  readonly timeoutMs: number | undefined

  constructor(message: string, options: CorvusErrorOptions & { timeoutMs?: number } = {}) {
    super(message, { code: 'ERR_TIMEOUT', statusCode: DisconnectReason.timedOut, ...options })
    this.timeoutMs = options.timeoutMs
  }
}

export class ModuleError extends CorvusError {
  constructor(message: string, options: CorvusErrorOptions = {}) {
    super(message, { code: 'ERR_MODULE', ...options })
  }
}

export function isCorvusError(value: unknown): value is CorvusError {
  return value instanceof CorvusError
}

/** Normalisasi nilai apa pun yang di-throw menjadi Error. */
export function toError(value: unknown): Error {
  if (value instanceof Error) return value
  return new CorvusError(typeof value === 'string' ? value : 'Unknown error', { cause: value })
}

/** Ambil kode disconnect (jika ada) dari sebuah error. */
export function getDisconnectCode(error: unknown): number | undefined {
  return isCorvusError(error) ? error.statusCode : undefined
}

/** Apakah koneksi layak dicoba tersambung ulang berdasarkan alasan disconnect. */
export function isReconnectable(code: number | undefined): boolean {
  return (
    code !== DisconnectReason.loggedOut &&
    code !== DisconnectReason.forbidden &&
    code !== DisconnectReason.badSession &&
    code !== DisconnectReason.connectionReplaced
  )
}

export class AuthError extends CorvusError {
  constructor(message: string, options: CorvusErrorOptions = {}) {
    super(message, { code: 'ERR_AUTH', ...options })
  }
}

export class PairingError extends CorvusError {
  constructor(message: string, options: CorvusErrorOptions = {}) {
    super(message, { code: 'ERR_PAIRING', ...options })
  }
}

export class ProtocolError extends CorvusError {
  constructor(message: string, options: CorvusErrorOptions = {}) {
    super(message, { code: 'ERR_PROTOCOL', ...options })
  }
}

export class CryptoError extends CorvusError {
  constructor(message: string, options: CorvusErrorOptions = {}) {
    super(message, { code: 'ERR_CRYPTO', ...options })
  }
}

export class MessageError extends CorvusError {
  constructor(message: string, options: CorvusErrorOptions = {}) {
    super(message, { code: 'ERR_MESSAGE', ...options })
  }
}

export class StoreError extends CorvusError {
  constructor(message: string, options: CorvusErrorOptions = {}) {
    super(message, { code: 'ERR_STORE', ...options })
  }
}

export class MediaError extends CorvusError {
  constructor(message: string, options: CorvusErrorOptions = {}) {
    super(message, { code: 'ERR_MEDIA', ...options })
  }
}

export class GroupError extends CorvusError {
  constructor(message: string, options: CorvusErrorOptions = {}) {
    super(message, { code: 'ERR_GROUP', ...options })
  }
}

export class ChatError extends CorvusError {
  constructor(message: string, options: CorvusErrorOptions = {}) {
    super(message, { code: 'ERR_CHAT', ...options })
  }
}

export class ContactError extends CorvusError {
  constructor(message: string, options: CorvusErrorOptions = {}) {
    super(message, { code: 'ERR_CONTACT', ...options })
  }
}

export class ChannelError extends CorvusError {
  constructor(message: string, options: CorvusErrorOptions = {}) {
    super(message, { code: 'ERR_CHANNEL', ...options })
  }
}

export class CallError extends CorvusError {
  constructor(message: string, options: CorvusErrorOptions = {}) {
    super(message, { code: 'ERR_CALL', ...options })
  }
}

export class PrivacyError extends CorvusError {
  constructor(message: string, options: CorvusErrorOptions = {}) {
    super(message, { code: 'ERR_PRIVACY', ...options })
  }
}

export class BusinessError extends CorvusError {
  constructor(message: string, options: CorvusErrorOptions = {}) {
    super(message, { code: 'ERR_BUSINESS', ...options })
  }
}

export class HistoryError extends CorvusError {
  constructor(message: string, options: CorvusErrorOptions = {}) {
    super(message, { code: 'ERR_HISTORY', ...options })
  }
}

export class ValidationError extends CorvusError {
  constructor(message: string, options: CorvusErrorOptions = {}) {
    super(message, { code: 'ERR_VALIDATION', ...options })
  }
}

export class CompatibilityError extends CorvusError {
  constructor(message: string, options: CorvusErrorOptions = {}) {
    super(message, { code: 'ERR_COMPATIBILITY', ...options })
  }
}
