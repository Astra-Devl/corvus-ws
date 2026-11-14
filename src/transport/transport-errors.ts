import { ConnectionError, type CorvusErrorOptions } from '../core/errors.js'

export class TransportError extends ConnectionError {
  constructor(message: string, options: CorvusErrorOptions = {}) {
    super(message, { code: 'ERR_TRANSPORT', ...options })
  }
}

export class TransportClosedError extends TransportError {
  constructor(message = 'Transport is closed', options: CorvusErrorOptions = {}) {
    super(message, { code: 'ERR_TRANSPORT_CLOSED', ...options })
  }
}

export class TransportTimeoutError extends TransportError {
  constructor(message = 'Transport timed out', options: CorvusErrorOptions = {}) {
    super(message, { code: 'ERR_TRANSPORT_TIMEOUT', ...options })
  }
}

/** Frame rusak, terlalu besar, atau gagal didekripsi. */
export class FrameError extends TransportError {
  constructor(message: string, options: CorvusErrorOptions = {}) {
    super(message, { code: 'ERR_FRAME', ...options })
  }
}
