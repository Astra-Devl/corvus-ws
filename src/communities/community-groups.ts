import { GroupError } from '../core/errors.js'
import { getChild, getChildren } from '../protocol/binary-node.js'
import type { BinaryNode } from '../protocol/protocol-types.js'
import { extractGroupMetadata, groupIq, GROUP_SERVER } from '../groups/group-metadata.js'
import { generateMessageId } from '../messages/message-key.js'
import { jidEncode, jidNormalizedUser } from '../messages/message-utils.js'
import type { CommunityCreateOptions, CommunityMetadata, LinkedGroup } from './community-types.js'

const MAX_SUBJECT = 100
const num = (v: string | undefined): number | undefined => (v !== undefined && Number.isFinite(Number(v)) ? Number(v) : undefined)

/** Metadata dari `<group>`; menambahkan penanda komunitas. */
export function extractCommunityMetadata(group: BinaryNode): CommunityMetadata {
  return {
    ...extractGroupMetadata(group),
    isCommunity: !!getChild(group, 'parent'),
    linkedParent: getChild(group, 'linked_parent')?.attrs.jid,
    isCommunityAnnounce: !!getChild(group, 'default_sub_group'),
  }
}

export function parseCommunityResult(result: BinaryNode): CommunityMetadata {
  const group = getChild(result, 'group')
  if (!group) throw new GroupError('Response has no <group>')
  return extractCommunityMetadata(group)
}

export function buildCommunityCreate(subject: string, options: CommunityCreateOptions = {}): BinaryNode {
  const text = subject.trim()
  if (!text) throw new GroupError('Subject must not be empty')
  if ([...text].length > MAX_SUBJECT) throw new GroupError(`Subject is too long (max ${MAX_SUBJECT})`)

  const content: BinaryNode[] = []
  if (options.description) {
    content.push({
      tag: 'description',
      attrs: { id: generateMessageId() },
      content: [{ tag: 'body', attrs: {}, content: Buffer.from(options.description, 'utf8') }],
    })
  }
  content.push({ tag: 'parent', attrs: { default_membership_approval_mode: options.approvalMode ?? 'request_required' } })
  if (options.allowNonAdminSubGroupCreation !== false) content.push({ tag: 'allow_non_admin_sub_group_creation', attrs: {} })
  content.push({ tag: 'create_general_chat', attrs: {} })

  return groupIq(`@${GROUP_SERVER}`, 'set', [{ tag: 'create', attrs: { subject: text }, content }])
}

export const buildSubGroupsQuery = (communityJid: string): BinaryNode =>
  groupIq(communityJid, 'get', [{ tag: 'sub_groups', attrs: {} }])

export function parseSubGroups(result: BinaryNode): LinkedGroup[] {
  const container = getChild(result, 'sub_groups')
  return container
    ? getChildren(container, 'group').map((g) => ({
        id: g.attrs.id ? jidEncode(g.attrs.id.replace(/@.*/, ''), GROUP_SERVER) : undefined,
        subject: g.attrs.subject,
        creation: num(g.attrs.creation),
        owner: g.attrs.creator ? jidNormalizedUser(g.attrs.creator) : undefined,
        size: num(g.attrs.size),
      }))
    : []
}

export const buildLinkGroup = (communityJid: string, groupJid: string): BinaryNode =>
  groupIq(communityJid, 'set', [
    { tag: 'links', attrs: {}, content: [{ tag: 'link', attrs: { link_type: 'sub_group' }, content: [{ tag: 'group', attrs: { jid: groupJid } }] }] },
  ])

export const buildUnlinkGroup = (communityJid: string, groupJid: string): BinaryNode =>
  groupIq(communityJid, 'set', [
    { tag: 'unlink', attrs: { unlink_type: 'sub_group' }, content: [{ tag: 'group', attrs: { jid: groupJid } }] },
  ])

/** Buat grup baru yang langsung terhubung ke komunitas. */
export function buildCreateLinkedGroup(subject: string, participants: readonly string[], communityJid: string, key = generateMessageId()): BinaryNode {
  const text = subject.trim()
  if (!text) throw new GroupError('Subject must not be empty')
  return groupIq(`@${GROUP_SERVER}`, 'set', [
    {
      tag: 'create',
      attrs: { subject: text, key },
      content: [...participants.map((jid) => ({ tag: 'participant', attrs: { jid } })), { tag: 'linked_parent', attrs: { jid: communityJid } }],
    },
  ])
}

export const buildLeaveCommunity = (communityJid: string): BinaryNode =>
  groupIq(`@${GROUP_SERVER}`, 'set', [{ tag: 'leave', attrs: {}, content: [{ tag: 'community', attrs: { id: communityJid } }] }])
