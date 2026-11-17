// File ini dibuat otomatis oleh scripts/generate-proto.cjs dari proto/schemas/waGroup.proto.
// JANGAN DIEDIT — ubah file .proto lalu jalankan `npm run proto:generate`.
/* eslint-disable */
import type { FileDescriptor } from '../loader/proto-registry.js'

export const GroupParticipant_Rank = {
  REGULAR: 0,
  ADMIN: 1,
  SUPERADMIN: 2,
} as const
export type GroupParticipant_Rank = (typeof GroupParticipant_Rank)[keyof typeof GroupParticipant_Rank]

export const PastParticipant_LeaveReason = {
  LEFT: 0,
  REMOVED: 1,
} as const
export type PastParticipant_LeaveReason = (typeof PastParticipant_LeaveReason)[keyof typeof PastParticipant_LeaveReason]

export interface GroupParticipant {
  userJid?: string | null
  rank?: number | null
}

export interface PastParticipant {
  userJid?: string | null
  leaveReason?: number | null
  leaveTs?: number | bigint | null
}

export const waGroupDescriptor: FileDescriptor = {
  "name": "waGroup.proto",
  "package": "corvus",
  "syntax": "proto2",
  "imports": [],
  "messages": [
    {
      "fullName": "corvus.GroupParticipant",
      "name": "GroupParticipant",
      "fields": [
        {
          "name": "userJid",
          "number": 1,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "rank",
          "number": 2,
          "type": "enum",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.GroupParticipant.Rank"
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.PastParticipant",
      "name": "PastParticipant",
      "fields": [
        {
          "name": "userJid",
          "number": 1,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "leaveReason",
          "number": 2,
          "type": "enum",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.PastParticipant.LeaveReason"
        },
        {
          "name": "leaveTs",
          "number": 3,
          "type": "uint64",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    }
  ],
  "enums": [
    {
      "fullName": "corvus.GroupParticipant.Rank",
      "name": "Rank",
      "values": {
        "REGULAR": 0,
        "ADMIN": 1,
        "SUPERADMIN": 2
      }
    },
    {
      "fullName": "corvus.PastParticipant.LeaveReason",
      "name": "LeaveReason",
      "values": {
        "LEFT": 0,
        "REMOVED": 1
      }
    }
  ]
}
