import { GroupError } from '../core/errors.js'
import type { TypedEventEmitter } from '../core/event-emitter.js'
import type { CorvusEventMap } from '../core/event-mapping.js'
import type { GroupManager } from '../groups/group-manager.js'
import { buildMetadataQuery } from '../groups/group-metadata.js'
import type { BinaryNode } from '../protocol/protocol-types.js'
import {
  buildCommunityCreate,
  buildCreateLinkedGroup,
  buildLeaveCommunity,
  buildLinkGroup,
  buildSubGroupsQuery,
  buildUnlinkGroup,
  parseCommunityResult,
  parseSubGroups,
} from './community-groups.js'
import type { CommunityCreateOptions, CommunityMetadata, LinkedGroup } from './community-types.js'

export interface CommunityManagerOptions {
  query: (node: BinaryNode, timeoutMs?: number) => Promise<BinaryNode>
  /** Dipakai untuk operasi yang identik dengan grup (peserta, pengaturan, undangan). */
  groups: GroupManager
  ev?: TypedEventEmitter<CorvusEventMap>
}

/** Komunitas = grup induk + sub-grup. Operasi grup biasa ada di `groups`. */
export class CommunityManager {
  readonly groups: GroupManager
  readonly #opts: CommunityManagerOptions

  constructor(options: CommunityManagerOptions) {
    this.#opts = options
    this.groups = options.groups
  }

  async create(subject: string, options: CommunityCreateOptions = {}): Promise<CommunityMetadata> {
    const community = parseCommunityResult(await this.#opts.query(buildCommunityCreate(subject, options)))
    this.#opts.ev?.emit('groups.upsert', [community])
    return community
  }

  async metadata(communityJid: string): Promise<CommunityMetadata> {
    return parseCommunityResult(await this.#opts.query(buildMetadataQuery(communityJid)))
  }

  async linkedGroups(communityJid: string): Promise<LinkedGroup[]> {
    return parseSubGroups(await this.#opts.query(buildSubGroupsQuery(communityJid)))
  }

  async linkGroup(groupJid: string, communityJid: string): Promise<void> {
    await this.#opts.query(buildLinkGroup(communityJid, groupJid))
    this.groups.invalidate(groupJid)
  }

  async unlinkGroup(groupJid: string, communityJid: string): Promise<void> {
    await this.#opts.query(buildUnlinkGroup(communityJid, groupJid))
    this.groups.invalidate(groupJid)
  }

  /** Buat grup baru di dalam komunitas. */
  async createGroup(subject: string, participants: readonly string[], communityJid: string): Promise<CommunityMetadata> {
    const group = parseCommunityResult(await this.#opts.query(buildCreateLinkedGroup(subject, participants, communityJid)))
    if (!group.linkedParent) throw new GroupError('Server did not link the new group to the community', { data: { communityJid } })
    this.#opts.ev?.emit('groups.upsert', [group])
    return group
  }

  async leave(communityJid: string): Promise<void> {
    await this.#opts.query(buildLeaveCommunity(communityJid))
    this.groups.invalidate(communityJid)
  }
}
