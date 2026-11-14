import { GroupError } from '../core/errors.js'
import { getChild, getChildren, getContentString } from '../protocol/binary-node.js'
import type { BinaryNode } from '../protocol/protocol-types.js'
import type { GroupMetadata } from './group-types.js'

export const GROUP_SERVER = 'g.us'

export function normalizeGroupJid(id: string): string {
  return id.includes('@') ? id : `${id}@${GROUP_SERVER}`
}

/** IQ standar untuk namespace grup (`w:g2`). */
export function groupIq(to: string, type: 'get' | 'set', content: BinaryNode[]): BinaryNode {
  return { tag: 'iq', attrs: { type, xmlns: 'w:g2', to }, content }
}

export function buildMetadataQuery(groupJid: string): BinaryNode {
  return groupIq(groupJid, 'get', [{ tag: 'query', attrs: { request: 'interactive' } }])
}

export function buildParticipatingQuery(): BinaryNode {
  return groupIq(`@${GROUP_SERVER}`, 'get', [
    { tag: 'participating', attrs: {}, content: [{ tag: 'participants', attrs: {} }, { tag: 'description', attrs: {} }] },
  ])
}

const num = (v: string | undefined): number | undefined => {
  const n = Number(v)
  return v !== undefined && Number.isFinite(n) ? n : undefined
}

/** Ubah node `<group>` menjadi metadata. */
export function extractGroupMetadata(group: BinaryNode): GroupMetadata {
  if (group.tag !== 'group' || !group.attrs.id) throw new GroupError('Invalid <group> node')

  const description = getChild(group, 'description')
  const participants = getChildren(group, 'participant').map((p) => ({
    id: p.attrs.jid ?? '',
    admin: (p.attrs.type as 'admin' | 'superadmin' | undefined) ?? null,
  }))
  const ephemeral = num(getChild(group, 'ephemeral')?.attrs.expiration)

  return {
    id: normalizeGroupJid(group.attrs.id),
    subject: group.attrs.subject,
    subjectOwner: group.attrs.s_o,
    subjectTime: num(group.attrs.s_t),
    creation: num(group.attrs.creation),
    owner: group.attrs.creator,
    desc: description ? getContentString(getChild(description, 'body')) : undefined,
    descId: description?.attrs.id,
    restrict: !!getChild(group, 'locked'),
    announce: !!getChild(group, 'announcement'),
    ephemeralDuration: ephemeral,
    joinApprovalMode: !!getChild(group, 'membership_approval_mode'),
    memberAddMode: getContentString(getChild(group, 'member_add_mode')),
    size: num(group.attrs.size) ?? participants.length,
    participants,
  }
}

/** Hasil `participating`: `<iq><groups><group/>...`. */
export function parseParticipatingGroups(result: BinaryNode): GroupMetadata[] {
  const groups = getChild(result, 'groups')
  return groups ? getChildren(groups, 'group').map(extractGroupMetadata) : []
}

/** Hasil query metadata/create/invite-info: `<iq><group/></iq>`. */
export function parseGroupResult(result: BinaryNode): GroupMetadata {
  const group = getChild(result, 'group')
  if (!group) throw new GroupError('Response has no <group>')
  return extractGroupMetadata(group)
}
