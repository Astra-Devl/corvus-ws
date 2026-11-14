import { GroupError } from '../core/errors.js'
import type { TypedEventEmitter } from '../core/event-emitter.js'
import type { CorvusEventMap } from '../core/event-mapping.js'
import type { BinaryNode } from '../protocol/protocol-types.js'
import { jidNormalizedUser } from '../messages/message-utils.js'
import {
  buildAcceptInvite,
  buildInviteCodeQuery,
  buildInviteInfoQuery,
  buildRevokeInvite,
  inviteLink,
  parseAcceptResult,
  parseInviteCode,
  parseInviteCodeResult,
} from './group-invite.js'
import { buildMetadataQuery, buildParticipatingQuery, parseGroupResult, parseParticipatingGroups } from './group-metadata.js'
import { buildJoinRequestsAction, buildJoinRequestsQuery, buildParticipantsUpdate, parseJoinRequests, parseParticipantsResult, type JoinRequest } from './group-participants.js'
import {
  buildCreate,
  buildDescriptionUpdate,
  buildEphemeralUpdate,
  buildJoinApprovalUpdate,
  buildLeave,
  buildMemberAddModeUpdate,
  buildSettingUpdate,
  buildSubjectUpdate,
} from './group-settings.js'
import type { EphemeralDuration, GroupMetadata, GroupSetting, MemberAddMode, ParticipantAction, ParticipantUpdateResult } from './group-types.js'

export interface GroupManagerOptions {
  query: (node: BinaryNode, timeoutMs?: number) => Promise<BinaryNode>
  ev?: TypedEventEmitter<CorvusEventMap>
  /** Masa berlaku cache metadata (default 5 menit). */
  cacheTtlMs?: number
  now?: () => number
}

interface CacheEntry {
  metadata: GroupMetadata
  expires: number
}

export class GroupManager {
  readonly #opts: GroupManagerOptions
  readonly #cache = new Map<string, CacheEntry>()
  readonly #ttl: number
  readonly #now: () => number

  constructor(options: GroupManagerOptions) {
    this.#opts = options
    this.#ttl = options.cacheTtlMs ?? 5 * 60_000
    this.#now = options.now ?? Date.now
  }

  #remember(metadata: GroupMetadata): GroupMetadata {
    this.#cache.set(metadata.id, { metadata, expires: this.#now() + this.#ttl })
    return metadata
  }

  /** Buang metadata dari cache (dipanggil saat ada notifikasi perubahan). */
  invalidate(groupJid?: string): void {
    if (groupJid === undefined) this.#cache.clear()
    else this.#cache.delete(groupJid)
  }

  async metadata(groupJid: string, options: { force?: boolean } = {}): Promise<GroupMetadata> {
    const cached = this.#cache.get(groupJid)
    if (!options.force && cached && cached.expires > this.#now()) return cached.metadata
    return this.#remember(parseGroupResult(await this.#opts.query(buildMetadataQuery(groupJid))))
  }

  /** Semua grup yang diikuti. */
  async list(): Promise<GroupMetadata[]> {
    const groups = parseParticipatingGroups(await this.#opts.query(buildParticipatingQuery()))
    for (const g of groups) this.#remember(g)
    if (groups.length > 0) this.#opts.ev?.emit('groups.upsert', groups)
    return groups
  }

  /** User JID anggota grup; cocok sebagai `getGroupParticipants` pada relay. */
  async getParticipants(groupJid: string): Promise<string[]> {
    const meta = await this.metadata(groupJid)
    return [...new Set(meta.participants.map((p) => jidNormalizedUser(p.id)))]
  }

  async create(subject: string, participants: readonly string[]): Promise<GroupMetadata> {
    const metadata = this.#remember(parseGroupResult(await this.#opts.query(buildCreate(subject, participants))))
    this.#opts.ev?.emit('groups.upsert', [metadata])
    return metadata
  }

  async leave(groupJid: string): Promise<void> {
    await this.#opts.query(buildLeave(groupJid))
    this.invalidate(groupJid)
  }

  async updateParticipants(groupJid: string, action: ParticipantAction, participants: readonly string[]): Promise<ParticipantUpdateResult[]> {
    const result = await this.#opts.query(buildParticipantsUpdate(groupJid, action, participants))
    this.invalidate(groupJid)
    return parseParticipantsResult(result, action)
  }

  /** Permintaan bergabung (untuk grup dengan persetujuan admin). */
  async joinRequests(groupJid: string): Promise<JoinRequest[]> {
    return parseJoinRequests(await this.#opts.query(buildJoinRequestsQuery(groupJid)))
  }

  async handleJoinRequests(groupJid: string, action: 'approve' | 'reject', participants: readonly string[]): Promise<void> {
    await this.#opts.query(buildJoinRequestsAction(groupJid, action, participants))
    this.invalidate(groupJid)
  }

  async updateSubject(groupJid: string, subject: string): Promise<void> {
    await this.#opts.query(buildSubjectUpdate(groupJid, subject))
    this.invalidate(groupJid)
  }

  /** Ubah deskripsi; `undefined` menghapusnya. */
  async updateDescription(groupJid: string, description?: string): Promise<void> {
    const prev = (await this.metadata(groupJid).catch(() => undefined))?.descId
    await this.#opts.query(buildDescriptionUpdate(groupJid, description, prev))
    this.invalidate(groupJid)
  }

  async updateSetting(groupJid: string, setting: GroupSetting): Promise<void> {
    await this.#opts.query(buildSettingUpdate(groupJid, setting))
    this.invalidate(groupJid)
  }

  async setEphemeral(groupJid: string, expiration: EphemeralDuration | number): Promise<void> {
    await this.#opts.query(buildEphemeralUpdate(groupJid, expiration))
    this.invalidate(groupJid)
  }

  async setMemberAddMode(groupJid: string, mode: MemberAddMode): Promise<void> {
    await this.#opts.query(buildMemberAddModeUpdate(groupJid, mode))
    this.invalidate(groupJid)
  }

  async setJoinApproval(groupJid: string, enabled: boolean): Promise<void> {
    await this.#opts.query(buildJoinApprovalUpdate(groupJid, enabled))
    this.invalidate(groupJid)
  }

  async inviteCode(groupJid: string): Promise<string> {
    return parseInviteCodeResult(await this.#opts.query(buildInviteCodeQuery(groupJid)))
  }

  async inviteLink(groupJid: string): Promise<string> {
    return inviteLink(await this.inviteCode(groupJid))
  }

  /** Cabut kode lama dan buat yang baru. */
  async revokeInvite(groupJid: string): Promise<string> {
    return parseInviteCodeResult(await this.#opts.query(buildRevokeInvite(groupJid)))
  }

  async inviteInfo(codeOrUrl: string): Promise<GroupMetadata> {
    return parseGroupResult(await this.#opts.query(buildInviteInfoQuery(parseInviteCode(codeOrUrl))))
  }

  /** Bergabung lewat kode/URL; mengembalikan JID grup. */
  async acceptInvite(codeOrUrl: string): Promise<string> {
    const jid = parseAcceptResult(await this.#opts.query(buildAcceptInvite(parseInviteCode(codeOrUrl))))
    if (!jid) throw new GroupError('Server did not return the group JID')
    return jid
  }
}
