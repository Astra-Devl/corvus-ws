import { MessageError } from '../core/errors.js'
import type { Logger } from '../core/socket-config.js'
import { noopLogger } from '../core/defaults.js'
import type { TransactionalKeyStore } from '../auth/key-store.js'
import type { CryptoEngine } from '../crypto/crypto-engine.js'
import { padRandomMax16 } from '../crypto/encryption.js'
import { jidToSignalAddress, type PreKeyBundle } from '../crypto/session.js'
import { isLidUser, jidDecode } from '../utils/jid.js'
import { getChild, getChildren, getContentBytes } from '../protocol/binary-node.js'
import type { ProtocolEngine } from '../protocol/protocol-engine.js'
import type { BinaryNode } from '../protocol/protocol-types.js'
import { S_WHATSAPP_NET } from '../protocol/stanza-builder.js'
import { PROTOCOL_TYPE } from './message-delete.js'
import { generateMessageId } from './message-key.js'
import type { MessageCodec } from './message-parser.js'
import {
  getContentType,
  isGroupJid,
  jidNormalizedUser,
  normalizeMessageContent,
  type MessageContent,
} from './message-utils.js'

export interface RelayDeps {
  crypto: Pick<CryptoEngine, 'sessions' | 'senderKeys'>
  keys: TransactionalKeyStore
  codec: MessageCodec
  engine: Pick<ProtocolEngine, 'sendNode' | 'query'>
  /** JID akun sendiri beserta device, mis. `62812:0@s.whatsapp.net`. */
  ownJid: string
  /** User JID -> semua device JID miliknya (biasanya via usync). */
  resolveDevices: (userJids: string[]) => Promise<string[]>
  getGroupParticipants?: (groupJid: string) => Promise<string[]>
  /** Default: query `encrypt` ke server. */
  fetchBundles?: (jids: string[]) => Promise<Record<string, PreKeyBundle>>
  /** ADVSignedDeviceIdentity ter-encode, dikirim bersama pkmsg. */
  encodeDeviceIdentity?: () => Uint8Array | undefined
  /** LID akun sendiri (mis. `1234:0@lid`); dipakai untuk chat beralamat LID. */
  ownLid?: string | undefined
  /** PN -> LID bila sudah dipetakan; dipakai untuk alamat sesi Signal dan pengambilan pre-key. */
  resolveSignalJid?: (jid: string) => Promise<string>
  /** Token privasi (`tctoken`) untuk pesan 1:1. */
  getTcToken?: (jid: string) => Promise<Uint8Array | undefined>
  /** Dipanggil setelah pesan 1:1 terkirim (mis. untuk menerbitkan tctoken). */
  onDirectSent?: (jid: string) => void
  logger?: Logger
}

export interface RelayOptions {
  messageId?: string
  attrs?: Record<string, string>
  additionalNodes?: BinaryNode[]
  /** Anggota grup (user JID); default: `deps.getGroupParticipants`. */
  participants?: string[]
}

export interface RelayResult {
  id: string
  node: BinaryNode
  /** Device yang menerima ciphertext. */
  recipients: string[]
  /** Device yang dilewati (tidak ada pre-key bundle / gagal). */
  skipped: string[]
}

// ---- klasifikasi pesan -------------------------------------------------------------

export function getMessageType(content: MessageContent): string {
  const type = getContentType(normalizeMessageContent(content))
  if (type === 'reactionMessage') return 'reaction'
  if (type === 'pollCreationMessage' || type === 'pollUpdateMessage') return 'poll'
  return type && /^(image|video|audio|document|sticker)Message$/.test(type) ? 'media' : 'text'
}

export function getMediaType(content: MessageContent): string | undefined {
  const c = normalizeMessageContent(content)
  if (!c) return undefined
  if (c.imageMessage) return 'image'
  if (c.videoMessage) return c.videoMessage.gifPlayback ? 'gif' : 'video'
  if (c.audioMessage) return c.audioMessage.ptt ? 'ptt' : 'audio'
  if (c.documentMessage) return 'document'
  if (c.stickerMessage) return 'sticker'
  if (c.contactMessage) return 'vcard'
  if (c.contactsArrayMessage) return 'contact_array'
  if (c.locationMessage) return 'location'
  if (c.liveLocationMessage) return 'livelocation'
  if (c.listMessage) return 'list'
  if (c.listResponseMessage) return 'list_response'
  if (c.buttonsResponseMessage) return 'buttons_response'
  if (c.interactiveResponseMessage) return 'native_flow_response'
  if (c.orderMessage) return 'order'
  if (c.productMessage) return 'product'
  if (c.groupInviteMessage) return 'url'
  return undefined
}

/** Atribut `<message>` tambahan untuk edit/hapus. */
export function getRelayAttributes(content: MessageContent): Record<string, string> {
  const protocol = content.protocolMessage
  if (protocol?.type === PROTOCOL_TYPE.REVOKE) return { edit: '7' }
  if (protocol?.type === PROTOCOL_TYPE.MESSAGE_EDIT) return { edit: '1' }
  return {}
}

const NATIVE_FLOW_SPECIALS = [
  'mpm', 'cta_catalog', 'send_location', 'call_permission_request',
  'wa_payment_transaction_details', 'automated_greeting_message_view_catalog',
]

/**
 * Node `<biz>` yang membuat pesan button/list/interaktif dirender WhatsApp.
 * Bentuknya mengikuti implementasi button yang lazim di fork Baileys (paket resmi
 * @whiskeysockets/baileys tidak menyertakannya) dan belum diverifikasi ke server.
 */
export function getBizNodes(content: MessageContent): BinaryNode[] {
  const c = normalizeMessageContent(content)
  if (!c) return []
  const interactive = c.interactiveMessage
  const nativeFlow = interactive?.nativeFlowMessage
  const firstButton = nativeFlow?.buttons?.[0]?.name
  const nativeFlowNode = (name: string, v: string): BinaryNode => ({
    tag: 'interactive',
    attrs: { type: 'native_flow', v: '1' },
    content: [{ tag: 'native_flow', attrs: { v, name } }],
  })

  if (nativeFlow && (firstButton === 'review_and_pay' || firstButton === 'payment_info')) {
    return [{ tag: 'biz', attrs: { native_flow_name: firstButton === 'review_and_pay' ? 'order_details' : firstButton } }]
  }
  if (nativeFlow && firstButton && NATIVE_FLOW_SPECIALS.includes(firstButton)) {
    return [{ tag: 'biz', attrs: {}, content: [nativeFlowNode(firstButton, '2')] }]
  }
  if (interactive || c.buttonsMessage) {
    return [{ tag: 'biz', attrs: {}, content: [nativeFlowNode('mixed', '9')] }]
  }
  if (c.listMessage) {
    // WhatsApp Web mengirim `<list type="product_list" v="2"/>` untuk semua legacy list message
    return [{ tag: 'biz', attrs: {}, content: [{ tag: 'list', attrs: { v: '2', type: 'product_list' } }] }]
  }
  return []
}

/**
 * `<biz>` untuk pesan button/list/interaktif. `bizBot: true` menambahkan `<bot biz_bot="1"/>` pada chat
 * 1:1 (dipakai sebagian helper Baileys; WhatsApp Web asli tidak mengirimnya, jadi default mati).
 */
export function getButtonNodes(content: MessageContent, jid: string, options: { bizBot?: boolean } = {}): BinaryNode[] {
  const biz = getBizNodes(content)
  if (biz.length === 0) return []
  const direct = !isGroupJid(jid) && !jid.endsWith('@newsletter') && jid !== 'status@broadcast'
  return options.bizBot && direct ? [...biz, { tag: 'bot', attrs: { biz_bot: '1' } }] : biz
}

// ---- pre-key bundle ------------------------------------------------------------------

const uintBE = (bytes: Uint8Array | undefined): number | undefined =>
  bytes && bytes.length > 0 && bytes.length <= 6 ? Buffer.from(bytes).readUIntBE(0, bytes.length) : undefined

/** Parse `<iq><list><user jid>...</user></list></iq>` hasil permintaan `encrypt`. */
export function parsePreKeyBundles(result: BinaryNode): Record<string, PreKeyBundle> {
  const bundles: Record<string, PreKeyBundle> = {}
  const list = getChild(result, 'list')
  if (!list) return bundles

  for (const user of getChildren(list, 'user')) {
    const jid = user.attrs.jid
    const identity = getContentBytes(getChild(user, 'identity'))
    const skey = getChild(user, 'skey')
    const key = getChild(user, 'key')
    const registrationId = uintBE(getContentBytes(getChild(user, 'registration')))
    const sId = uintBE(getContentBytes(getChild(skey!, 'id')))
    const sValue = getContentBytes(getChild(skey!, 'value'))
    const sSig = getContentBytes(getChild(skey!, 'signature'))
    if (!jid || !identity || !skey || registrationId === undefined || sId === undefined || !sValue || !sSig) continue

    const oneTimeId = key ? uintBE(getContentBytes(getChild(key, 'id'))) : undefined
    const oneTimeValue = key ? getContentBytes(getChild(key, 'value')) : undefined
    bundles[jid] = {
      registrationId,
      identityKey: identity,
      signedPreKey: { keyId: sId, publicKey: sValue, signature: sSig },
      ...(oneTimeId !== undefined && oneTimeValue && { preKey: { keyId: oneTimeId, publicKey: oneTimeValue } }),
    }
  }
  return bundles
}

/** Ambil pre-key bundle dari server untuk daftar device. */
export async function fetchPreKeyBundles(
  engine: Pick<ProtocolEngine, 'query'>,
  jids: string[],
): Promise<Record<string, PreKeyBundle>> {
  const result = await engine.query({
    tag: 'iq',
    attrs: { xmlns: 'encrypt', type: 'get', to: S_WHATSAPP_NET },
    content: [{ tag: 'key', attrs: {}, content: jids.map((jid) => ({ tag: 'user', attrs: { jid } })) }],
  })
  return parsePreKeyBundles(result)
}

// ---- relay -----------------------------------------------------------------------------

const sameDevice = (a: string, b: string): boolean => jidToSignalAddress(a) === jidToSignalAddress(b)

const userOf = (jid: string): string | undefined => jidDecode(jid)?.user

const isListGroup = (jid: string, isList: boolean): boolean => isList && isGroupJid(jid)

/** Apakah `jid` milik akun sendiri (PN maupun LID)? */
const isOwnUser = (deps: RelayDeps, jid: string): boolean => {
  const user = userOf(jid)
  return user !== undefined && (user === userOf(deps.ownJid) || (deps.ownLid !== undefined && user === userOf(deps.ownLid)))
}

/** Apakah `jid` persis perangkat yang sedang mengirim (PN atau LID)? */
const isExactSender = (deps: RelayDeps, jid: string): boolean =>
  sameDevice(jid, deps.ownJid) || (deps.ownLid !== undefined && sameDevice(jid, deps.ownLid))

const signalJidOf = async (deps: RelayDeps, jid: string): Promise<string> => (await deps.resolveSignalJid?.(jid)) ?? jid

async function ensureSessions(deps: RelayDeps, jids: string[]): Promise<{ ready: string[]; skipped: string[] }> {
  const missing: Array<{ jid: string; signalJid: string }> = []
  const ready: string[] = []
  for (const jid of jids) {
    const signalJid = await signalJidOf(deps, jid)
    if (await deps.crypto.sessions.hasSession(jidToSignalAddress(signalJid))) ready.push(jid)
    else missing.push({ jid, signalJid })
  }
  const skipped: string[] = []
  if (missing.length > 0) {
    // pre-key diminta untuk JID yang dipakai sebagai alamat sesi (LID bila sudah dipetakan)
    const bundles = await (deps.fetchBundles ?? ((j) => fetchPreKeyBundles(deps.engine, j)))(missing.map((m) => m.signalJid))
    for (const { jid, signalJid } of missing) {
      const bundle = bundles[signalJid]
      if (!bundle) {
        skipped.push(jid)
        continue
      }
      await deps.crypto.sessions.injectBundle(jidToSignalAddress(signalJid), bundle)
      ready.push(jid)
    }
  }
  return { ready, skipped }
}

async function encryptFor(
  deps: RelayDeps,
  jid: string,
  content: MessageContent,
  mediaType: string | undefined,
): Promise<{ node: BinaryNode; isPreKey: boolean }> {
  const plaintext = padRandomMax16(deps.codec.encode(content))
  const signalJid = await signalJidOf(deps, jid)
  const { type, ciphertext } = await deps.crypto.sessions.encrypt(jidToSignalAddress(signalJid), plaintext)
  return {
    isPreKey: type === 'pkmsg',
    node: {
      tag: 'to',
      attrs: { jid },
      content: [
        { tag: 'enc', attrs: { v: '2', type, ...(mediaType && { mediatype: mediaType }) }, content: ciphertext },
      ],
    },
  }
}

/** Enkripsi `content` untuk semua device tujuan lalu kirim `<message>` ke server. */
export async function relayMessage(
  deps: RelayDeps,
  jid: string,
  content: MessageContent,
  options: RelayOptions = {},
): Promise<RelayResult> {
  const logger = deps.logger ?? noopLogger
  const id = options.messageId ?? generateMessageId()
  const extra = options.additionalNodes ?? []
  // Dengan pendamping <biz>, WhatsApp Web (dan zapo-js / wa-js) mengirim stanza `type="text"` tanpa
  // `mediatype` pada <enc>; kombinasi type=media + mediatype=list/button ditolak server (479).
  // Pengecualian: list ke grup tetap `type="media"` dengan `mediatype="list"` pada <enc> skmsg.
  const hasBiz = extra.some((n) => n.tag === 'biz')
  const isListMessage = normalizeMessageContent(content)?.listMessage !== undefined
  const groupList = hasBiz && isListGroup(jid, isListMessage)
  const flatten = hasBiz && !groupList
  const mediaType = flatten ? undefined : getMediaType(content)
  const attrs: Record<string, string> = {
    id,
    to: jid,
    type: flatten ? 'text' : groupList ? 'media' : getMessageType(content),
    ...getRelayAttributes(content),
    ...options.attrs,
  }
  const ownUser = jidNormalizedUser(deps.ownJid)
  const recipients: string[] = []
  let skipped: string[] = []
  let needsIdentity = false
  const participantNodes: BinaryNode[] = []
  let groupEnc: BinaryNode | undefined
  let rememberSenders: (() => Promise<void>) | undefined

  if (isGroupJid(jid)) {
    const members = options.participants ?? (await deps.getGroupParticipants?.(jid))
    if (!members?.length) throw new MessageError('Group participants are unknown', { data: { jid } })

    const devices = (await deps.resolveDevices(members)).filter((d) => !isExactSender(deps, d))
    const senderKeyId = `${jid}::${jidToSignalAddress(deps.ownJid)}`
    const memory = { ...(await deps.keys.get('sender-key-memory', [jid]))[jid] }

    const distribution = await deps.crypto.senderKeys.createDistributionMessage(senderKeyId)
    const targets = devices.filter((d) => !memory[d])
    const sessions = await ensureSessions(deps, targets)
    skipped = sessions.skipped

    const distContent: MessageContent = {
      senderKeyDistributionMessage: { groupId: jid, axolotlSenderKeyDistributionMessage: distribution },
    }
    for (const device of sessions.ready) {
      const { node, isPreKey } = await encryptFor(deps, device, distContent, undefined)
      participantNodes.push(node)
      recipients.push(device)
      needsIdentity ||= isPreKey
    }

    const ciphertext = await deps.crypto.senderKeys.encrypt(senderKeyId, padRandomMax16(deps.codec.encode(content)))
    groupEnc = {
      tag: 'enc',
      attrs: { v: '2', type: 'skmsg', ...(mediaType && { mediatype: mediaType }) },
      content: ciphertext,
    }
    rememberSenders = async () => {
      for (const device of sessions.ready) memory[device] = true
      await deps.keys.set({ 'sender-key-memory': { [jid]: memory } })
    }
  } else {
    const peerUser = jidNormalizedUser(jid)
    // chat beralamat LID memakai identitas LID sendiri (seperti Baileys)
    const ownIdentity = isLidUser(jid) && deps.ownLid ? jidNormalizedUser(deps.ownLid) : ownUser
    const devices = [...new Set(await deps.resolveDevices([...new Set([peerUser, ownIdentity])]))].filter(
      (d) => !isExactSender(deps, d),
    )
    const sessions = await ensureSessions(deps, devices)
    skipped = sessions.skipped

    const forOwnDevices: MessageContent = {
      deviceSentMessage: { destinationJid: jid, message: content },
      ...(content.messageContextInfo && { messageContextInfo: content.messageContextInfo }),
    }
    for (const device of sessions.ready) {
      const own = isOwnUser(deps, device)
      const { node, isPreKey } = await encryptFor(deps, device, own ? forOwnDevices : content, mediaType)
      participantNodes.push(node)
      recipients.push(device)
      needsIdentity ||= isPreKey
    }
  }

  if (recipients.length === 0 && !groupEnc) {
    throw new MessageError('No recipient devices could be reached', { data: { jid, skipped } })
  }

  const children: BinaryNode[] = []
  if (participantNodes.length > 0) children.push({ tag: 'participants', attrs: {}, content: participantNodes })
  if (groupEnc) children.push(groupEnc)
  if (needsIdentity) {
    const identity = deps.encodeDeviceIdentity?.()
    if (!identity) logger.warn({ id }, 'pkmsg sent without device identity (encodeDeviceIdentity not provided)')
    else children.push({ tag: 'device-identity', attrs: {}, content: identity })
  }
  const isDirect = !isGroupJid(jid) && options.attrs?.category !== 'peer'
  if (isDirect) {
    const token = await deps.getTcToken?.(jid)
    if (token?.length) children.push({ tag: 'tctoken', attrs: {}, content: token })
  }
  children.push(...extra)

  const node: BinaryNode = { tag: 'message', attrs, content: children }
  await deps.engine.sendNode(node)
  if (isDirect) deps.onDirectSent?.(jid)
  await rememberSenders?.()
  logger.debug({ id, jid, recipients: recipients.length, skipped: skipped.length }, 'message relayed')

  return { id, node, recipients, skipped }
}
