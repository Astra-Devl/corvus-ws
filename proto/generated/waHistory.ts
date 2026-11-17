// File ini dibuat otomatis oleh scripts/generate-proto.cjs dari proto/schemas/waHistory.proto.
// JANGAN DIEDIT — ubah file .proto lalu jalankan `npm run proto:generate`.
/* eslint-disable */
import type { FileDescriptor } from '../loader/proto-registry.js'
import type { Pushname } from './waCommon.js'
import type { GroupParticipant } from './waGroup.js'
import type { WebMessageInfo } from './waWeb.js'

export const HistorySync_HistorySyncType = {
  INITIAL_BOOTSTRAP: 0,
  INITIAL_STATUS_V3: 1,
  FULL: 2,
  RECENT: 3,
  PUSH_NAME: 4,
  NON_BLOCKING_DATA: 5,
  ON_DEMAND: 6,
} as const
export type HistorySync_HistorySyncType = (typeof HistorySync_HistorySyncType)[keyof typeof HistorySync_HistorySyncType]

export interface HistorySync {
  syncType?: number | null
  conversations?: Array<Conversation> | null
  statusV3Messages?: Array<WebMessageInfo> | null
  chunkOrder?: number | null
  progress?: number | null
  pushnames?: Array<Pushname> | null
}

export interface HistorySyncMsg {
  message?: WebMessageInfo | null
  msgOrderId?: number | bigint | null
}

export interface Conversation {
  id?: string | null
  messages?: Array<HistorySyncMsg> | null
  newJid?: string | null
  oldJid?: string | null
  lastMsgTimestamp?: number | bigint | null
  unreadCount?: number | null
  readOnly?: boolean | null
  endOfHistoryTransfer?: boolean | null
  ephemeralExpiration?: number | null
  ephemeralSettingTimestamp?: number | bigint | null
  conversationTimestamp?: number | bigint | null
  name?: string | null
  pHash?: string | null
  notSpam?: boolean | null
  archived?: boolean | null
  unreadMentionCount?: number | null
  markedAsUnread?: boolean | null
  participant?: Array<GroupParticipant> | null
  pinned?: number | null
  muteEndTime?: number | bigint | null
  createdAt?: number | bigint | null
  createdBy?: string | null
  description?: string | null
  support?: boolean | null
  isParentGroup?: boolean | null
  isDefaultSubgroup?: boolean | null
  parentGroupId?: string | null
  displayName?: string | null
}

export const waHistoryDescriptor: FileDescriptor = {
  "name": "waHistory.proto",
  "package": "corvus",
  "syntax": "proto2",
  "imports": [
    "waCommon.proto",
    "waGroup.proto",
    "waWeb.proto"
  ],
  "messages": [
    {
      "fullName": "corvus.HistorySync",
      "name": "HistorySync",
      "fields": [
        {
          "name": "syncType",
          "number": 1,
          "type": "enum",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.HistorySync.HistorySyncType"
        },
        {
          "name": "conversations",
          "number": 2,
          "type": "message",
          "label": "repeated",
          "packed": false,
          "typeName": "corvus.Conversation"
        },
        {
          "name": "statusV3Messages",
          "number": 3,
          "type": "message",
          "label": "repeated",
          "packed": false,
          "typeName": "corvus.WebMessageInfo"
        },
        {
          "name": "chunkOrder",
          "number": 5,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "progress",
          "number": 6,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "pushnames",
          "number": 7,
          "type": "message",
          "label": "repeated",
          "packed": false,
          "typeName": "corvus.Pushname"
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.HistorySyncMsg",
      "name": "HistorySyncMsg",
      "fields": [
        {
          "name": "message",
          "number": 1,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.WebMessageInfo"
        },
        {
          "name": "msgOrderId",
          "number": 2,
          "type": "uint64",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.Conversation",
      "name": "Conversation",
      "fields": [
        {
          "name": "id",
          "number": 1,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "messages",
          "number": 2,
          "type": "message",
          "label": "repeated",
          "packed": false,
          "typeName": "corvus.HistorySyncMsg"
        },
        {
          "name": "newJid",
          "number": 3,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "oldJid",
          "number": 4,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "lastMsgTimestamp",
          "number": 5,
          "type": "uint64",
          "label": "optional",
          "packed": false
        },
        {
          "name": "unreadCount",
          "number": 6,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "readOnly",
          "number": 7,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "endOfHistoryTransfer",
          "number": 8,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "ephemeralExpiration",
          "number": 9,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "ephemeralSettingTimestamp",
          "number": 10,
          "type": "int64",
          "label": "optional",
          "packed": false
        },
        {
          "name": "conversationTimestamp",
          "number": 12,
          "type": "uint64",
          "label": "optional",
          "packed": false
        },
        {
          "name": "name",
          "number": 13,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "pHash",
          "number": 14,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "notSpam",
          "number": 15,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "archived",
          "number": 16,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "unreadMentionCount",
          "number": 18,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "markedAsUnread",
          "number": 19,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "participant",
          "number": 20,
          "type": "message",
          "label": "repeated",
          "packed": false,
          "typeName": "corvus.GroupParticipant"
        },
        {
          "name": "pinned",
          "number": 24,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "muteEndTime",
          "number": 25,
          "type": "uint64",
          "label": "optional",
          "packed": false
        },
        {
          "name": "createdAt",
          "number": 31,
          "type": "uint64",
          "label": "optional",
          "packed": false
        },
        {
          "name": "createdBy",
          "number": 32,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "description",
          "number": 33,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "support",
          "number": 34,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "isParentGroup",
          "number": 35,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "isDefaultSubgroup",
          "number": 36,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "parentGroupId",
          "number": 37,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "displayName",
          "number": 38,
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
      "fullName": "corvus.HistorySync.HistorySyncType",
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
