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
import { createProtoMessageCodec } from './protocol/proto-message.js'
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
import { attachSockApi, type SockApi } from './sock-api.js'
import { activeIq, buildPreKeyUpload, INITIAL_PREKEY_COUNT, MIN_PREKEY_COUNT, preKeyCountQuery } from './auth/prekey-upload.js'
import {
  buildClientPayload, buildCompanionFinish, companionPlatformId, configureSuccessfulPairing, encodeDeviceIdentityFromCreds, FALLBACK_WA_VERSION,
} from './auth/pairing-handshake.js'

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
  /** Encode/decode isi pesan. Default: `createProtoMessageCodec()` (skema protobuf `Message`). */
  codec?: MessageCodec
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
  /** Opsional: backend pairing code kustom. Default: stanza `link_code_companion_reg` bawaan. */
  pairingBackend?: PairingBackend
  /** Menangani `pair-success` (verifikasi ADV + penyimpanan identitas); belum disediakan library. */
  onPairSuccess?: (node: BinaryNode, context: PairSuccessContext) => Promise<void> | void
  encodeDeviceIdentity?: () => Uint8Array | undefined
  channelQueryIds?: ChannelQueryIds
  /** `'auto'` memuat sharp/ffmpeg bila tersedia. */
  mediaProcessor?: MediaProcessor | 'auto'
  fetch?: typeof fetch
  saveCredsDebounceMs?: number
  /** Setelah login: unggah pre-key bila server kekurangan dan kirim `passive/active` (default `true`). */
  postLogin?: boolean
  callAutoReject?: CallManagerOptions['autoReject']
  flags?: FeatureFlags | Record<string, boolean>
  keyPairProvider?: KeyPairProvider
}

export interface CorvusClientCore {
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
  /** Minta pairing code. Koneksi dimulai otomatis bila belum aktif. */
  requestPairingCode(phoneNumber: string, customCode?: string): Promise<string>
  sendNode(node: BinaryNode): Promise<void>
  query(node: BinaryNode, timeoutMs?: number): Promise<BinaryNode>
  sendPresenceUpdate(type: PresenceKind, toJid?: string): Promise<void>
  presenceSubscribe(jid: string): Promise<void>
  diagnostics(): Diagnostics
  /** Lepas semua listener/langganan internal (panggil setelah `end()`). */
  dispose(): void
}

/** Klien lengkap: modul (`messages`, `groups`, ...) + alias bergaya Baileys (`sendMessage`, `groupMetadata`, ...). */
export type CorvusClient = CorvusClientCore & SockApi

/**
 * Merakit seluruh library menjadi satu klien. Urutan modul: auth, pairing,
 * reconnect, group-events, call-events, message-receiver, lalu connection
 * (yang menyelesaikan handshake paling akhir).
 */
export function makeSocket(options: MakeSocketOptions): CorvusClient {
  const {
    id, auth: authProvider, codec: codecOption, dictionary, clientPayload, verifyServerCertificate, handshake, transportFactory,
    keepAlive, reconnect: reconnectOptions, store: storeOption, storeOptions, historyDecoder, appStateSync,
    pairingBackend, onPairSuccess, encodeDeviceIdentity, channelQueryIds, mediaProcessor, fetch: fetchImpl,
    saveCredsDebounceMs, callAutoReject, flags: flagsOption, keyPairProvider, postLogin, ...socketConfig
  } = options
  const codec: MessageCodec = codecOption ?? createProtoMessageCodec()

  const flags = flagsOption instanceof FeatureFlags ? flagsOption : new FeatureFlags(flagsOption)
  const socket = new CorvusSocket(socketConfig, id ? { id } : {})
  const logger = socket.logger

  const authOptions: AuthSessionManagerOptions = { logger, ...(saveCredsDebounceMs !== undefined && { saveDebounceMs: saveCredsDebounceMs }), ...(keyPairProvider && { provider: keyPairProvider }) }
  const auth = new AuthSessionManager(authProvider, authOptions)
  const crypto = new CryptoEngine({ keys: auth.keys, getCreds: () => auth.creds })

  // ClientPayload bawaan: login (akun terdaftar) atau registrasi (perangkat baru).
  const defaultClientPayload: NoiseHandshakeOptions['buildClientPayload'] = () =>
    buildClientPayload(auth.creds, {
      version: socket.config.version ?? FALLBACK_WA_VERSION,
      browser: socket.config.browser,
      syncFullHistory: socket.config.syncFullHistory,
    })
  const noise =
    handshake ??
    crypto.createNoiseHandshake({
      buildClientPayload: clientPayload ?? defaultClientPayload,
      ...(verifyServerCertificate && { verifyServerCertificate }),
    })
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
    // wajib agar pesan `pkmsg` diterima server; default: identitas dari hasil pairing
    encodeDeviceIdentity: encodeDeviceIdentity ?? (() => encodeDeviceIdentityFromCreds(auth.creds)),
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
  // Backend pairing code bawaan: stanza `link_code_companion_reg` tahap `companion_hello`
  // (dikirim tanpa menunggu balasan; server menjawab lewat notifikasi, lihat handler di bawah).
  const defaultPairingBackend: PairingBackend = {
    async sendCodeRequest(request) {
      const jid = `${request.phoneNumber}@s.whatsapp.net`
      // JID sementara untuk tahap `companion_finish`.
      socket.ev.emit('creds.update', { me: { id: jid, name: '~' } })
      await sendNode({
        tag: 'iq',
        attrs: { to: S_WHATSAPP_NET, type: 'set', id: engine.generateTag(), xmlns: 'md' },
        content: [
          {
            tag: 'link_code_companion_reg',
            attrs: { jid, stage: 'companion_hello', should_show_push_notification: 'true' },
            content: [
              { tag: 'link_code_pairing_wrapped_companion_ephemeral_pub', attrs: {}, content: request.wrappedEphemeralKey },
              { tag: 'companion_server_auth_key_pub', attrs: {}, content: request.noiseKeyPublic },
              { tag: 'companion_platform_id', attrs: {}, content: companionPlatformId(socket.config.browser) },
              { tag: 'companion_platform_display', attrs: {}, content: request.platformDisplay },
              { tag: 'link_code_pairing_nonce', attrs: {}, content: '0' },
            ],
          },
        ],
      })
    },
  }
  const pairing = new PairingManager({ auth: authProvider.state, backend: pairingBackend ?? defaultPairingBackend })
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
    if (onPairSuccess) {
      await onPairSuccess(node, { pairing, engine, auth, query })
      return
    }
    // Penanganan bawaan: verifikasi ADV, tandatangani identitas perangkat, simpan akun.
    try {
      const { creds, reply } = configureSuccessfulPairing(node, auth.creds)
      await sendNode(reply)
      pairing.handlePaired(creds)
    } catch (error) {
      logger.error({ err: error }, 'pair-success gagal diproses')
      pairing.handleFailure(error instanceof Error ? error : new Error(String(error)))
    }
  })

  // ---- pairing code: HP mengirim notifikasi setelah kode dimasukkan → balas `companion_finish` ----
  engine.on({ tag: 'notification', attrs: { type: 'link_code_companion_reg' }, child: 'link_code_companion_reg' }, async (node) => {
    try {
      const { node: finish, advSecretKey } = await buildCompanionFinish(node, auth.creds)
      socket.ev.emit('creds.update', { advSecretKey })
      await query({ ...finish, attrs: { ...finish.attrs, id: engine.generateTag() } })
      socket.ev.emit('creds.update', { registered: true })
    } catch (error) {
      logger.error({ err: error }, 'companion_finish gagal')
      pairing.handleFailure(error instanceof Error ? error : new Error(String(error)))
    }
  })

  // ---- pasca-login: unggah pre-key + aktifkan sesi ----
  const uploadPreKeys = async (count: number): Promise<void> => {
    const { update, node } = await auth.keys.transaction(() => buildPreKeyUpload(auth.creds, auth.keys, count), auth.creds.me?.id ?? 'upload-pre-keys')
    socket.ev.emit('creds.update', update)
    await query(node)
    logger.info({ count }, 'pre-key terunggah')
  }
  const runPostLogin = async (): Promise<void> => {
    try {
      const have = Number(getChild(await query(preKeyCountQuery()), 'count')?.attrs.value ?? 0)
      const target = have === 0 ? INITIAL_PREKEY_COUNT : MIN_PREKEY_COUNT
      if (have <= target) await uploadPreKeys(target)
      await query(activeIq())
    } catch (error) {
      logger.warn({ err: error }, 'langkah pasca-login gagal')
    }
  }
  // server memberi tahu bila pre-key menipis
  engine.on({ tag: 'notification', attrs: { type: 'encrypt' }, child: 'count' }, async () => {
    try {
      await uploadPreKeys(MIN_PREKEY_COUNT)
    } catch (error) {
      logger.warn({ err: error }, 'unggah pre-key (notifikasi) gagal')
    }
  })
  const offPostLogin = postLogin === false ? undefined : socket.ev.on('connection.update', (update) => {
    if (update.connection === 'open' && auth.creds.registered) void runPostLogin()
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

  const core: CorvusClientCore = {
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
    async requestPairingCode(phone, custom) {
      // Bergaya Baileys: boleh dipanggil langsung setelah makeSocket(); koneksi dimulai otomatis bila belum aktif.
      if (!socket.state.isActive) await socket.connect()
      return pairing.requestPairingCode(phone, custom)
    },
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
      offPostLogin?.()
    },
  }
  return attachSockApi(core)
}
