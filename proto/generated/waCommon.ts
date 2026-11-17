// File ini dibuat otomatis oleh scripts/generate-proto.cjs dari proto/schemas/waCommon.proto.
// JANGAN DIEDIT — ubah file .proto lalu jalankan `npm run proto:generate`.
/* eslint-disable */
import type { FileDescriptor } from '../loader/proto-registry.js'

export const HistorySyncNotification_HistorySyncType = {
  INITIAL_BOOTSTRAP: 0,
  INITIAL_STATUS_V3: 1,
  FULL: 2,
  RECENT: 3,
  PUSH_NAME: 4,
  NON_BLOCKING_DATA: 5,
  ON_DEMAND: 6,
} as const
export type HistorySyncNotification_HistorySyncType = (typeof HistorySyncNotification_HistorySyncType)[keyof typeof HistorySyncNotification_HistorySyncType]

export interface MessageKey {
  remoteJid?: string | null
  fromMe?: boolean | null
  id?: string | null
  participant?: string | null
}

export interface DeviceListMetadata {
  senderKeyHash?: Uint8Array | null
  senderTimestamp?: number | bigint | null
  senderKeyIndexes?: Array<number> | null
  recipientKeyHash?: Uint8Array | null
  recipientTimestamp?: number | bigint | null
  recipientKeyIndexes?: Array<number> | null
}

export interface MessageContextInfo {
  deviceListMetadata?: DeviceListMetadata | null
  deviceListMetadataVersion?: number | null
  messageSecret?: Uint8Array | null
  paddingBytes?: Uint8Array | null
  messageAddOnDurationInSecs?: number | null
}

export interface HistorySyncNotification {
  fileSha256?: Uint8Array | null
  fileLength?: number | bigint | null
  mediaKey?: Uint8Array | null
  fileEncSha256?: Uint8Array | null
  directPath?: string | null
  syncType?: number | null
  chunkOrder?: number | null
  originalMessageId?: string | null
  progress?: number | null
  oldestMsgInChunkTimestampSec?: number | bigint | null
  initialHistBootstrapInlinePayload?: Uint8Array | null
  peerDataRequestSessionId?: string | null
}

export interface Pushname {
  id?: string | null
  pushname?: string | null
}

export const waCommonDescriptor: FileDescriptor = {
  "name": "waCommon.proto",
  "package": "corvus",
  "syntax": "proto2",
  "imports": [],
  "messages": [
    {
      "fullName": "corvus.MessageKey",
      "name": "MessageKey",
      "fields": [
        {
          "name": "remoteJid",
          "number": 1,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "fromMe",
          "number": 2,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "id",
          "number": 3,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "participant",
          "number": 4,
          "type": "string",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.DeviceListMetadata",
      "name": "DeviceListMetadata",
      "fields": [
        {
          "name": "senderKeyHash",
          "number": 1,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "senderTimestamp",
          "number": 2,
          "type": "uint64",
          "label": "optional",
          "packed": false
        },
        {
          "name": "senderKeyIndexes",
          "number": 3,
          "type": "uint32",
          "label": "repeated",
          "packed": true
        },
        {
          "name": "recipientKeyHash",
          "number": 8,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "recipientTimestamp",
          "number": 9,
          "type": "uint64",
          "label": "optional",
          "packed": false
        },
        {
          "name": "recipientKeyIndexes",
          "number": 10,
          "type": "uint32",
          "label": "repeated",
          "packed": true
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.MessageContextInfo",
      "name": "MessageContextInfo",
      "fields": [
        {
          "name": "deviceListMetadata",
          "number": 1,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.DeviceListMetadata"
        },
        {
          "name": "deviceListMetadataVersion",
          "number": 2,
          "type": "int32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "messageSecret",
          "number": 3,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "paddingBytes",
          "number": 4,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "messageAddOnDurationInSecs",
          "number": 5,
          "type": "uint32",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.HistorySyncNotification",
      "name": "HistorySyncNotification",
      "fields": [
        {
          "name": "fileSha256",
          "number": 1,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "fileLength",
          "number": 2,
          "type": "uint64",
          "label": "optional",
          "packed": false
        },
        {
          "name": "mediaKey",
          "number": 3,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "fileEncSha256",
          "number": 4,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "directPath",
          "number": 5,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "syncType",
          "number": 6,
          "type": "enum",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.HistorySyncNotification.HistorySyncType"
        },
        {
          "name": "chunkOrder",
          "number": 7,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "originalMessageId",
          "number": 8,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "progress",
          "number": 9,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "oldestMsgInChunkTimestampSec",
          "number": 10,
          "type": "int64",
          "label": "optional",
          "packed": false
        },
        {
          "name": "initialHistBootstrapInlinePayload",
          "number": 11,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "peerDataRequestSessionId",
          "number": 12,
          "type": "string",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.Pushname",
      "name": "Pushname",
      "fields": [
        {
          "name": "id",
          "number": 1,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "pushname",
          "number": 2,
          "type": "string",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    }
  ],
  "enums": [
    {
      "fullName": "corvus.HistorySyncNotification.HistorySyncType",
      "name": "HistorySyncType",
      "values": {
        "INITIAL_BOOTSTRAP": 0,
        "INITIAL_STATUS_V3": 1,
        "FULL": 2,
        "RECENT": 3,
        "PUSH_NAME": 4,
        "NON_BLOCKING_DATA": 5,
        "ON_DEMAND": 6
      }
    }
  ]
}
