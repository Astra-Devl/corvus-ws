// File ini dibuat otomatis oleh scripts/generate-proto.cjs dari proto/schemas/waNewsletter.proto.
// JANGAN DIEDIT — ubah file .proto lalu jalankan `npm run proto:generate`.
/* eslint-disable */
import type { FileDescriptor } from '../loader/proto-registry.js'

export const ForwardedNewsletterMessageInfo_ContentType = {
  UPDATE: 1,
  UPDATE_CARD: 2,
  LINK_CARD: 3,
} as const
export type ForwardedNewsletterMessageInfo_ContentType = (typeof ForwardedNewsletterMessageInfo_ContentType)[keyof typeof ForwardedNewsletterMessageInfo_ContentType]

export interface ForwardedNewsletterMessageInfo {
  newsletterJid?: string | null
  serverMessageId?: number | null
  newsletterName?: string | null
  contentType?: number | null
  accessibilityText?: string | null
}

export const waNewsletterDescriptor: FileDescriptor = {
  "name": "waNewsletter.proto",
  "package": "corvus",
  "syntax": "proto2",
  "imports": [],
  "messages": [
    {
      "fullName": "corvus.ForwardedNewsletterMessageInfo",
      "name": "ForwardedNewsletterMessageInfo",
      "fields": [
        {
          "name": "newsletterJid",
          "number": 1,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "serverMessageId",
          "number": 2,
          "type": "int32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "newsletterName",
          "number": 3,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "contentType",
          "number": 4,
          "type": "enum",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ForwardedNewsletterMessageInfo.ContentType"
        },
        {
          "name": "accessibilityText",
          "number": 5,
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
      "fullName": "corvus.ForwardedNewsletterMessageInfo.ContentType",
      "name": "ContentType",
      "values": {
        "UPDATE": 1,
        "UPDATE_CARD": 2,
        "LINK_CARD": 3
      }
    }
  ]
}
