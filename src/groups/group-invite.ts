import { GroupError } from '../core/errors.js'
import { getChild } from '../protocol/binary-node.js'
import type { BinaryNode } from '../protocol/protocol-types.js'
import { groupIq } from './group-metadata.js'

export const INVITE_BASE_URL = 'https://chat.whatsapp.com/'

/** Ambil kode undangan dari URL `chat.whatsapp.com/<kode>` atau kode polos. */
export function parseInviteCode(input: string): string {
  const trimmed = input.trim()
  const match = /^(?:https?:\/\/)?chat\.whatsapp\.com\/([A-Za-z0-9_-]{6,})\/?(?:\?.*)?$/.exec(trimmed)
  const code = match ? match[1]! : trimmed
  if (!/^[A-Za-z0-9_-]{6,}$/.test(code)) throw new GroupError('Invalid invite code')
  return code
}

export const inviteLink = (code: string): string => `${INVITE_BASE_URL}${code}`

export const buildInviteCodeQuery = (groupJid: string): BinaryNode => groupIq(groupJid, 'get', [{ tag: 'invite', attrs: {} }])
export const buildRevokeInvite = (groupJid: string): BinaryNode => groupIq(groupJid, 'set', [{ tag: 'invite', attrs: {} }])
export const buildInviteInfoQuery = (code: string): BinaryNode => groupIq('@g.us', 'get', [{ tag: 'invite', attrs: { code } }])
export const buildAcceptInvite = (code: string): BinaryNode => groupIq('@g.us', 'set', [{ tag: 'invite', attrs: { code } }])

export function parseInviteCodeResult(result: BinaryNode): string {
  const code = getChild(result, 'invite')?.attrs.code
  if (!code) throw new GroupError('Response has no invite code')
  return code
}

/** Hasil `accept`: `<iq><group jid="..."/></iq>`. */
export function parseAcceptResult(result: BinaryNode): string | undefined {
  return getChild(result, 'group')?.attrs.jid
}
