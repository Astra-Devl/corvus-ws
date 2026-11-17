// File ini dibuat otomatis oleh scripts/generate-proto.cjs dari proto/schemas/waWeb.proto.
// JANGAN DIEDIT — ubah file .proto lalu jalankan `npm run proto:generate`.
/* eslint-disable */
import type { FileDescriptor } from '../loader/proto-registry.js'
import type { MessageKey } from './waCommon.js'
import type { Message } from './waMessage.js'

export const WebMessageInfo_Status = {
  ERROR: 0,
  PENDING: 1,
  SERVER_ACK: 2,
  DELIVERY_ACK: 3,
  READ: 4,
  PLAYED: 5,
} as const
export type WebMessageInfo_Status = (typeof WebMessageInfo_Status)[keyof typeof WebMessageInfo_Status]

export interface WebMessageInfo {
  key?: MessageKey | null
  message?: Message | null
  messageTimestamp?: number | bigint | null
  status?: number | null
  participant?: string | null
  messageC2STimestamp?: number | bigint | null
  ignore?: boolean | null
  starred?: boolean | null
  broadcast?: boolean | null
  pushName?: string | null
  mediaCiphertextSha256?: Uint8Array | null
  multicast?: boolean | null
  urlText?: boolean | null
  urlNumber?: boolean | null
  messageStubType?: number | null
  clearMedia?: boolean | null
  messageStubParameters?: Array<string> | null
  duration?: number | null
  labels?: Array<string> | null
  ephemeralStartTimestamp?: number | bigint | null
  ephemeralDuration?: number | null
  ephemeralOffToOn?: boolean | null
  ephemeralOutOfSync?: boolean | null
  verifiedBizName?: string | null
  userReceipt?: Array<UserReceipt> | null
  reactions?: Array<Reaction> | null
}

export interface UserReceipt {
  userJid?: string | null
  receiptTimestamp?: number | bigint | null
  readTimestamp?: number | bigint | null
  playedTimestamp?: number | bigint | null
  pendingDeviceJid?: Array<string> | null
  deliveredDeviceJid?: Array<string> | null
}

export interface Reaction {
  key?: MessageKey | null
  text?: string | null
  groupingKey?: string | null
  senderTimestampMs?: number | bigint | null
  unread?: boolean | null
}

export const waWebDescriptor: FileDescriptor = {
  "name": "waWeb.proto",
  "package": "corvus",
  "syntax": "proto2",
  "imports": [
    "waCommon.proto",
    "waMessage.proto"
  ],
  "messages": [
    {
      "fullName": "corvus.WebMessageInfo",
      "name": "WebMessageInfo",
      "fields": [
        {
          "name": "key",
          "number": 1,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.MessageKey"
        },
        {
          "name": "message",
          "number": 2,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.Message"
        },
        {
          "name": "messageTimestamp",
          "number": 3,
          "type": "uint64",
          "label": "optional",
          "packed": false
        },
        {
          "name": "status",
          "number": 4,
          "type": "enum",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.WebMessageInfo.Status"
        },
        {
          "name": "participant",
          "number": 5,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "messageC2STimestamp",
          "number": 6,
          "type": "uint64",
          "label": "optional",
          "packed": false
        },
        {
          "name": "ignore",
          "number": 16,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "starred",
          "number": 17,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "broadcast",
          "number": 18,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "pushName",
          "number": 19,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "mediaCiphertextSha256",
          "number": 20,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "multicast",
          "number": 21,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "urlText",
          "number": 22,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "urlNumber",
          "number": 23,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "messageStubType",
          "number": 24,
          "type": "int32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "clearMedia",
          "number": 25,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "messageStubParameters",
          "number": 26,
          "type": "string",
          "label": "repeated",
          "packed": false
        },
        {
          "name": "duration",
          "number": 27,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "labels",
          "number": 28,
          "type": "string",
          "label": "repeated",
          "packed": false
        },
        {
          "name": "ephemeralStartTimestamp",
          "number": 32,
          "type": "uint64",
          "label": "optional",
          "packed": false
        },
        {
          "name": "ephemeralDuration",
          "number": 33,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "ephemeralOffToOn",
          "number": 34,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "ephemeralOutOfSync",
          "number": 35,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "verifiedBizName",
          "number": 37,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "userReceipt",
          "number": 40,
          "type": "message",
          "label": "repeated",
          "packed": false,
          "typeName": "corvus.UserReceipt"
        },
        {
          "name": "reactions",
          "number": 41,
          "type": "message",
          "label": "repeated",
          "packed": false,
          "typeName": "corvus.Reaction"
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.UserReceipt",
      "name": "UserReceipt",
      "fields": [
        {
          "name": "userJid",
          "number": 1,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "receiptTimestamp",
          "number": 2,
          "type": "int64",
          "label": "optional",
          "packed": false
        },
        {
          "name": "readTimestamp",
          "number": 3,
          "type": "int64",
          "label": "optional",
          "packed": false
        },
        {
          "name": "playedTimestamp",
          "number": 4,
          "type": "int64",
          "label": "optional",
          "packed": false
        },
        {
          "name": "pendingDeviceJid",
          "number": 5,
          "type": "string",
          "label": "repeated",
          "packed": false
        },
        {
          "name": "deliveredDeviceJid",
          "number": 6,
          "type": "string",
          "label": "repeated",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.Reaction",
      "name": "Reaction",
      "fields": [
        {
          "name": "key",
          "number": 1,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.MessageKey"
        },
        {
          "name": "text",
          "number": 2,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "groupingKey",
          "number": 3,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "senderTimestampMs",
          "number": 4,
          "type": "int64",
          "label": "optional",
          "packed": false
        },
        {
          "name": "unread",
          "number": 5,
          "type": "bool",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    }
  ],
  "enums": [
    {
      "fullName": "corvus.WebMessageInfo.Status",
      "name": "Status",
      "values": {
        "ERROR": 0,
        "PENDING": 1,
        "SERVER_ACK": 2,
        "DELIVERY_ACK": 3,
        "READ": 4,
        "PLAYED": 5
      }
    }
  ]
}
