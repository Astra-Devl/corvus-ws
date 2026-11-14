import type { AuthSessionManagerOptions } from './auth/session-manager.js'
import { AuthSessionManager } from './auth/session-manager.js'
import type { AuthStateProvider } from './auth/auth-state.js'
import type { KeyPairProvider } from './auth/auth-utils.js'
import { BusinessManager } from './business/business-profile.js'
import { CallEventsModule } from './calls/call-events.js'
import { CallManager, type CallManagerOptions } from './calls/call-manager.js'
import { ChannelManager } from './channels/channel-manager.js'
import type { ChannelQueryIds } from './channels/channel-types.js'
import { ChatManager } from './chats/chat-manager.js'
import type { AppStateSync } from './chats/chat-modify.js'
import { CommunityManager } from './communities/community-manager.js'
import { ConnectionModule, type ConnectionHandshake } from './connection/connection.js'
import { createDisconnectError } from './connection/disconnect.js'
import { ReconnectManager, type ReconnectOptions } from './connection/reconnect.js'
import { ContactManager } from './contacts/contact-manager.js'
import { DisconnectReason, MessageError, ValidationError } from './core/errors.js'
import type { TypedEventEmitter } from './core/event-emitter.js'
import { CorvusSocket } from './core/socket.js'
import type { ResolvedSocketConfig, SocketConfig } from './core/socket-config.js'
import type { SocketState } from './core/socket-state.js'
import { CryptoEngine, type NoiseHandshakeOptions } from './crypto/crypto-engine.js'
import { GroupEventsModule } from './groups/group-events.js'
import { GroupManager } from './groups/group-manager.js'
import { HistoryManager } from './history/history-manager.js'
import type { HistoryDecoder } from './history/history-sync.js'
import { collectDiagnostics, type Diagnostics } from './internal/diagnostics.js'
import { FeatureFlags } from './internal/feature-flags.js'
import { MediaManager } from './media/media-manager.js'
import { createLazyProcessor, type MediaProcessor } from './media/media-processor.js'
import { MessageReceiver, type PresenceKind } from './messages/message-receiver.js'
import type { MessageCodec } from './messages/message-parser.js'
import type { RelayDeps } from './messages/relay-message.js'
import { MessageSender } from './messages/send-message.js'
import { PairingManager, type PairingBackend } from './pairing/pairing-manager.js'
import { PrivacyManager } from './privacy/privacy-settings.js'
import { getChild, getChildren, getContentString } from './protocol/binary-node.js'
import type { ProtocolEngine } from './protocol/protocol-engine.js'
import type { BinaryNode } from './protocol/protocol-types.js'
import { S_WHATSAPP_NET } from './protocol/stanza-builder.js'
import type { TokenDictionary } from './protocol/token-dictionary.js'
import { InMemoryStore, type InMemoryStoreOptions } from './store/in-memory-store.js'
import type { TransportFactory } from './transport/interface.js'
import type { CorvusEvents } from './types/events.js'

export interface PairSuccessContext {
  pairing: PairingManager
  engine: ProtocolEngine
  auth: AuthSessionManager
  query: (node: BinaryNode, timeoutMs?: number) => Promise<BinaryNode>
}

export interface MakeSocketOptions extends SocketConfig {
  id?: string
  /** Penyimpanan kredensial (`createMultiFileAuthState`, `createMemoryAuthState`, dst.). */
  auth: AuthStateProvider
  /** Encode/decode isi pesan (WAProto `Message`). */
  codec: MessageCodec
  /** Tabel token protokol; tanpa ini string dikirim apa adanya dan frame server tidak bisa dibaca. */
  dictionary?: TokenDictionary
  /** ClientPayload (login/registrasi) ter-encode; mengaktifkan handshake Noise bawaan. */
  clientPayload?: NoiseHandshakeOptions['buildClientPayload']
  verifyServerCertificate?: NoiseHandshakeOptions['verifyServerCertificate']
  /** Handshake kustom (menggantikan Noise bawaan). */
  handshake?: ConnectionHandshake
  transportFactory?: TransportFactory
  keepAlive?: boolean
  /** `false` menonaktifkan reconnect otomatis. */
  reconnect?: ReconnectOptions | false
  /** `false` menonaktifkan store; atau berikan instance sendiri. */
  store?: InMemoryStore | false
  storeOptions?: InMemoryStoreOptions
  historyDecoder?: HistoryDecoder
  appStateSync?: AppStateSync
  pairingBackend?: PairingBackend
  /** Menangani `pair-success` (verifikasi ADV + penyimpanan identitas); belum disediakan library. */
  onPairSuccess?: (node: BinaryNode, context: PairSuccessContext) => Promise<void> | void
  encodeDeviceIdentity?: () => Uint8Array | undefined
  channelQueryIds?: ChannelQueryIds
  /** `'auto'` memuat sharp/ffmpeg bila tersedia. */
  mediaProcessor?: MediaProcessor | 'auto'
  fetch?: typeof fetch
  saveCredsDebounceMs?: number
  callAutoReject?: CallManagerOptions['autoReject']
  flags?: FeatureFlags | Record<string, boolean>
  keyPairProvider?: KeyPairProvider
}

export interface CorvusClient {
  readonly id: string
  readonly socket: CorvusSocket
  readonly ev: TypedEventEmitter<CorvusEvents>
  readonly config: ResolvedSocketConfig
  readonly state: SocketState
  readonly auth: AuthSessionManager
  readonly store: InMemoryStore | undefined
  readonly engine: ProtocolEngine
  readonly crypto: CryptoEngine
  readonly pairing: PairingManager
  readonly reconnect: ReconnectManager | undefined
  readonly messages: MessageSender
  readonly media: MediaManager
  readonly contacts: ContactManager
  readonly groups: GroupManager
  readonly communities: CommunityManager
  readonly channels: ChannelManager
  readonly chats: ChatManager
  readonly calls: CallManager
  readonly business: BusinessManager
  readonly privacy: PrivacyManager
  readonly history: HistoryManager | undefined
  readonly flags: FeatureFlags

  /** Mulai koneksi (setup semua modul). Gunakan `waitForOpen()` untuk menunggu login selesai. */
  connect(): Promise<void>
  waitForOpen(timeoutMs?: number): Promise<void>
  end(error?: Error): Promise<void>
  /** Keluarkan perangkat ini dari akun dan hapus kredensial lokal. */
  logout(): Promise<void>
  requestPairingCode(phoneNumber: string, customCode?: string): Promise<string>
  sendNode(node: BinaryNode): Promise<void>
  query(node: BinaryNode, timeoutMs?: number): Promise<BinaryNode>
  sendPresenceUpdate(type: PresenceKind, toJid?: string): Promise<void>
  presenceSubscribe(jid: string): Promise<void>
  diagnostics(): Diagnostics
  /** Lepas semua listener/langganan internal (panggil setelah `end()`). */
  dispose(): void
}

/**
 * Merakit seluruh library menjadi satu klien. Urutan modul: auth, pairing,
 * reconnect, group-events, call-events, message-receiver, lalu connection
 * (yang menyelesaikan handshake paling akhir).
 */
export function makeSocket(options: MakeSocketOptions): CorvusClient {
  const {
    id, auth: authProvider, codec, dictionary, clientPayload, verifyServerCertificate, handshake, transportFactory,
    keepAlive, reconnect: reconnectOptions, store: storeOption, storeOptions, historyDecoder, appStateSync,
    pairingBackend, onPairSuccess, encodeDeviceIdentity, channelQueryIds, mediaProcessor, fetch: fetchImpl,
    saveCredsDebounceMs, callAutoReject, flags: flagsOption, keyPairProvider, ...socketConfig
  } = options

  const flags = flagsOption instanceof FeatureFlags ? flagsOption : new FeatureFlags(flagsOption)
  const socket = new CorvusSocket(socketConfig, id ? { id } : {})
  const logger = socket.logger

  const authOptions: AuthSessionManagerOptions = { logger, ...(saveCredsDebounceMs !== undefined && { saveDebounceMs: saveCredsDebounceMs }), ...(keyPairProvider && { provider: keyPairProvider }) }
  const auth = new AuthSessionManager(authProvider, authOptions)
  const crypto = new CryptoEngine({ keys: auth.keys, getCreds: () => auth.creds })

  const noise =
    handshake ??
    (clientPayload
      ? crypto.createNoiseHandshake({ buildClientPayload: clientPayload, ...(verifyServerCertificate && { verifyServerCertificate }) })
      : undefined)
  const connection = new ConnectionModule({
    ...(noise && { handshake: noise }),
    ...(dictionary && { dictionary }),
    ...(transportFactory && { transportFactory }),
    ...(keepAlive !== undefined && { keepAlive }),
    logger,
  })
  const engine = connection.engine

  const getOwnJid = (): string | undefined => auth.creds.me?.id
  const requireOwnJid = (): string => {
    const jid = getOwnJid()
    if (!jid) throw new MessageError('Not logged in: the account JID is not known yet', { code: 'ERR_NOT_LOGGED_IN' })
    return jid
  }
  const query = (node: BinaryNode, timeoutMs?: number): Promise<BinaryNode> =>
    engine.query(node, timeoutMs ?? socket.config.defaultQueryTimeoutMs)
  const sendNode = (node: BinaryNode): Promise<void> => engine.sendNode(node)

  // ---- store ----
  const store = storeOption === false ? undefined : (storeOption ?? new InMemoryStore(storeOptions))
  const unbindStore = store?.bind(socket.ev)

  // ---- manajer ----
  const contacts = new ContactManager({ query, generateTag: engine.generateTag, ev: socket.ev, logger })
  const groups = new GroupManager({ query, ev: socket.ev })
  const communities = new CommunityManager({ query, groups, ev: socket.ev })
  const channels = new ChannelManager({ query, sendNode, generateTag: engine.generateTag, codec, ...(channelQueryIds && { queryIds: channelQueryIds }) })
  const business = new BusinessManager({ query })
  const privacy = new PrivacyManager({ query })
  const calls = new CallManager({
    query,
    get ownJid() {
      return requireOwnJid()
    },
    ...(callAutoReject !== undefined && { autoReject: callAutoReject }),
  })

  const processor = mediaProcessor === 'auto' ? createLazyProcessor() : mediaProcessor
  const media = new MediaManager({ query, ...(fetchImpl && { fetch: fetchImpl }), ...(processor && { processor }), logger })

  const relayDeps: RelayDeps = {
    crypto,
    keys: auth.keys,
    codec,
    engine,
    get ownJid() {
      return requireOwnJid()
    },
    resolveDevices: (jids) => contacts.getDevices(jids),
    getGroupParticipants: (jid) => groups.getParticipants(jid),
    ...(encodeDeviceIdentity && { encodeDeviceIdentity }),
    logger,
  }
  const messages = new MessageSender({
    deps: relayDeps,
    ev: socket.ev,
    ...(store && { loadMessage: (key) => store.loadMessage(key) }),
    emitOwnEvents: socket.config.emitOwnEvents,
  })

  const chats = new ChatManager({
    ...(appStateSync && { sync: appStateSync }),
    ev: socket.ev,
    ...(store && {
      lastMessages: (jid: string, limit: number) => store.messages.list(jid, { limit }),
      unreadCount: (jid: string) => store.chats.get(jid)?.unreadCount ?? 0,
    }),
    readMessages: (keys) => messages.readMessages(keys),
  })

  const history = historyDecoder
    ? new HistoryManager({
        decode: historyDecoder,
        ev: socket.ev,
        sendNode,
        logger,
        ...(fetchImpl && { download: { fetch: fetchImpl } }),
        isProcessed: (key) => auth.creds.processedHistoryMessages.some((m) => m.key.id === key),
        markProcessed: (key) =>
          auth.update({ processedHistoryMessages: [...auth.creds.processedHistoryMessages, { key: { id: key } }].slice(-500) }),
      })
    : undefined
  const detachHistory = history?.attach(socket.ev)

  // ---- modul socket ----
  const pairing = new PairingManager({ auth: authProvider.state, ...(pairingBackend && { backend: pairingBackend }) })
  const reconnect = reconnectOptions === false ? undefined : new ReconnectManager(reconnectOptions ?? {})
  const groupEvents = new GroupEventsModule({ engine, onChange: (jid) => groups.invalidate(jid), logger })
  const callEvents = new CallEventsModule({ engine, onCall: (call) => calls.handle(call), logger })
  const receiver = new MessageReceiver({
    engine,
    crypto,
    codec,
    getOwnJid,
    sendReceipts: flags.isEnabled('receive.sendReceipts'),
    nackOnDecryptError: flags.isEnabled('receive.nackOnDecryptError'),
    onDevicesChanged: (user) => contacts.invalidateDevices(user),
    logger,
  })
  for (const mod of [auth, pairing, reconnect, groupEvents, callEvents, receiver, connection]) if (mod) socket.use(mod)

  // ---- pairing via QR: server mengirim daftar `ref` ----
  engine.on({ tag: 'iq', child: 'pair-device' }, async (node) => {
    const refs = getChildren(getChild(node, 'pair-device')!, 'ref')
      .map((r) => getContentString(r))
      .filter((r): r is string => !!r)
    await sendNode({ tag: 'iq', attrs: { to: S_WHATSAPP_NET, type: 'result', ...(node.attrs.id && { id: node.attrs.id }) } })
    pairing.startQr(refs)
  })
  engine.on({ tag: 'iq', child: 'pair-success' }, async (node) => {
    if (!onPairSuccess) {
      logger.warn('pair-success received but no onPairSuccess handler is configured')
      return
    }
    await onPairSuccess(node, { pairing, engine, auth, query })
  })

  // ---- presence ----
  const sendPresenceUpdate = async (type: PresenceKind, toJid?: string): Promise<void> => {
    if (type === 'available' || type === 'unavailable') {
      const name = auth.creds.me?.name
      if (!name) return
      await sendNode({ tag: 'presence', attrs: { name: name.replaceAll('@', '\u200E@'), type } })
      return
    }
    if (!toJid) throw new ValidationError('toJid is required for chat states')
    await sendNode({
      tag: 'chatstate',
      attrs: { from: requireOwnJid(), to: toJid },
      content: [{ tag: type === 'recording' ? 'composing' : type, attrs: type === 'recording' ? { media: 'audio' } : {} }],
    })
  }
  const offOpen = socket.ev.on('connection.update', (update) => {
    if (update.connection === 'open' && socket.config.markOnlineOnConnect) {
      sendPresenceUpdate('available').catch((error: unknown) => logger.warn({ err: error }, 'failed to send presence'))
    }
  })

  const client: CorvusClient = {
    id: socket.id,
    socket,
    ev: socket.ev as unknown as TypedEventEmitter<CorvusEvents>,
    config: socket.config,
    state: socket.state,
    auth, store, engine, crypto, pairing, reconnect, messages, media, contacts, groups, communities, channels, chats, calls,
    business, privacy, history, flags,

    connect: () => socket.connect(),
    waitForOpen: (timeoutMs) => socket.waitForOpen(timeoutMs),
    end: (error) => socket.end(error),
    async logout() {
      const me = getOwnJid()
      reconnect?.stop()
      try {
        if (me && socket.state.status === 'open') {
          await query({
            tag: 'iq',
            attrs: { to: S_WHATSAPP_NET, type: 'set', id: engine.generateTag(), xmlns: 'md' },
            content: [{ tag: 'remove-companion-device', attrs: { jid: me, reason: 'user_initiated' } }],
          })
        }
      } catch (error) {
        logger.warn({ err: error }, 'server did not confirm logout')
      }
      await socket.end(createDisconnectError(DisconnectReason.loggedOut, 'Intentional logout'))
      await auth.reset()
    },
    requestPairingCode: (phone, custom) => pairing.requestPairingCode(phone, custom),
    sendNode,
    query,
    sendPresenceUpdate,
    presenceSubscribe: (jid) => sendNode({ tag: 'presence', attrs: { to: jid, type: 'subscribe' } }),
    diagnostics: () =>
      collectDiagnostics({ id: socket.id, state: socket.state, config: socket.config, modules: socket.modules, ev: socket.ev, store, pendingQueries: () => engine.pendingCount }),
    dispose() {
      reconnect?.dispose()
      groupEvents.dispose()
      callEvents.dispose()
      receiver.dispose()
      detachHistory?.()
      unbindStore?.()
      offOpen()
    },
  }
  return client
}
