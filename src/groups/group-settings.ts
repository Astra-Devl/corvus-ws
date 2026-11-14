import { GroupError } from '../core/errors.js'
import type { BinaryNode } from '../protocol/protocol-types.js'
import { generateMessageId } from '../messages/message-key.js'
import { groupIq } from './group-metadata.js'
import type { EphemeralDuration, GroupSetting, MemberAddMode } from './group-types.js'

const MAX_SUBJECT = 100
const MAX_DESCRIPTION = 2048
const EPHEMERAL: readonly number[] = [0, 86_400, 604_800, 7_776_000]
const SETTINGS: readonly GroupSetting[] = ['announcement', 'not_announcement', 'locked', 'unlocked']

export function buildSubjectUpdate(groupJid: string, subject: string): BinaryNode {
  const text = subject.trim()
  if (!text) throw new GroupError('Subject must not be empty')
  if ([...text].length > MAX_SUBJECT) throw new GroupError(`Subject is too long (max ${MAX_SUBJECT})`)
  return groupIq(groupJid, 'set', [{ tag: 'subject', attrs: {}, content: Buffer.from(text, 'utf8') }])
}

/** `description` kosong/undefined menghapus deskripsi. `prevId` = descId saat ini. */
export function buildDescriptionUpdate(groupJid: string, description: string | undefined, prevId?: string): BinaryNode {
  const text = description?.trim()
  if (text && [...text].length > MAX_DESCRIPTION) throw new GroupError(`Description is too long (max ${MAX_DESCRIPTION})`)

  const attrs: Record<string, string> = text ? { id: generateMessageId() } : { delete: 'true' }
  if (prevId) attrs.prev = prevId
  return groupIq(groupJid, 'set', [
    { tag: 'description', attrs, ...(text && { content: [{ tag: 'body', attrs: {}, content: Buffer.from(text, 'utf8') }] }) },
  ])
}

export function buildSettingUpdate(groupJid: string, setting: GroupSetting): BinaryNode {
  if (!SETTINGS.includes(setting)) throw new GroupError(`Unknown group setting: ${String(setting)}`)
  return groupIq(groupJid, 'set', [{ tag: setting, attrs: {} }])
}

export function buildEphemeralUpdate(groupJid: string, expiration: EphemeralDuration | number): BinaryNode {
  if (!EPHEMERAL.includes(expiration)) {
    throw new GroupError(`Ephemeral duration must be one of ${EPHEMERAL.join(', ')} seconds`)
  }
  return groupIq(groupJid, 'set', [
    expiration === 0 ? { tag: 'not_ephemeral', attrs: {} } : { tag: 'ephemeral', attrs: { expiration: String(expiration) } },
  ])
}

export function buildMemberAddModeUpdate(groupJid: string, mode: MemberAddMode): BinaryNode {
  if (mode !== 'admin_add' && mode !== 'all_member_add') throw new GroupError(`Unknown member add mode: ${String(mode)}`)
  return groupIq(groupJid, 'set', [{ tag: 'member_add_mode', attrs: {}, content: Buffer.from(mode) }])
}

export function buildJoinApprovalUpdate(groupJid: string, enabled: boolean): BinaryNode {
  return groupIq(groupJid, 'set', [
    { tag: 'membership_approval_mode', attrs: {}, content: [{ tag: 'group_join', attrs: { state: enabled ? 'on' : 'off' } }] },
  ])
}

export function buildLeave(groupJid: string): BinaryNode {
  return groupIq('@g.us', 'set', [{ tag: 'leave', attrs: {}, content: [{ tag: 'group', attrs: { id: groupJid } }] }])
}

export function buildCreate(subject: string, participants: readonly string[], key = generateMessageId()): BinaryNode {
  const text = subject.trim()
  if (!text) throw new GroupError('Subject must not be empty')
  if ([...text].length > MAX_SUBJECT) throw new GroupError(`Subject is too long (max ${MAX_SUBJECT})`)
  return groupIq('@g.us', 'set', [
    { tag: 'create', attrs: { subject: text, key }, content: participants.map((jid) => ({ tag: 'participant', attrs: { jid } })) },
  ])
}
