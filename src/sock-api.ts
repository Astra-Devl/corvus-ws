import type { AuthCreds } from './auth/credentials.js'
import type { CatalogQueryOptions } from './business/business-types.js'
import type { ReactionCodes } from './channels/channel-types.js'
import type { MuteDuration } from './chats/chat-mute.js'
import type { CommunityCreateOptions } from './communities/community-types.js'
import type { BlockAction, ProfilePictureType } from './contacts/contact-types.js'
import type { EphemeralDuration, GroupSetting, MemberAddMode } from './groups/group-types.js'
import type { CorvusClientCore } from './make-socket.js'
import type { MediaSource, MediaKind } from './media/media-types.js'
import type { HeaderInput, InteractiveInput } from './messages/button-types.js'
import type { MessageInput } from './messages/generate-message.js'
import type { MessageKey } from './messages/message-key.js'
import type { SendOptions } from './messages/send-message.js'
import type { WAMessage } from './messages/message-utils.js'
import type { PrivacyCategory, PrivacyValue } from './privacy/privacy-types.js'

/** Sumber media: URL/path (string), Buffer, atau `{ url | path | buffer | stream }`. */
export type SockMediaSource = string | Uint8Array | MediaSource

type Passthrough = Extract<
  MessageInput,
  { location: unknown } | { contacts: unknown } | { buttons: unknown } | { list: unknown } | { template: unknown } | { carousel: unknown } | { raw: unknown }
>

/** Isi pesan untuk `sock.sendMessage`. */
export type SockMessageContent =
  | { text: string; mentions?: string[] }
  | { image: SockMediaSource; caption?: string; viewOnce?: boolean; mimetype?: string }
  | { video: SockMediaSource; caption?: string; gifPlayback?: boolean; viewOnce?: boolean; mimetype?: string }
  | { audio: SockMediaSource; ptt?: boolean; mimetype?: string }
  | { document: SockMediaSource; fileName?: string; mimetype?: string; caption?: string }
  | { sticker: SockMediaSource; packName?: string; publisher?: string; emojis?: string[] }
  | { react: { key: MessageKey; text: string } }
  | { delete: MessageKey }
  | { edit: MessageKey; text: string }
  | { forward: WAMessage; force?: boolean }
  | { interactive: Omit<InteractiveInput, 'header'> & { header?: HeaderInput & { image?: SockMediaSource } } }
  | Passthrough

export type SockChatModification =
  | { archive: boolean }
  | { pin: boolean }
  | { mute: MuteDuration | null }
  | { markRead: boolean }
  | { star: { key: Pick<MessageKey, 'id' | 'fromMe'>; value: boolean } }
  | { clear: true }
  | { delete: true }

export interface SockSendMessage {
  /** Kirim ke channel (`...@newsletter`): mengembalikan ID pesan. */
  (jid: `${string}@newsletter`, content: SockMessageContent, options?: SendOptions): Promise<string>
  (jid: string, content: SockMessageContent, options?: SendOptions): Promise<WAMessage>
}

const toSource = (v: SockMediaSource): MediaSource => {
  if (typeof v === 'string') return /^https?:\/\//i.test(v) ? { url: v } : { path: v }
  if (v instanceof Uint8Array) return { buffer: v }
  return v
}

/** Alias bergaya Baileys di atas modul-modul klien corvus-ws. */
export function createSockApi(c: CorvusClientCore) {
  async function toInput(content: SockMessageContent): Promise<MessageInput> {
    const x = content as Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
    const media = async (kind: MediaKind, source: SockMediaSource): Promise<MessageInput> =>
      c.media.toInput(kind, toSource(source), {
        ...(x.caption !== undefined && { caption: x.caption }),
        ...(x.fileName !== undefined && { fileName: x.fileName }),
        ...(x.mimetype !== undefined && { mimetype: x.mimetype }),
        ...(x.viewOnce !== undefined && { viewOnce: x.viewOnce }),
        ...(kind === 'sticker' && {
          sticker: {
            ...(x.packName !== undefined && { packName: x.packName }),
            ...(x.publisher !== undefined && { publisher: x.publisher }),
            ...(x.emojis !== undefined && { emojis: x.emojis }),
          },
        }),
      })

    if (x.image) return media('image', x.image)
    if (x.video) return media(x.gifPlayback ? 'gif' : 'video', x.video)
    if (x.audio) return media(x.ptt ? 'ptt' : 'audio', x.audio)
    if (x.document) return media('document', x.document)
    if (x.sticker) return media('sticker', x.sticker)
    if (x.react) return { react: x.react.key, emoji: x.react.text }
    if (x.interactive?.header?.image) {
      const { image, ...header } = x.interactive.header
      const prepared = await c.media.prepare('image', toSource(image))
      return { interactive: { ...x.interactive, header: { ...header, media: prepared } } }
    }
    return x as MessageInput // text, delete, edit, forward, location, contacts, buttons, list, template, interactive, carousel, raw
  }

  const sendMessage = (async (jid: string, content: SockMessageContent, options: SendOptions = {}) => {
    const input = await toInput(content)
    if (jid.endsWith('@newsletter')) {
      const raw = 'raw' in input ? input.raw : 'text' in input && !('edit' in input) ? { conversation: input.text } : undefined
      if (!raw) throw new Error('Channel hanya mendukung teks dan media')
      return c.channels.send(jid, raw)
    }
    return (await c.messages.send(jid, input, options)).message!
  }) as SockSendMessage

  return {
    sendMessage,
    readMessages: (keys: readonly MessageKey[]) => c.messages.readMessages(keys),

    // ---- grup ----
    groupMetadata: (jid: string) => c.groups.metadata(jid),
    groupFetchAllParticipating: async () => Object.fromEntries((await c.groups.list()).map((g) => [g.id, g])),
    groupCreate: (subject: string, participants: readonly string[]) => c.groups.create(subject, participants),
    groupLeave: (jid: string) => c.groups.leave(jid),
    groupParticipantsUpdate: (jid: string, participants: readonly string[], action: 'add' | 'remove' | 'promote' | 'demote') =>
      c.groups.updateParticipants(jid, action, participants),
    groupUpdateSubject: (jid: string, subject: string) => c.groups.updateSubject(jid, subject),
    groupUpdateDescription: (jid: string, description?: string) => c.groups.updateDescription(jid, description),
    groupSettingUpdate: (jid: string, setting: GroupSetting) => c.groups.updateSetting(jid, setting),
    groupToggleEphemeral: (jid: string, seconds: EphemeralDuration | number) => c.groups.setEphemeral(jid, seconds),
    groupMemberAddMode: (jid: string, mode: MemberAddMode) => c.groups.setMemberAddMode(jid, mode),
    groupJoinApprovalMode: (jid: string, mode: 'on' | 'off') => c.groups.setJoinApproval(jid, mode === 'on'),
    groupRequestParticipantsList: (jid: string) => c.groups.joinRequests(jid),
    groupRequestParticipantsUpdate: (jid: string, participants: readonly string[], action: 'approve' | 'reject') =>
      c.groups.handleJoinRequests(jid, action, participants),
    groupInviteCode: (jid: string) => c.groups.inviteCode(jid),
    groupRevokeInvite: (jid: string) => c.groups.revokeInvite(jid),
    groupGetInviteInfo: (codeOrUrl: string) => c.groups.inviteInfo(codeOrUrl),
    groupAcceptInvite: (codeOrUrl: string) => c.groups.acceptInvite(codeOrUrl),

    // ---- komunitas ----
    communityCreate: (subject: string, options?: CommunityCreateOptions) => c.communities.create(subject, options),
    communityMetadata: (jid: string) => c.communities.metadata(jid),
    communityFetchLinkedGroups: (jid: string) => c.communities.linkedGroups(jid),
    communityLinkGroup: (groupJid: string, communityJid: string) => c.communities.linkGroup(groupJid, communityJid),
    communityUnlinkGroup: (groupJid: string, communityJid: string) => c.communities.unlinkGroup(groupJid, communityJid),
    communityCreateGroup: (subject: string, participants: readonly string[], communityJid: string) =>
      c.communities.createGroup(subject, participants, communityJid),
    communityLeave: (jid: string) => c.communities.leave(jid),

    // ---- channel ----
    newsletterCreate: (name: string, description?: string, reactionCodes?: ReactionCodes) => c.channels.create(name, description, reactionCodes),
    newsletterMetadata: (type: 'jid' | 'invite', key: string) => c.channels.metadata(type, key),
    newsletterFollow: (jid: string) => c.channels.follow(jid),
    newsletterUnfollow: (jid: string) => c.channels.unfollow(jid),
    newsletterMute: (jid: string) => c.channels.mute(jid),
    newsletterUnmute: (jid: string) => c.channels.unmute(jid),
    newsletterDelete: (jid: string) => c.channels.delete(jid),
    newsletterUpdateName: (jid: string, name: string) => c.channels.updateName(jid, name),
    newsletterUpdateDescription: (jid: string, description: string) => c.channels.updateDescription(jid, description),
    newsletterFetchMessages: (type: 'jid' | 'invite', key: string, count: number, after?: number) =>
      c.channels.fetchMessages(type, key, count, after),
    newsletterReactMessage: (jid: string, serverId: string, emoji?: string) => c.channels.react(jid, serverId, emoji),
    newsletterSubscribeUpdates: (jid: string) => c.channels.subscribeLiveUpdates(jid),

    // ---- chat (butuh `appStateSync`) ----
    async chatModify(mod: SockChatModification, jid: string): Promise<void> {
      if ('archive' in mod) return c.chats.archive(jid, mod.archive)
      if ('pin' in mod) return c.chats.pin(jid, mod.pin)
      if ('mute' in mod) return c.chats.mute(jid, mod.mute)
      if ('markRead' in mod) return c.chats.markRead(jid, mod.markRead)
      if ('star' in mod) return c.chats.star(jid, mod.star.key, mod.star.value)
      if ('clear' in mod) return c.chats.clear(jid)
      return c.chats.delete(jid)
    },

    // ---- kontak, panggilan, privasi, bisnis ----
    onWhatsApp: (...phones: string[]) => c.contacts.onWhatsApp(phones),
    fetchStatus: (...jids: string[]) => c.contacts.fetchStatus(jids),
    profilePictureUrl: (jid: string, type?: ProfilePictureType) => c.contacts.profilePictureUrl(jid, type),
    fetchBlocklist: () => c.contacts.fetchBlocklist(),
    updateBlockStatus: (jid: string, action: BlockAction) => c.contacts.updateBlockStatus(jid, action),
    rejectCall: (callId: string, from?: string) => c.calls.reject(callId, from),
    fetchPrivacySettings: (force?: boolean) => c.privacy.fetch(force),
    updatePrivacy: (category: PrivacyCategory, value: PrivacyValue) => c.privacy.update(category, value),
    updateDefaultDisappearingMode: (seconds: number) => c.privacy.setDefaultDisappearing(seconds),
    getBusinessProfile: (jid: string) => c.business.profile(jid),
    getCatalog: (jid: string, options?: CatalogQueryOptions) => c.business.catalog(jid, options),
    getCollections: (jid: string, limit?: number) => c.business.collections(jid, limit),
  }
}

export type SockApi = ReturnType<typeof createSockApi> & {
  /** Akun yang sedang login (`id`, `name`, ...). `undefined` sebelum login. */
  readonly user: AuthCreds['me']
}

/** Tempelkan alias `sock.*` ke klien. */
export function attachSockApi(core: CorvusClientCore): CorvusClientCore & SockApi {
  const client = Object.assign(core, createSockApi(core)) as CorvusClientCore & SockApi
  Object.defineProperty(client, 'user', { get: () => core.auth.creds.me, enumerable: true })
  return client
}
