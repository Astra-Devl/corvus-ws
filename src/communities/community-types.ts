import type { GroupMetadata } from '../groups/group-types.js'

export interface CommunityMetadata extends GroupMetadata {
  /** Node ini adalah komunitas (induk), bukan grup biasa. */
  isCommunity: boolean
  /** Bila grup ini terhubung ke komunitas: JID komunitasnya. */
  linkedParent?: string | undefined
  /** Grup pengumuman bawaan komunitas. */
  isCommunityAnnounce?: boolean | undefined
}

export interface LinkedGroup {
  id: string | undefined
  subject: string | undefined
  creation: number | undefined
  owner: string | undefined
  size: number | undefined
}

export interface CommunityCreateOptions {
  description?: string
  /** Persetujuan admin untuk bergabung ke komunitas (default `request_required`). */
  approvalMode?: 'request_required' | 'off'
  /** Izinkan non-admin membuat sub-grup (default true). */
  allowNonAdminSubGroupCreation?: boolean
}
