import { ConnectionError, DisconnectReason, getDisconnectCode, isReconnectable } from '../core/errors.js'
import type { BinaryNode } from '../protocol/protocol-types.js'
import { parseFailure, parseStreamError } from '../protocol/stanza-parser.js'

const REASON_NAMES = new Map<number, string>(
  Object.entries(DisconnectReason).map(([name, code]) => [code, name]),
)

export interface DisconnectDescription {
  code: number | undefined
  /** Nama alasan (mis. `loggedOut`) atau `unknown`. */
  reason: string
  reconnectable: boolean
  loggedOut: boolean
}

export function describeDisconnect(error: Error | undefined): DisconnectDescription {
  const code = getDisconnectCode(error)
  return {
    code,
    reason: code === undefined ? 'unknown' : (REASON_NAMES.get(code) ?? 'unknown'),
    reconnectable: isReconnectable(code),
    loggedOut: code === DisconnectReason.loggedOut,
  }
}

export function isLoggedOut(error: Error | undefined): boolean {
  return getDisconnectCode(error) === DisconnectReason.loggedOut
}

export function createDisconnectError(
  reason: DisconnectReason,
  message: string,
  data?: Record<string, unknown>,
): ConnectionError {
  return new ConnectionError(message, { statusCode: reason, ...(data && { data }) })
}

export function disconnectErrorFromStream(node: BinaryNode): ConnectionError {
  const { reason, statusCode } = parseStreamError(node)
  return new ConnectionError(`Stream errored (${reason})`, { statusCode, data: { node } })
}

export function disconnectErrorFromFailure(node: BinaryNode): ConnectionError {
  const { reason, statusCode } = parseFailure(node)
  return new ConnectionError(`Connection failure (${reason})`, { statusCode, data: { node } })
}
