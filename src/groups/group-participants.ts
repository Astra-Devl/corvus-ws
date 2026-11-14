import { GroupError } from '../core/errors.js'
import { getChild, getChildren } from '../protocol/binary-node.js'
import type { BinaryNode } from '../protocol/protocol-types.js'
import { groupIq } from './group-metadata.js'
import type { ParticipantAction, ParticipantUpdateResult } from './group-types.js'

const ACTIONS: readonly ParticipantAction[] = ['add', 'remove', 'promote', 'demote']

export function buildParticipantsUpdate(groupJid: string, action: ParticipantAction, participants: readonly string[]): BinaryNode {
  if (!ACTIONS.includes(action)) throw new GroupError(`Unknown participant action: ${String(action)}`)
  if (participants.length === 0) throw new GroupError('At least one participant is required')
  if (participants.some((p) => !p.includes('@'))) throw new GroupError('Participants must be JIDs')

  return groupIq(groupJid, 'set', [
    { tag: action, attrs: {}, content: [...new Set(participants)].map((jid) => ({ tag: 'participant', attrs: { jid } })) },
  ])
}

/** Hasil per-peserta dari `<iq><add><participant jid error?/></add></iq>`. */
export function parseParticipantsResult(result: BinaryNode, action: ParticipantAction): ParticipantUpdateResult[] {
  const container = getChild(result, action)
  return container
    ? getChildren(container, 'participant').map((p) => ({
        jid: p.attrs.jid ?? '',
        status: p.attrs.error ?? '200',
        content: p,
      }))
    : []
}

export interface JoinRequest {
  jid: string
  requestMethod: string | undefined
  /** Epoch detik. */
  requestTime: number | undefined
}

export const buildJoinRequestsQuery = (groupJid: string): BinaryNode =>
  groupIq(groupJid, 'get', [{ tag: 'membership_approval_requests', attrs: {} }])

export function parseJoinRequests(result: BinaryNode): JoinRequest[] {
  const container = getChild(result, 'membership_approval_requests')
  return container
    ? getChildren(container, 'membership_approval_request').map((r) => ({
        jid: r.attrs.jid ?? '',
        requestMethod: r.attrs.request_method,
        requestTime: r.attrs.request_time !== undefined ? Number(r.attrs.request_time) : undefined,
      }))
    : []
}

export function buildJoinRequestsAction(groupJid: string, action: 'approve' | 'reject', participants: readonly string[]): BinaryNode {
  if (participants.length === 0) throw new GroupError('At least one participant is required')
  return groupIq(groupJid, 'set', [
    {
      tag: 'membership_requests_action',
      attrs: {},
      content: [{ tag: action, attrs: {}, content: participants.map((jid) => ({ tag: 'participant', attrs: { jid } })) }],
    },
  ])
}
