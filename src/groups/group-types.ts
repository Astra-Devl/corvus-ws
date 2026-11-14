import type { BinaryNode } from '../protocol/protocol-types.js'

export type { GroupMetadata, GroupParticipant, ParticipantAction } from '../store/group-store.js'

export type GroupSetting = 'announcement' | 'not_announcement' | 'locked' | 'unlocked'
export type MemberAddMode = 'admin_add' | 'all_member_add'
/** Durasi pesan sementara yang valid (detik); 0 = nonaktif. */
export type EphemeralDuration = 0 | 86_400 | 604_800 | 7_776_000

export interface ParticipantUpdateResult {
  jid: string
  /** `200` bila sukses; selain itu kode error server (mis. `403`, `408`, `409`). */
  status: string
  content?: BinaryNode | undefined
}
