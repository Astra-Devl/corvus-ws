// File ini dibuat otomatis oleh scripts/generate-proto.cjs dari proto/schemas/waMedia.proto.
// JANGAN DIEDIT — ubah file .proto lalu jalankan `npm run proto:generate`.
/* eslint-disable */
import type { FileDescriptor } from '../loader/proto-registry.js'

export const MediaRetryNotification_ResultType = {
  GENERAL_ERROR: 0,
  SUCCESS: 1,
  NOT_FOUND: 2,
  DECRYPTION_ERROR: 3,
} as const
export type MediaRetryNotification_ResultType = (typeof MediaRetryNotification_ResultType)[keyof typeof MediaRetryNotification_ResultType]

export interface MediaRetryNotification {
  stanzaId?: string | null
  directPath?: string | null
  result?: number | null
}

export interface ServerErrorReceipt {
  stanzaId?: string | null
}

export const waMediaDescriptor: FileDescriptor = {
  "name": "waMedia.proto",
  "package": "corvus",
  "syntax": "proto2",
  "imports": [],
  "messages": [
    {
      "fullName": "corvus.MediaRetryNotification",
      "name": "MediaRetryNotification",
      "fields": [
        {
          "name": "stanzaId",
          "number": 1,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "directPath",
          "number": 2,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "result",
          "number": 3,
          "type": "enum",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.MediaRetryNotification.ResultType"
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.ServerErrorReceipt",
      "name": "ServerErrorReceipt",
      "fields": [
        {
          "name": "stanzaId",
          "number": 1,
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
      "fullName": "corvus.MediaRetryNotification.ResultType",
      "name": "ResultType",
      "values": {
        "GENERAL_ERROR": 0,
        "SUCCESS": 1,
        "NOT_FOUND": 2,
        "DECRYPTION_ERROR": 3
      }
    }
  ]
}
