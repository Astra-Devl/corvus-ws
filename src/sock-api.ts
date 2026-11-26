import type { AuthCreds } from './auth/credentials.js'
import { createGobizApi, type GobizApi } from './gobiz/gobiz-api.js'
import type { CatalogQueryOptions } from './business/business-types.js'
import { parseChannelCode } from './channels/channel-url.js'
import type { ReactionCodes } from './channels/channel-types.js'
import type { MuteDuration } from './chats/chat-mute.js'
import type { CommunityCreateOptions } from './communities/community-types.js'
import type { BlockAction, ProfilePictureType } from './contacts/contact-types.js'
import type { EphemeralDuration, GroupSetting, MemberAddMode } from './groups/group-types.js'
import type { CorvusClientCore } from './make-socket.js'
import type { MediaSource, MediaKind } from './media/media-types.js'
import type { ButtonsInput, CarouselCard, CarouselInput, HeaderInput, InteractiveInput, TemplateInput } from './messages/button-types.js'
import type { ContextInfoInput, ExternalAdReplyInput, ForwardedNewsletterInput } from './messages/context-input.js'
import { generateMessageContent, type MessageInput } from './messages/generate-message.js'
import type { MessageKey } from './messages/message-key.js'
import type {
  EventInput, GroupInviteInput, OrderInput, PinInput, PollInput, ProductInput, RequestPaymentInput,
} from './messages/rare-messages.js'
import type { SendOptions } from './messages/send-message.js'
import type { WAMessage } from './messages/message-utils.js'
import type { PrivacyCategory, PrivacyValue } from './privacy/privacy-types.js'

/** Sumber media: URL/path (string), Buffer, atau `{ url | path | buffer | stream }`. */
export type SockMediaSource = string | Uint8Array | MediaSource

/** Header kartu/pesan interaktif: sumber media langsung (link, path, Buffer, stream) atau hasil `media.prepare`. */
export type SockHeader = HeaderInput & {
  image?: SockMediaSource
  video?: SockMediaSource
  /** Video yang diputar berulang (GIF). Dipakai bersama `video`. */
  gif?: boolean
  document?: SockMediaSource
  fileName?: string
  mimetype?: string
}

export type SockCarouselInput = Omit<CarouselInput, 'header' | 'cards'> & {
  header?: SockHeader
  cards: Array<Omit<CarouselCard, 'header'> & { header?: SockHeader }>
}

/** Sumber media langsung untuk header `buttons` / `template` klasik. */
export interface SockMediaFields {
  image?: SockMediaSource
  video?: SockMediaSource
  document?: SockMediaSource
  fileName?: string
  mimetype?: string
}

export type SockExternalAdReply = Omit<ExternalAdReplyInput, 'thumbnail'> & {
  /** Pratinjau: link, path, atau Buffer (dibaca otomatis). */
  thumbnail?: SockMediaSource
}

/**
 * `contextInfo` untuk SEMUA jenis pesan: external ad reply, diteruskan dari saluran, mention semua, dll.
 * Bisa ditaruh di isi pesan atau di opsi ketiga `sendMessage`.
 */
export interface SockContextShortcuts {
  contextInfo?: ContextInfoInput
  externalAdReply?: SockExternalAdReply
  forwardedNewsletter?: ForwardedNewsletterInput
  mentionAll?: boolean
  isForwarded?: boolean
  forwardingScore?: number
}

type Passthrough = Extract<MessageInput, { location: unknown } | { contacts: unknown } | { list: unknown } | { raw: unknown }>

type SockContent =
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
  | { buttons: Omit<ButtonsInput, 'media'> & SockMediaFields }
  | { template: Omit<TemplateInput, 'media'> & SockMediaFields }
  | { interactive: Omit<InteractiveInput, 'header'> & { header?: SockHeader } }
  | { carousel: SockCarouselInput }
  // ---- pesan langka ----
  | { event: EventInput }
  | { poll: PollInput }
  | { pin: PinInput }
  | { album: { images?: number; videos?: number } }
  | { requestPayment: RequestPaymentInput }
  | { sendPayment: { requestKey: MessageKey; note?: string } }
  | { cancelPaymentRequest: MessageKey }
  | { declinePaymentRequest: MessageKey }
  | { paymentInvite: { service?: 'FBPAY' | 'NOVI' | 'UPI'; expiresAt?: Date | number } }
  | { product: Omit<ProductInput, 'image'> & { image?: SockMediaSource } }
  | { order: Omit<OrderInput, 'thumbnail'> & { thumbnail?: SockMediaSource } }
  | { invoice: { note: string; token?: string } }
  | { groupInvite: GroupInviteInput }
  | { scheduledCall: { title: string; at: Date | number; type?: 'voice' | 'video' } }
  | { cancelScheduledCall: MessageKey }
  | { requestPhoneNumber: true }
  /** Video bulat (PTV / video note). */
  | { ptv: SockMediaSource }
  /** Status grup; isinya pesan biasa (teks/media). */
  | { groupStatus: { text: string } | { image: SockMediaSource; caption?: string } | { video: SockMediaSource; caption?: string } }
  | Passthrough

/** Isi pesan untuk `sock.sendMessage`. */
export type SockMessageContent = SockContent & SockContextShortcuts

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

const SHORTCUT_KEYS = ['contextInfo', 'externalAdReply', 'forwardedNewsletter', 'mentionAll', 'isForwarded', 'forwardingScore'] as const

/** Alias bergaya Baileys di atas modul-modul klien corvus-ws. */
export function createSockApi(c: CorvusClientCore) {
  const bytesOf = async (src: SockMediaSource): Promise<Uint8Array> => (src instanceof Uint8Array ? src : c.media.readSource(toSource(src)))

  async function toInput(content: SockMessageContent, jid: string): Promise<MessageInput> {
    const x = { ...(content as Record<string, any>) } // eslint-disable-line @typescript-eslint/no-explicit-any
    for (const k of SHORTCUT_KEYS) delete x[k]
    const isNews = jid.endsWith('@newsletter')
    const prep = (kind: MediaKind, source: SockMediaSource, opts: Parameters<typeof c.media.prepare>[2] = {}) =>
      c.media.prepare(kind, toSource(source), { ...opts, ...(isNews && { newsletter: true }) })

    const media = async (kind: MediaKind, source: SockMediaSource): Promise<MessageInput> => ({
      raw: await prep(kind, source, {
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
      }),
    })

    if (x.image) return media('image', x.image)
    if (x.video) return media(x.gifPlayback ? 'gif' : 'video', x.video)
    if (x.audio) return media(x.ptt ? 'ptt' : 'audio', x.audio)
    if (x.document) return media('document', x.document)
    if (x.sticker) return media('sticker', x.sticker)
    if (x.react) return { react: x.react.key, emoji: x.react.text }

    // sumber media langsung (link / path / Buffer / stream) → di-upload otomatis
    const pickMedia = async (f: SockMediaFields | SockHeader): Promise<Record<string, unknown> | undefined> => {
      const { image, video, document, fileName, mimetype } = f
      const gif = (f as SockHeader).gif
      const picked = image ? (['image', image] as const) : video ? ([gif ? 'gif' : 'video', video] as const) : document ? (['document', document] as const) : undefined
      if (!picked) return undefined
      return prep(picked[0], picked[1], { ...(fileName !== undefined && { fileName }), ...(mimetype !== undefined && { mimetype }) })
    }
    const stripMedia = <T extends SockMediaFields>(o: T): Omit<T, 'image' | 'video' | 'document' | 'fileName' | 'mimetype'> => {
      const { image, video, document, fileName, mimetype, ...rest } = o as SockMediaFields & Record<string, unknown>
      void image; void video; void document; void fileName; void mimetype
      return rest as never
    }
    const resolveHeader = async (h: SockHeader | undefined): Promise<HeaderInput | undefined> => {
      if (!h) return undefined
      const { image, video, document, gif, fileName, mimetype, ...rest } = h
      void image; void video; void document; void gif; void fileName; void mimetype
      const prepared = await pickMedia(h)
      return prepared ? { ...rest, media: prepared } : rest
    }

    if (x.buttons) return { buttons: { ...stripMedia(x.buttons), ...((await pickMedia(x.buttons)) && { media: await pickMedia(x.buttons) }) } } as MessageInput
    if (x.template) return { template: { ...stripMedia(x.template), ...((await pickMedia(x.template)) && { media: await pickMedia(x.template) }) } } as MessageInput
    if (x.interactive) return { interactive: { ...x.interactive, header: await resolveHeader(x.interactive.header) } } as MessageInput
    if (x.carousel) {
      const car = x.carousel as SockCarouselInput
      const cards = await Promise.all(car.cards.map(async (card) => ({ ...card, header: await resolveHeader(card.header) })))
      return { carousel: { ...car, header: await resolveHeader(car.header), cards } } as MessageInput
    }
    if (x.ptv) return { ptv: await prep('video', x.ptv) } as MessageInput
    if (x.product?.image) {
      const image = (await prep('image', x.product.image)).imageMessage
      return { product: { ...x.product, image } } as MessageInput
    }
    if (x.order?.thumbnail) return { order: { ...x.order, thumbnail: await bytesOf(x.order.thumbnail) } } as MessageInput
    if (x.groupStatus) {
      const inner = generateMessageContent(await toInput(x.groupStatus as SockMessageContent, jid))
      return { groupStatus: inner } as MessageInput
    }
    return x as MessageInput
  }

  /** Gabungkan pintasan konteks dari isi pesan dengan `options.contextInfo`. */
  async function resolveContext(content: SockMessageContent, options: SendOptions): Promise<ContextInfoInput | undefined> {
    const x = content as SockContextShortcuts
    const ad = x.externalAdReply
    const ctx: ContextInfoInput = {
      ...x.contextInfo,
      ...(ad && { externalAdReply: { ...ad, thumbnail: ad.thumbnail ? await bytesOf(ad.thumbnail) : undefined } as ExternalAdReplyInput }),
      ...(x.forwardedNewsletter && { forwardedNewsletter: x.forwardedNewsletter }),
      ...(x.mentionAll && { mentionAll: true }),
      ...(x.isForwarded !== undefined && { isForwarded: x.isForwarded }),
      ...(x.forwardingScore !== undefined && { forwardingScore: x.forwardingScore }),
      ...options.contextInfo,
    }
    return Object.keys(ctx).length > 0 ? ctx : undefined
  }

  const sendMessage = (async (jid: string, content: SockMessageContent, options: SendOptions = {}) => {
    const input = await toInput(content, jid)
    const contextInfo = await resolveContext(content, options)
    if (jid.endsWith('@newsletter')) {
      const message = generateMessageContent(input, { ...(contextInfo && { contextInfo }) })
      return c.channels.send(jid, message)
    }
    return (await c.messages.send(jid, input, { ...options, ...(contextInfo && { contextInfo }) })).message!
  }) as SockSendMessage

  /** Kirim album (beberapa foto/video terkelompok). Mengembalikan pesan induk dan anak-anaknya. */
  async function sendAlbumMessage(
    jid: string,
    items: Array<{ image: SockMediaSource; caption?: string } | { video: SockMediaSource; caption?: string }>,
    options: SendOptions = {},
  ): Promise<WAMessage[]> {
    const images = items.filter((i) => 'image' in i).length
    const videos = items.length - images
    const parent = await sendMessage(jid, { album: { images, videos } }, options)
    const sent: WAMessage[] = [parent]
    for (const [index, item] of items.entries()) {
      const prepared = await c.media.prepare('image' in item ? 'image' : 'video', toSource('image' in item ? item.image : (item as { video: SockMediaSource }).video), {
        ...(item.caption !== undefined && { caption: item.caption }),
      })
      const raw = { ...prepared, messageContextInfo: { messageAssociation: { associationType: 1, parentMessageKey: parent.key, messageIndex: index + 1 } } }
      sent.push((await c.messages.send(jid, { raw }, options)).message!)
    }
    return sent
  }

  /** Kirim kartu undangan grup. Kode undangan diambil otomatis bila Anda admin. */
  async function sendGroupInvite(jid: string, groupJid: string, caption?: string, options: SendOptions = {}): Promise<WAMessage> {
    const [code, meta] = await Promise.all([c.groups.inviteCode(groupJid), c.groups.metadata(groupJid)])
    return sendMessage(jid, { groupInvite: { groupJid, inviteCode: code, groupName: meta?.subject ?? groupJid, ...(caption !== undefined && { caption }) } }, options)
  }

  /** `https://whatsapp.com/channel/<kode>` → JID saluran (`...@newsletter`). */
  async function newsletterIdFromUrl(urlOrCode: string): Promise<string> {
    const meta = await c.channels.metadata('invite', parseChannelCode(urlOrCode))
    if (!meta?.id) throw new Error('Saluran tidak ditemukan untuk URL/kode tersebut')
    return meta.id
  }

  return {
    sendMessage,
    sendAlbumMessage,
    sendGroupInvite,
    newsletterIdFromUrl,
    newsletterUrlId: newsletterIdFromUrl,
    newsletterFromUrl: (urlOrCode: string) => c.channels.metadata('invite', parseChannelCode(urlOrCode)),
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
    newsletterMetadata: (type: 'jid' | 'invite', key: string) => c.channels.metadata(type, type === 'invite' ? parseChannelCode(key) : key),
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

export type SockApi = ReturnType<typeof createSockApi> & GobizApi & {
  /** Akun yang sedang login (`id`, `name`, ...). `undefined` sebelum login. */
  readonly user: AuthCreds['me']
}

/** Tempelkan alias `sock.*` ke klien. */
export function attachSockApi(core: CorvusClientCore): CorvusClientCore & SockApi {
  const base = createSockApi(core)
  // fungsi GoBiz sengaja dipisah dari fitur kirim pesan (src/gobiz)
  const client = Object.assign(core, base, createGobizApi(base.sendMessage)) as CorvusClientCore & SockApi
  Object.defineProperty(client, 'user', { get: () => core.auth.creds.me, enumerable: true })
  return client
}
