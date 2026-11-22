// File ini dibuat otomatis oleh scripts/generate-proto.cjs dari proto/schemas/wa.proto.
// JANGAN DIEDIT — ubah file .proto lalu jalankan `npm run proto:generate`.
/* eslint-disable */
import type { FileDescriptor } from '../loader/proto-registry.js'

export const ADVEncryptionType = {
  E2EE: 0,
  HOSTED: 1,
} as const
export type ADVEncryptionType = (typeof ADVEncryptionType)[keyof typeof ADVEncryptionType]

export const ClientPayload_Product = {
  WHATSAPP: 0,
  MESSENGER: 1,
} as const
export type ClientPayload_Product = (typeof ClientPayload_Product)[keyof typeof ClientPayload_Product]

export const ClientPayload_ConnectType = {
  CELLULAR_UNKNOWN: 0,
  WIFI_UNKNOWN: 1,
  CELLULAR_EDGE: 100,
  CELLULAR_IDEN: 101,
  CELLULAR_UMTS: 102,
  CELLULAR_EVDO: 103,
  CELLULAR_GPRS: 104,
  CELLULAR_HSDPA: 105,
  CELLULAR_HSUPA: 106,
  CELLULAR_HSPA: 107,
  CELLULAR_CDMA: 108,
  CELLULAR_1XRTT: 109,
  CELLULAR_EHRPD: 110,
  CELLULAR_LTE: 111,
  CELLULAR_HSPAP: 112,
} as const
export type ClientPayload_ConnectType = (typeof ClientPayload_ConnectType)[keyof typeof ClientPayload_ConnectType]

export const ClientPayload_ConnectReason = {
  PUSH: 0,
  USER_ACTIVATED: 1,
  SCHEDULED: 2,
  ERROR_RECONNECT: 3,
  NETWORK_SWITCH: 4,
  PING_RECONNECT: 5,
  UNKNOWN: 6,
} as const
export type ClientPayload_ConnectReason = (typeof ClientPayload_ConnectReason)[keyof typeof ClientPayload_ConnectReason]

export const ClientPayload_UserAgent_Platform = {
  ANDROID: 0,
  IOS: 1,
  WINDOWS_PHONE: 2,
  BLACKBERRY: 3,
  BLACKBERRYX: 4,
  S40: 5,
  S60: 6,
  PYTHON_CLIENT: 7,
  TIZEN: 8,
  ENTERPRISE: 9,
  SMB_ANDROID: 10,
  KAIOS: 11,
  SMB_IOS: 12,
  WINDOWS: 13,
  WEB: 14,
  PORTAL: 15,
  GREEN_ANDROID: 16,
  GREEN_IPHONE: 17,
  BLUE_ANDROID: 18,
  BLUE_IPHONE: 19,
  FBLITE_ANDROID: 20,
  MLITE_ANDROID: 21,
  IGLITE_ANDROID: 22,
  PAGE: 23,
  MACOS: 24,
} as const
export type ClientPayload_UserAgent_Platform = (typeof ClientPayload_UserAgent_Platform)[keyof typeof ClientPayload_UserAgent_Platform]

export const ClientPayload_UserAgent_ReleaseChannel = {
  RELEASE: 0,
  BETA: 1,
  ALPHA: 2,
  DEBUG: 3,
} as const
export type ClientPayload_UserAgent_ReleaseChannel = (typeof ClientPayload_UserAgent_ReleaseChannel)[keyof typeof ClientPayload_UserAgent_ReleaseChannel]

export const ClientPayload_WebInfo_WebSubPlatform = {
  WEB_BROWSER: 0,
  APP_STORE: 1,
  WIN_STORE: 2,
  DARWIN: 3,
  WIN32: 4,
} as const
export type ClientPayload_WebInfo_WebSubPlatform = (typeof ClientPayload_WebInfo_WebSubPlatform)[keyof typeof ClientPayload_WebInfo_WebSubPlatform]

export const DeviceProps_PlatformType = {
  UNKNOWN: 0,
  CHROME: 1,
  FIREFOX: 2,
  IE: 3,
  OPERA: 4,
  SAFARI: 5,
  EDGE: 6,
  DESKTOP: 7,
  IPAD: 8,
  ANDROID_TABLET: 9,
  OHANA: 10,
  ALOHA: 11,
  CATALINA: 12,
  TCL_TV: 13,
} as const
export type DeviceProps_PlatformType = (typeof DeviceProps_PlatformType)[keyof typeof DeviceProps_PlatformType]

export interface HandshakeMessage {
  clientHello?: HandshakeMessage_ClientHello | null
  serverHello?: HandshakeMessage_ServerHello | null
  clientFinish?: HandshakeMessage_ClientFinish | null
}

export interface HandshakeMessage_ClientHello {
  ephemeral?: Uint8Array | null
  static?: Uint8Array | null
  payload?: Uint8Array | null
}

export interface HandshakeMessage_ServerHello {
  ephemeral?: Uint8Array | null
  static?: Uint8Array | null
  payload?: Uint8Array | null
}

export interface HandshakeMessage_ClientFinish {
  static?: Uint8Array | null
  payload?: Uint8Array | null
}

export interface CertChain {
  leaf?: CertChain_NoiseCertificate | null
  intermediate?: CertChain_NoiseCertificate | null
}

export interface CertChain_NoiseCertificate {
  details?: Uint8Array | null
  signature?: Uint8Array | null
}

export interface CertChain_NoiseCertificate_Details {
  serial?: number | null
  issuerSerial?: number | null
  key?: Uint8Array | null
  notBefore?: number | bigint | null
  notAfter?: number | bigint | null
}

export interface ADVSignedDeviceIdentity {
  details?: Uint8Array | null
  accountSignatureKey?: Uint8Array | null
  accountSignature?: Uint8Array | null
  deviceSignature?: Uint8Array | null
}

export interface ADVSignedDeviceIdentityHMAC {
  details?: Uint8Array | null
  hmac?: Uint8Array | null
  accountType?: number | null
}

export interface ADVDeviceIdentity {
  rawId?: number | null
  timestamp?: number | bigint | null
  keyIndex?: number | null
  accountType?: number | null
  deviceType?: number | null
}

export interface ADVKeyIndexList {
  rawId?: number | null
  timestamp?: number | bigint | null
  currentIndex?: number | null
  validIndexes?: Array<number> | null
  accountType?: number | null
}

export interface ADVSignedKeyIndexList {
  details?: Uint8Array | null
  accountSignature?: Uint8Array | null
  accountSignatureKey?: Uint8Array | null
}

export interface AppVersion {
  primary?: number | null
  secondary?: number | null
  tertiary?: number | null
  quaternary?: number | null
  quinary?: number | null
}

export interface ClientPayload {
  username?: number | bigint | null
  passive?: boolean | null
  userAgent?: ClientPayload_UserAgent | null
  webInfo?: ClientPayload_WebInfo | null
  pushName?: string | null
  sessionId?: number | null
  shortConnect?: boolean | null
  connectType?: number | null
  connectReason?: number | null
  shards?: Array<number> | null
  connectAttemptCount?: number | null
  device?: number | null
  devicePairingData?: ClientPayload_DevicePairingRegistrationData | null
  product?: number | null
  fbCat?: Uint8Array | null
  fbUserAgent?: Uint8Array | null
  oc?: boolean | null
  lc?: number | null
  pull?: boolean | null
  paddingBytes?: Uint8Array | null
  yearClass?: number | null
  memClass?: number | null
  lidDbMigrated?: boolean | null
}

export interface ClientPayload_UserAgent {
  platform?: number | null
  appVersion?: AppVersion | null
  mcc?: string | null
  mnc?: string | null
  osVersion?: string | null
  manufacturer?: string | null
  device?: string | null
  osBuildNumber?: string | null
  phoneId?: string | null
  releaseChannel?: number | null
  localeLanguageIso6391?: string | null
  localeCountryIso31661Alpha2?: string | null
  deviceBoard?: string | null
}

export interface ClientPayload_WebInfo {
  refToken?: string | null
  version?: string | null
  webSubPlatform?: number | null
}

export interface ClientPayload_DevicePairingRegistrationData {
  eRegid?: Uint8Array | null
  eKeytype?: Uint8Array | null
  eIdent?: Uint8Array | null
  eSkeyId?: Uint8Array | null
  eSkeyVal?: Uint8Array | null
  eSkeySig?: Uint8Array | null
  buildHash?: Uint8Array | null
  deviceProps?: Uint8Array | null
}

export interface DeviceProps {
  os?: string | null
  version?: AppVersion | null
  platformType?: number | null
  requireFullSync?: boolean | null
  historySyncConfig?: DeviceProps_HistorySyncConfig | null
}

export interface DeviceProps_HistorySyncConfig {
  fullSyncDaysLimit?: number | null
  fullSyncSizeMbLimit?: number | null
  storageQuotaMb?: number | null
  inlineInitialPayloadInE2EeMsg?: boolean | null
  recentSyncDaysLimit?: number | null
  supportCallLogHistory?: boolean | null
  supportBotUserAgentChatHistory?: boolean | null
  supportCagReactionsAndPolls?: boolean | null
  supportBizHostedMsg?: boolean | null
  supportRecentSyncChunkMessageCountTuning?: boolean | null
  supportHostedGroupMsg?: boolean | null
  supportFbidBotChatHistory?: boolean | null
  supportAddOnHistorySyncMigration?: boolean | null
  supportMessageAssociation?: boolean | null
  supportGroupHistory?: boolean | null
  onDemandReady?: boolean | null
  supportGuestChat?: boolean | null
  completeOnDemandReady?: boolean | null
  thumbnailSyncDaysLimit?: number | null
}

export interface SignalMessage {
  ratchetKey?: Uint8Array | null
  counter?: number | null
  previousCounter?: number | null
  ciphertext?: Uint8Array | null
}

export interface PreKeySignalMessage {
  registrationId?: number | null
  preKeyId?: number | null
  signedPreKeyId?: number | null
  baseKey?: Uint8Array | null
  identityKey?: Uint8Array | null
  message?: Uint8Array | null
}

export interface SenderKeyMessage {
  id?: number | null
  iteration?: number | null
  ciphertext?: Uint8Array | null
}

export interface SignalSenderKeyDistributionMessage {
  id?: number | null
  iteration?: number | null
  chainKey?: Uint8Array | null
  signingKey?: Uint8Array | null
}

export const waDescriptor: FileDescriptor = {
  "name": "wa.proto",
  "package": "corvus",
  "syntax": "proto2",
  "imports": [],
  "messages": [
    {
      "fullName": "corvus.HandshakeMessage",
      "name": "HandshakeMessage",
      "fields": [
        {
          "name": "clientHello",
          "number": 2,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.HandshakeMessage.ClientHello"
        },
        {
          "name": "serverHello",
          "number": 3,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.HandshakeMessage.ServerHello"
        },
        {
          "name": "clientFinish",
          "number": 4,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.HandshakeMessage.ClientFinish"
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.HandshakeMessage.ClientHello",
      "name": "ClientHello",
      "fields": [
        {
          "name": "ephemeral",
          "number": 1,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "static",
          "number": 2,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "payload",
          "number": 3,
          "type": "bytes",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.HandshakeMessage.ServerHello",
      "name": "ServerHello",
      "fields": [
        {
          "name": "ephemeral",
          "number": 1,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "static",
          "number": 2,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "payload",
          "number": 3,
          "type": "bytes",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.HandshakeMessage.ClientFinish",
      "name": "ClientFinish",
      "fields": [
        {
          "name": "static",
          "number": 1,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "payload",
          "number": 2,
          "type": "bytes",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.CertChain",
      "name": "CertChain",
      "fields": [
        {
          "name": "leaf",
          "number": 1,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.CertChain.NoiseCertificate"
        },
        {
          "name": "intermediate",
          "number": 2,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.CertChain.NoiseCertificate"
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.CertChain.NoiseCertificate",
      "name": "NoiseCertificate",
      "fields": [
        {
          "name": "details",
          "number": 1,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "signature",
          "number": 2,
          "type": "bytes",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.CertChain.NoiseCertificate.Details",
      "name": "Details",
      "fields": [
        {
          "name": "serial",
          "number": 1,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "issuerSerial",
          "number": 2,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "key",
          "number": 3,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "notBefore",
          "number": 4,
          "type": "uint64",
          "label": "optional",
          "packed": false
        },
        {
          "name": "notAfter",
          "number": 5,
          "type": "uint64",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.ADVSignedDeviceIdentity",
      "name": "ADVSignedDeviceIdentity",
      "fields": [
        {
          "name": "details",
          "number": 1,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "accountSignatureKey",
          "number": 2,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "accountSignature",
          "number": 3,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "deviceSignature",
          "number": 4,
          "type": "bytes",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.ADVSignedDeviceIdentityHMAC",
      "name": "ADVSignedDeviceIdentityHMAC",
      "fields": [
        {
          "name": "details",
          "number": 1,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "hmac",
          "number": 2,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "accountType",
          "number": 3,
          "type": "enum",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ADVEncryptionType"
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.ADVDeviceIdentity",
      "name": "ADVDeviceIdentity",
      "fields": [
        {
          "name": "rawId",
          "number": 1,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "timestamp",
          "number": 2,
          "type": "uint64",
          "label": "optional",
          "packed": false
        },
        {
          "name": "keyIndex",
          "number": 3,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "accountType",
          "number": 4,
          "type": "enum",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ADVEncryptionType"
        },
        {
          "name": "deviceType",
          "number": 5,
          "type": "enum",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ADVEncryptionType"
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.ADVKeyIndexList",
      "name": "ADVKeyIndexList",
      "fields": [
        {
          "name": "rawId",
          "number": 1,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "timestamp",
          "number": 2,
          "type": "uint64",
          "label": "optional",
          "packed": false
        },
        {
          "name": "currentIndex",
          "number": 3,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "validIndexes",
          "number": 4,
          "type": "uint32",
          "label": "repeated",
          "packed": true
        },
        {
          "name": "accountType",
          "number": 5,
          "type": "enum",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ADVEncryptionType"
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.ADVSignedKeyIndexList",
      "name": "ADVSignedKeyIndexList",
      "fields": [
        {
          "name": "details",
          "number": 1,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "accountSignature",
          "number": 2,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "accountSignatureKey",
          "number": 3,
          "type": "bytes",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.AppVersion",
      "name": "AppVersion",
      "fields": [
        {
          "name": "primary",
          "number": 1,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "secondary",
          "number": 2,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "tertiary",
          "number": 3,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "quaternary",
          "number": 4,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "quinary",
          "number": 5,
          "type": "uint32",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.ClientPayload",
      "name": "ClientPayload",
      "fields": [
        {
          "name": "username",
          "number": 1,
          "type": "uint64",
          "label": "optional",
          "packed": false
        },
        {
          "name": "passive",
          "number": 3,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "userAgent",
          "number": 5,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ClientPayload.UserAgent"
        },
        {
          "name": "webInfo",
          "number": 6,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ClientPayload.WebInfo"
        },
        {
          "name": "pushName",
          "number": 7,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "sessionId",
          "number": 9,
          "type": "sfixed32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "shortConnect",
          "number": 10,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "connectType",
          "number": 12,
          "type": "enum",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ClientPayload.ConnectType"
        },
        {
          "name": "connectReason",
          "number": 13,
          "type": "enum",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ClientPayload.ConnectReason"
        },
        {
          "name": "shards",
          "number": 14,
          "type": "int32",
          "label": "repeated",
          "packed": false
        },
        {
          "name": "connectAttemptCount",
          "number": 16,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "device",
          "number": 18,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "devicePairingData",
          "number": 19,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ClientPayload.DevicePairingRegistrationData"
        },
        {
          "name": "product",
          "number": 20,
          "type": "enum",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ClientPayload.Product"
        },
        {
          "name": "fbCat",
          "number": 21,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "fbUserAgent",
          "number": 22,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "oc",
          "number": 23,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "lc",
          "number": 24,
          "type": "int32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "pull",
          "number": 33,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "paddingBytes",
          "number": 34,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "yearClass",
          "number": 36,
          "type": "int32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "memClass",
          "number": 37,
          "type": "int32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "lidDbMigrated",
          "number": 41,
          "type": "bool",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.ClientPayload.UserAgent",
      "name": "UserAgent",
      "fields": [
        {
          "name": "platform",
          "number": 1,
          "type": "enum",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ClientPayload.UserAgent.Platform"
        },
        {
          "name": "appVersion",
          "number": 2,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.AppVersion"
        },
        {
          "name": "mcc",
          "number": 3,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "mnc",
          "number": 4,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "osVersion",
          "number": 5,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "manufacturer",
          "number": 6,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "device",
          "number": 7,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "osBuildNumber",
          "number": 8,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "phoneId",
          "number": 9,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "releaseChannel",
          "number": 10,
          "type": "enum",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ClientPayload.UserAgent.ReleaseChannel"
        },
        {
          "name": "localeLanguageIso6391",
          "number": 11,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "localeCountryIso31661Alpha2",
          "number": 12,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "deviceBoard",
          "number": 13,
          "type": "string",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.ClientPayload.WebInfo",
      "name": "WebInfo",
      "fields": [
        {
          "name": "refToken",
          "number": 1,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "version",
          "number": 2,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "webSubPlatform",
          "number": 4,
          "type": "enum",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ClientPayload.WebInfo.WebSubPlatform"
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.ClientPayload.DevicePairingRegistrationData",
      "name": "DevicePairingRegistrationData",
      "fields": [
        {
          "name": "eRegid",
          "number": 1,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "eKeytype",
          "number": 2,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "eIdent",
          "number": 3,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "eSkeyId",
          "number": 4,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "eSkeyVal",
          "number": 5,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "eSkeySig",
          "number": 6,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "buildHash",
          "number": 7,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "deviceProps",
          "number": 8,
          "type": "bytes",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.DeviceProps",
      "name": "DeviceProps",
      "fields": [
        {
          "name": "os",
          "number": 1,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "version",
          "number": 2,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.AppVersion"
        },
        {
          "name": "platformType",
          "number": 3,
          "type": "enum",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.DeviceProps.PlatformType"
        },
        {
          "name": "requireFullSync",
          "number": 4,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "historySyncConfig",
          "number": 5,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.DeviceProps.HistorySyncConfig"
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.DeviceProps.HistorySyncConfig",
      "name": "HistorySyncConfig",
      "fields": [
        {
          "name": "fullSyncDaysLimit",
          "number": 1,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "fullSyncSizeMbLimit",
          "number": 2,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "storageQuotaMb",
          "number": 3,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "inlineInitialPayloadInE2EeMsg",
          "number": 4,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "recentSyncDaysLimit",
          "number": 5,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "supportCallLogHistory",
          "number": 6,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "supportBotUserAgentChatHistory",
          "number": 7,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "supportCagReactionsAndPolls",
          "number": 8,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "supportBizHostedMsg",
          "number": 9,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "supportRecentSyncChunkMessageCountTuning",
          "number": 10,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "supportHostedGroupMsg",
          "number": 11,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "supportFbidBotChatHistory",
          "number": 12,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "supportAddOnHistorySyncMigration",
          "number": 13,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "supportMessageAssociation",
          "number": 14,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "supportGroupHistory",
          "number": 15,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "onDemandReady",
          "number": 16,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "supportGuestChat",
          "number": 17,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "completeOnDemandReady",
          "number": 18,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "thumbnailSyncDaysLimit",
          "number": 19,
          "type": "uint32",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.SignalMessage",
      "name": "SignalMessage",
      "fields": [
        {
          "name": "ratchetKey",
          "number": 1,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "counter",
          "number": 2,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "previousCounter",
          "number": 3,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "ciphertext",
          "number": 4,
          "type": "bytes",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.PreKeySignalMessage",
      "name": "PreKeySignalMessage",
      "fields": [
        {
          "name": "registrationId",
          "number": 5,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "preKeyId",
          "number": 1,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "signedPreKeyId",
          "number": 6,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "baseKey",
          "number": 2,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "identityKey",
          "number": 3,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "message",
          "number": 4,
          "type": "bytes",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.SenderKeyMessage",
      "name": "SenderKeyMessage",
      "fields": [
        {
          "name": "id",
          "number": 1,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "iteration",
          "number": 2,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "ciphertext",
          "number": 3,
          "type": "bytes",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.SignalSenderKeyDistributionMessage",
      "name": "SignalSenderKeyDistributionMessage",
      "fields": [
        {
          "name": "id",
          "number": 1,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "iteration",
          "number": 2,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "chainKey",
          "number": 3,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "signingKey",
          "number": 4,
          "type": "bytes",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    }
  ],
  "enums": [
    {
      "fullName": "corvus.ADVEncryptionType",
      "name": "ADVEncryptionType",
      "values": {
        "E2EE": 0,
        "HOSTED": 1
      }
    },
    {
      "fullName": "corvus.ClientPayload.Product",
      "name": "Product",
      "values": {
        "WHATSAPP": 0,
        "MESSENGER": 1
      }
    },
    {
      "fullName": "corvus.ClientPayload.ConnectType",
      "name": "ConnectType",
      "values": {
        "CELLULAR_UNKNOWN": 0,
        "WIFI_UNKNOWN": 1,
        "CELLULAR_EDGE": 100,
        "CELLULAR_IDEN": 101,
        "CELLULAR_UMTS": 102,
        "CELLULAR_EVDO": 103,
        "CELLULAR_GPRS": 104,
        "CELLULAR_HSDPA": 105,
        "CELLULAR_HSUPA": 106,
        "CELLULAR_HSPA": 107,
        "CELLULAR_CDMA": 108,
        "CELLULAR_1XRTT": 109,
        "CELLULAR_EHRPD": 110,
        "CELLULAR_LTE": 111,
        "CELLULAR_HSPAP": 112
      }
    },
    {
      "fullName": "corvus.ClientPayload.ConnectReason",
      "name": "ConnectReason",
      "values": {
        "PUSH": 0,
        "USER_ACTIVATED": 1,
        "SCHEDULED": 2,
        "ERROR_RECONNECT": 3,
        "NETWORK_SWITCH": 4,
        "PING_RECONNECT": 5,
        "UNKNOWN": 6
      }
    },
    {
      "fullName": "corvus.ClientPayload.UserAgent.Platform",
      "name": "Platform",
      "values": {
        "ANDROID": 0,
        "IOS": 1,
        "WINDOWS_PHONE": 2,
        "BLACKBERRY": 3,
        "BLACKBERRYX": 4,
        "S40": 5,
        "S60": 6,
        "PYTHON_CLIENT": 7,
        "TIZEN": 8,
        "ENTERPRISE": 9,
        "SMB_ANDROID": 10,
        "KAIOS": 11,
        "SMB_IOS": 12,
        "WINDOWS": 13,
        "WEB": 14,
        "PORTAL": 15,
        "GREEN_ANDROID": 16,
        "GREEN_IPHONE": 17,
        "BLUE_ANDROID": 18,
        "BLUE_IPHONE": 19,
        "FBLITE_ANDROID": 20,
        "MLITE_ANDROID": 21,
        "IGLITE_ANDROID": 22,
        "PAGE": 23,
        "MACOS": 24
      }
    },
    {
      "fullName": "corvus.ClientPayload.UserAgent.ReleaseChannel",
      "name": "ReleaseChannel",
      "values": {
        "RELEASE": 0,
        "BETA": 1,
        "ALPHA": 2,
        "DEBUG": 3
      }
    },
    {
      "fullName": "corvus.ClientPayload.WebInfo.WebSubPlatform",
      "name": "WebSubPlatform",
      "values": {
        "WEB_BROWSER": 0,
        "APP_STORE": 1,
        "WIN_STORE": 2,
        "DARWIN": 3,
        "WIN32": 4
      }
    },
    {
      "fullName": "corvus.DeviceProps.PlatformType",
      "name": "PlatformType",
      "values": {
        "UNKNOWN": 0,
        "CHROME": 1,
        "FIREFOX": 2,
        "IE": 3,
        "OPERA": 4,
        "SAFARI": 5,
        "EDGE": 6,
        "DESKTOP": 7,
        "IPAD": 8,
        "ANDROID_TABLET": 9,
        "OHANA": 10,
        "ALOHA": 11,
        "CATALINA": 12,
        "TCL_TV": 13
      }
    }
  ]
}
