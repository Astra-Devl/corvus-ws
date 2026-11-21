/**
 * Payload login/registrasi (ClientPayload) dan penyelesaian pairing (`pair-success`).
 *
 * Alurnya mengikuti Utils/validate-connection milik @whiskeysockets/baileys 7.0.0-rc14
 * (MIT, https://github.com/WhiskeySockets/Baileys), ditulis ulang untuk API corvus-ws.
 */
import { createHash, randomBytes } from 'node:crypto'
import { decode, encode } from '../../proto/index.js'
import { aesEncryptGCM, hkdf, hmacSha256 } from '../crypto/encryption.js'
import { sharedKey, sign, toSignalPubKey, verify } from '../crypto/key-utils.js'
import { unwrapEphemeralPublicKey } from '../pairing/code-pairing.js'
import { AuthError, ProtocolError } from '../core/errors.js'
import { getChild, getContentBytes } from '../protocol/binary-node.js'
import type { BinaryNode } from '../protocol/protocol-types.js'
import { S_WHATSAPP_NET } from '../protocol/stanza-builder.js'
import { jidDecode } from '../utils/jid.js'
import type { AuthCreds, CredsUpdate, SignalIdentity } from './credentials.js'

/** Versi WhatsApp Web bawaan bila `version` tidak diberikan (ambil yang terbaru lewat `resolveVersion()`). */
export const FALLBACK_WA_VERSION: readonly [number, number, number] = [2, 3000, 1043857760]

export const WA_ADV_ACCOUNT_SIG_PREFIX = Buffer.from([6, 0])
export const WA_ADV_DEVICE_SIG_PREFIX = Buffer.from([6, 1])
export const WA_ADV_HOSTED_ACCOUNT_SIG_PREFIX = Buffer.from([6, 5])
const KEY_BUNDLE_TYPE = Buffer.from([5])

const PLATFORM_TYPES: Record<string, number> = {
  UNKNOWN: 0, CHROME: 1, FIREFOX: 2, IE: 3, OPERA: 4, SAFARI: 5, EDGE: 6, DESKTOP: 7,
  IPAD: 8, ANDROID_TABLET: 9, OHANA: 10, ALOHA: 11, CATALINA: 12, TCL_TV: 13,
}
const WEB_SUB_PLATFORM = { 'Mac OS': 3, Windows: 4 } as const

export interface PayloadConfig {
  version: readonly [number, number, number]
  /** `[os, browser, versi]`, mis. `['Ubuntu', 'Chrome', '20.0.04']`. */
  browser: readonly [string, string, string]
  countryCode?: string
  syncFullHistory?: boolean
  pushName?: string
}

export const bigEndian = (value: number, bytes = 4): Buffer => {
  const out = Buffer.alloc(bytes)
  let v = value
  for (let i = bytes - 1; i >= 0; i--) {
    out[i] = v & 0xff
    v = Math.floor(v / 256)
  }
  return out
}

function basePayload(config: PayloadConfig) {
  const isAndroid = config.browser[1].toLowerCase().includes('android')
  const sub = WEB_SUB_PLATFORM[config.browser[0] as keyof typeof WEB_SUB_PLATFORM]
  const webSubPlatform = config.syncFullHistory && sub !== undefined && config.browser[1] === 'Desktop' ? sub : 0
  return {
    connectType: 1, // WIFI_UNKNOWN
    connectReason: 1, // USER_ACTIVATED
    userAgent: {
      appVersion: { primary: config.version[0], secondary: config.version[1], tertiary: config.version[2] },
      platform: isAndroid ? 0 : 14, // ANDROID : WEB
      releaseChannel: 0, // RELEASE
      osVersion: '0.1',
      device: 'Desktop',
      osBuildNumber: '0.1',
      localeLanguageIso6391: 'en',
      mnc: '000',
      mcc: '000',
      localeCountryIso31661Alpha2: config.countryCode ?? 'US',
    },
    ...(!isAndroid && { webInfo: { webSubPlatform } }),
    ...(config.pushName && { pushName: config.pushName }),
  }
}

/** Payload untuk akun yang sudah terdaftar (login ulang). */
export function buildLoginPayload(userJid: string, config: PayloadConfig): Uint8Array {
  const decoded = jidDecode(userJid)
  if (!decoded) throw new ProtocolError(`Invalid JID for login payload: ${userJid}`)
  return encode('ClientPayload', {
    ...basePayload(config),
    passive: true,
    pull: true,
    username: Number(decoded.user),
    device: decoded.device ?? 0,
    lidDbMigrated: false,
  })
}

/** Payload untuk perangkat baru (registrasi / pairing). */
export function buildRegistrationPayload(
  creds: Pick<AuthCreds, 'registrationId' | 'signedPreKey' | 'signedIdentityKey'>,
  config: PayloadConfig,
): Uint8Array {
  const platformType = config.browser[1].toLowerCase().includes('android')
    ? PLATFORM_TYPES.ANDROID_TABLET!
    : (PLATFORM_TYPES[config.browser[1].toUpperCase()] ?? PLATFORM_TYPES.CHROME!)
  const deviceProps = encode('DeviceProps', {
    os: config.browser[0],
    platformType,
    requireFullSync: config.syncFullHistory ?? false,
    historySyncConfig: {
      storageQuotaMb: 10240,
      inlineInitialPayloadInE2EeMsg: true,
      supportCallLogHistory: false,
      supportBotUserAgentChatHistory: true,
      supportCagReactionsAndPolls: true,
      supportBizHostedMsg: true,
      supportRecentSyncChunkMessageCountTuning: true,
      supportHostedGroupMsg: true,
      supportFbidBotChatHistory: true,
      supportMessageAssociation: true,
      supportGroupHistory: false,
    },
    version: { primary: 10, secondary: 15, tertiary: 7 },
  })
  return encode('ClientPayload', {
    ...basePayload(config),
    passive: false,
    pull: false,
    devicePairingData: {
      buildHash: createHash('md5').update(config.version.join('.')).digest(),
      deviceProps,
      eRegid: bigEndian(creds.registrationId),
      eKeytype: KEY_BUNDLE_TYPE,
      eIdent: creds.signedIdentityKey.public,
      eSkeyId: bigEndian(creds.signedPreKey.keyId, 3),
      eSkeyVal: creds.signedPreKey.keyPair.public,
      eSkeySig: creds.signedPreKey.signature,
    },
  })
}

/** Pilih payload login atau registrasi berdasarkan status kredensial. */
export function buildClientPayload(creds: AuthCreds, config: PayloadConfig): Uint8Array {
  return creds.me?.id ? buildLoginPayload(creds.me.id, config) : buildRegistrationPayload(creds, config)
}

export interface PairSuccessResult {
  creds: CredsUpdate
  reply: BinaryNode
}

/**
 * Verifikasi `pair-success` (HMAC ADV + tanda tangan akun), tandatangani identitas
 * perangkat, dan susun balasan `pair-device-sign` + pembaruan kredensial.
 */
export function configureSuccessfulPairing(stanza: BinaryNode, creds: AuthCreds): PairSuccessResult {
  const pairSuccess = getChild(stanza, 'pair-success')
  const deviceIdentityNode = pairSuccess && getChild(pairSuccess, 'device-identity')
  const deviceNode = pairSuccess && getChild(pairSuccess, 'device')
  const platformNode = pairSuccess && getChild(pairSuccess, 'platform')
  const bizNode = pairSuccess && getChild(pairSuccess, 'biz')
  const identityBytes = deviceIdentityNode && getContentBytes(deviceIdentityNode)
  if (!pairSuccess || !deviceIdentityNode || !deviceNode || !identityBytes) {
    throw new AuthError('pair-success tidak memuat device-identity / device')
  }

  const jid = deviceNode.attrs.jid
  const lid = deviceNode.attrs.lid
  if (!jid) throw new AuthError('pair-success tidak memuat JID perangkat')

  const hmacBox = decode('ADVSignedDeviceIdentityHMAC', identityBytes)
  const details = hmacBox.details
  if (!details || !hmacBox.hmac) throw new AuthError('device-identity tidak lengkap')

  const hmacPrefix = hmacBox.accountType === 1 ? WA_ADV_HOSTED_ACCOUNT_SIG_PREFIX : Buffer.alloc(0)
  const expected = hmacSha256(Buffer.from(creds.advSecretKey, 'base64'), hmacPrefix, details)
  if (!expected.equals(Buffer.from(hmacBox.hmac))) throw new AuthError('Tanda tangan HMAC akun tidak valid')

  const account = decode('ADVSignedDeviceIdentity', details)
  const { accountSignatureKey, accountSignature, details: deviceDetails } = account
  if (!accountSignatureKey || !accountSignature || !deviceDetails) throw new AuthError('ADVSignedDeviceIdentity tidak lengkap')
  const deviceIdentity = decode('ADVDeviceIdentity', deviceDetails)

  const accountPrefix = deviceIdentity.deviceType === 1 ? WA_ADV_HOSTED_ACCOUNT_SIG_PREFIX : WA_ADV_ACCOUNT_SIG_PREFIX
  const accountMsg = Buffer.concat([accountPrefix, deviceDetails, creds.signedIdentityKey.public])
  if (!verify(accountSignatureKey, accountMsg, accountSignature)) throw new AuthError('Gagal memverifikasi tanda tangan akun')

  const deviceMsg = Buffer.concat([WA_ADV_DEVICE_SIG_PREFIX, deviceDetails, creds.signedIdentityKey.public, accountSignatureKey])
  const signed = { ...account, deviceSignature: sign(creds.signedIdentityKey.private, deviceMsg) }
  // balasan tidak menyertakan accountSignatureKey
  const { accountSignatureKey: _omit, ...forServer } = signed
  void _omit
  const accountEnc = encode('ADVSignedDeviceIdentity', forServer)

  const identity: SignalIdentity = {
    identifier: { name: lid ?? jid, deviceId: 0 },
    identifierKey: toSignalPubKey(accountSignatureKey),
  }

  return {
    reply: {
      tag: 'iq',
      attrs: { to: S_WHATSAPP_NET, type: 'result', ...(stanza.attrs.id && { id: stanza.attrs.id }) },
      content: [
        {
          tag: 'pair-device-sign',
          attrs: {},
          content: [{ tag: 'device-identity', attrs: { 'key-index': String(deviceIdentity.keyIndex ?? 0) }, content: accountEnc }],
        },
      ],
    },
    creds: {
      account: signed as unknown as Record<string, unknown>,
      me: { id: jid, ...(lid && { lid }), ...(bizNode?.attrs.name && { name: bizNode.attrs.name }) },
      signalIdentities: [...(creds.signalIdentities ?? []), identity],
      ...(platformNode?.attrs.name && { platform: platformNode.attrs.name }),
    },
  }
}

// ---- pairing code: tahap `companion_finish` ----------------------------------------------

const COMPANION_WEB_CLIENT: Record<string, number> = { Chrome: 1, Edge: 2, Firefox: 3, IE: 4, Opera: 5, Safari: 6 }

/** Nilai `companion_platform_id` untuk pairing code (CompanionWebClientType). */
export function companionPlatformId(browser: readonly [string, string, string]): string {
  const [os, name] = browser
  if (name === 'Desktop') return os === 'Windows' ? '8' : '7' // UWP : ELECTRON
  return String(COMPANION_WEB_CLIENT[name] ?? 9) // 9 = OTHER_WEB_CLIENT
}

export interface CompanionFinishResult {
  /** Stanza `companion_finish` yang dikirim ke server. */
  node: BinaryNode
  /** `advSecretKey` baru yang diturunkan dari pertukaran kunci (base64); simpan ke kredensial. */
  advSecretKey: string
}

/**
 * Tanggapi notifikasi `link_code_companion_reg` dari HP: buka kunci ephemeral primer
 * dengan pairing code, turunkan `advSecretKey`, dan susun stanza `companion_finish`.
 */
export async function buildCompanionFinish(notification: BinaryNode, creds: AuthCreds): Promise<CompanionFinishResult> {
  const reg = getChild(notification, 'link_code_companion_reg')
  const bytes = (tag: string): Buffer => {
    const child = reg && getChild(reg, tag)
    const content = child && getContentBytes(child)
    if (!content) throw new AuthError(`link_code_companion_reg tidak memuat ${tag}`)
    return Buffer.from(content)
  }
  if (!creds.pairingCode) throw new AuthError('Tidak ada pairing code aktif')
  if (!creds.me?.id) throw new AuthError('JID perangkat belum diketahui untuk companion_finish')

  const ref = bytes('link_code_pairing_ref')
  const primaryIdentityPub = bytes('primary_identity_pub')
  const wrappedPrimaryEphemeral = bytes('link_code_pairing_wrapped_primary_ephemeral_pub')

  const primaryEphemeralPub = await unwrapEphemeralPublicKey(wrappedPrimaryEphemeral, creds.pairingCode)
  const companionShared = sharedKey(creds.pairingEphemeralKeyPair.private, primaryEphemeralPub)
  const random = randomBytes(32)
  const salt = randomBytes(32)
  const expanded = hkdf(companionShared, 32, { salt, info: 'link_code_pairing_key_bundle_encryption_key' })
  const plaintext = Buffer.concat([Buffer.from(creds.signedIdentityKey.public), primaryIdentityPub, random])
  const iv = randomBytes(12)
  const encrypted = aesEncryptGCM(plaintext, expanded, iv, Buffer.alloc(0))
  const bundle = Buffer.concat([salt, iv, encrypted])

  const identityShared = sharedKey(creds.signedIdentityKey.private, primaryIdentityPub)
  const advSecretKey = hkdf(Buffer.concat([companionShared, identityShared, random]), 32, { info: 'adv_secret' }).toString('base64')

  return {
    advSecretKey,
    node: {
      tag: 'iq',
      attrs: { to: S_WHATSAPP_NET, type: 'set', xmlns: 'md' },
      content: [
        {
          tag: 'link_code_companion_reg',
          attrs: { jid: creds.me.id, stage: 'companion_finish' },
          content: [
            { tag: 'link_code_pairing_wrapped_key_bundle', attrs: {}, content: bundle },
            { tag: 'companion_identity_public', attrs: {}, content: creds.signedIdentityKey.public },
            { tag: 'link_code_pairing_ref', attrs: {}, content: ref },
          ],
        },
      ],
    },
  }
}
