import { DisconnectReason } from '../core/errors.js'
import { getChild } from './binary-node.js'
import type { BinaryNode } from './protocol-types.js'

export type StanzaKind =
  | 'iq'
  | 'message'
  | 'receipt'
  | 'notification'
  | 'presence'
  | 'chatstate'
  | 'call'
  | 'ack'
  | 'ib'
  | 'success'
  | 'failure'
  | 'stream:error'
  | 'xmlstreamend'
  | 'unknown'

const KINDS: ReadonlySet<string> = new Set<StanzaKind>([
  'iq',
  'message',
  'receipt',
  'notification',
  'presence',
  'chatstate',
  'call',
  'ack',
  'ib',
  'success',
  'failure',
  'stream:error',
  'xmlstreamend',
])

export function classifyStanza(node: BinaryNode): StanzaKind {
  return KINDS.has(node.tag) ? (node.tag as StanzaKind) : 'unknown'
}

export interface StanzaError {
  code: number
  text: string
}

export function isIqResult(node: BinaryNode): boolean {
  return node.tag === 'iq' && node.attrs.type === 'result'
}

/** Ambil error dari `<iq type="error"><error code= text=/></iq>`. */
export function parseIqError(node: BinaryNode): StanzaError | undefined {
  if (node.tag !== 'iq' || node.attrs.type !== 'error') return undefined
  const error = getChild(node, 'error')
  const code = Number(error?.attrs.code)
  return {
    code: Number.isFinite(code) && code > 0 ? code : 500,
    text: error?.attrs.text ?? 'iq error',
  }
}

export interface DisconnectSignal {
  reason: string
  statusCode: number
}

/** Terjemahkan `<stream:error>` menjadi alasan + kode disconnect. */
export function parseStreamError(node: BinaryNode): DisconnectSignal {
  const child = Array.isArray(node.content) ? node.content[0] : undefined
  const reason = child?.tag ?? 'unknown'
  let statusCode = Number(node.attrs.code)
  if (!Number.isFinite(statusCode) || statusCode <= 0) statusCode = DisconnectReason.restartRequired

  if (reason === 'conflict') {
    statusCode =
      child?.attrs.type === 'device_removed'
        ? DisconnectReason.loggedOut
        : DisconnectReason.connectionReplaced
  }
  return { reason, statusCode }
}

/** Terjemahkan `<failure reason="...">` (kegagalan login). */
export function parseFailure(node: BinaryNode): DisconnectSignal {
  const raw = node.attrs.reason ?? ''
  const code = Number(raw)
  return {
    reason: raw || 'unknown',
    statusCode: Number.isFinite(code) && code > 0 ? code : DisconnectReason.badSession,
  }
}

export interface SuccessInfo {
  lid: string | undefined
  timestamp: number | undefined
  location: string | undefined
  attrs: Record<string, string>
}

export function parseSuccess(node: BinaryNode): SuccessInfo {
  const ts = Number(node.attrs.t)
  return {
    lid: node.attrs.lid,
    timestamp: Number.isFinite(ts) && node.attrs.t !== undefined ? ts : undefined,
    location: node.attrs.location,
    attrs: node.attrs,
  }
}
