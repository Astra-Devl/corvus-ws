// File ini dibuat otomatis oleh scripts/generate-proto.cjs dari proto/schemas/waCall.proto.
// JANGAN DIEDIT — ubah file .proto lalu jalankan `npm run proto:generate`.
/* eslint-disable */
import type { FileDescriptor } from '../loader/proto-registry.js'

export interface Call {
  callKey?: Uint8Array | null
  conversionSource?: string | null
  conversionData?: Uint8Array | null
  conversionDelaySeconds?: number | null
}

export const waCallDescriptor: FileDescriptor = {
  "name": "waCall.proto",
  "package": "corvus",
  "syntax": "proto2",
  "imports": [],
  "messages": [
    {
      "fullName": "corvus.Call",
      "name": "Call",
      "fields": [
        {
          "name": "callKey",
          "number": 1,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "conversionSource",
          "number": 2,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "conversionData",
          "number": 3,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "conversionDelaySeconds",
          "number": 4,
          "type": "uint32",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    }
  ],
  "enums": []
}
