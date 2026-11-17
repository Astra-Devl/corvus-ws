// File ini dibuat otomatis oleh scripts/generate-proto.cjs dari proto/schemas/waSync.proto.
// JANGAN DIEDIT — ubah file .proto lalu jalankan `npm run proto:generate`.
/* eslint-disable */
import type { FileDescriptor } from '../loader/proto-registry.js'

export const SyncdMutation_SyncdOperation = {
  SET: 0,
  REMOVE: 1,
} as const
export type SyncdMutation_SyncdOperation = (typeof SyncdMutation_SyncdOperation)[keyof typeof SyncdMutation_SyncdOperation]

export interface KeyId {
  id?: Uint8Array | null
}

export interface AppStateSyncKeyId {
  keyId?: Uint8Array | null
}

export interface AppStateSyncKeyFingerprint {
  rawId?: number | null
  currentIndex?: number | null
  deviceIndexes?: Array<number> | null
}

export interface AppStateSyncKeyData {
  keyData?: Uint8Array | null
  fingerprint?: AppStateSyncKeyFingerprint | null
  timestamp?: number | bigint | null
}

export interface AppStateSyncKey {
  keyId?: AppStateSyncKeyId | null
  keyData?: AppStateSyncKeyData | null
}

export interface AppStateSyncKeyShare {
  keys?: Array<AppStateSyncKey> | null
}

export interface AppStateSyncKeyRequest {
  keyIds?: Array<AppStateSyncKeyId> | null
}

export interface SyncdVersion {
  version?: number | bigint | null
}

export interface SyncdIndex {
  blob?: Uint8Array | null
}

export interface SyncdValue {
  blob?: Uint8Array | null
}

export interface SyncdRecord {
  index?: SyncdIndex | null
  value?: SyncdValue | null
  keyId?: KeyId | null
}

export interface SyncdMutation {
  operation?: number | null
  record?: SyncdRecord | null
}

export interface SyncdMutations {
  mutations?: Array<SyncdMutation> | null
}

export interface ExternalBlobReference {
  mediaKey?: Uint8Array | null
  directPath?: string | null
  handle?: string | null
  fileSizeBytes?: number | bigint | null
  fileSha256?: Uint8Array | null
  fileEncSha256?: Uint8Array | null
}

export interface ExitCode {
  code?: number | bigint | null
  text?: string | null
}

export interface SyncdPatch {
  version?: SyncdVersion | null
  mutations?: Array<SyncdMutation> | null
  externalMutations?: ExternalBlobReference | null
  snapshotMac?: Uint8Array | null
  patchMac?: Uint8Array | null
  keyId?: KeyId | null
  exitCode?: ExitCode | null
  deviceIndex?: number | null
  clientDebugData?: Uint8Array | null
}

export interface SyncdSnapshot {
  version?: SyncdVersion | null
  records?: Array<SyncdRecord> | null
  mac?: Uint8Array | null
  keyId?: KeyId | null
}

export interface SyncActionData {
  index?: Uint8Array | null
  value?: Uint8Array | null
  padding?: Uint8Array | null
  version?: number | null
}

export const waSyncDescriptor: FileDescriptor = {
  "name": "waSync.proto",
  "package": "corvus",
  "syntax": "proto2",
  "imports": [],
  "messages": [
    {
      "fullName": "corvus.KeyId",
      "name": "KeyId",
      "fields": [
        {
          "name": "id",
          "number": 1,
          "type": "bytes",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.AppStateSyncKeyId",
      "name": "AppStateSyncKeyId",
      "fields": [
        {
          "name": "keyId",
          "number": 1,
          "type": "bytes",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.AppStateSyncKeyFingerprint",
      "name": "AppStateSyncKeyFingerprint",
      "fields": [
        {
          "name": "rawId",
          "number": 1,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "currentIndex",
          "number": 2,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "deviceIndexes",
          "number": 3,
          "type": "uint32",
          "label": "repeated",
          "packed": true
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.AppStateSyncKeyData",
      "name": "AppStateSyncKeyData",
      "fields": [
        {
          "name": "keyData",
          "number": 1,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "fingerprint",
          "number": 2,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.AppStateSyncKeyFingerprint"
        },
        {
          "name": "timestamp",
          "number": 3,
          "type": "int64",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.AppStateSyncKey",
      "name": "AppStateSyncKey",
      "fields": [
        {
          "name": "keyId",
          "number": 1,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.AppStateSyncKeyId"
        },
        {
          "name": "keyData",
          "number": 2,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.AppStateSyncKeyData"
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.AppStateSyncKeyShare",
      "name": "AppStateSyncKeyShare",
      "fields": [
        {
          "name": "keys",
          "number": 1,
          "type": "message",
          "label": "repeated",
          "packed": false,
          "typeName": "corvus.AppStateSyncKey"
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.AppStateSyncKeyRequest",
      "name": "AppStateSyncKeyRequest",
      "fields": [
        {
          "name": "keyIds",
          "number": 1,
          "type": "message",
          "label": "repeated",
          "packed": false,
          "typeName": "corvus.AppStateSyncKeyId"
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.SyncdVersion",
      "name": "SyncdVersion",
      "fields": [
        {
          "name": "version",
          "number": 1,
          "type": "uint64",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.SyncdIndex",
      "name": "SyncdIndex",
      "fields": [
        {
          "name": "blob",
          "number": 1,
          "type": "bytes",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.SyncdValue",
      "name": "SyncdValue",
      "fields": [
        {
          "name": "blob",
          "number": 1,
          "type": "bytes",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.SyncdRecord",
      "name": "SyncdRecord",
      "fields": [
        {
          "name": "index",
          "number": 1,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.SyncdIndex"
        },
        {
          "name": "value",
          "number": 2,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.SyncdValue"
        },
        {
          "name": "keyId",
          "number": 3,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.KeyId"
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.SyncdMutation",
      "name": "SyncdMutation",
      "fields": [
        {
          "name": "operation",
          "number": 1,
          "type": "enum",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.SyncdMutation.SyncdOperation"
        },
        {
          "name": "record",
          "number": 2,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.SyncdRecord"
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.SyncdMutations",
      "name": "SyncdMutations",
      "fields": [
        {
          "name": "mutations",
          "number": 1,
          "type": "message",
          "label": "repeated",
          "packed": false,
          "typeName": "corvus.SyncdMutation"
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.ExternalBlobReference",
      "name": "ExternalBlobReference",
      "fields": [
        {
          "name": "mediaKey",
          "number": 1,
          "type": "bytes",
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
          "name": "handle",
          "number": 3,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "fileSizeBytes",
          "number": 4,
          "type": "uint64",
          "label": "optional",
          "packed": false
        },
        {
          "name": "fileSha256",
          "number": 5,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "fileEncSha256",
          "number": 6,
          "type": "bytes",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.ExitCode",
      "name": "ExitCode",
      "fields": [
        {
          "name": "code",
          "number": 1,
          "type": "uint64",
          "label": "optional",
          "packed": false
        },
        {
          "name": "text",
          "number": 2,
          "type": "string",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.SyncdPatch",
      "name": "SyncdPatch",
      "fields": [
        {
          "name": "version",
          "number": 1,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.SyncdVersion"
        },
        {
          "name": "mutations",
          "number": 2,
          "type": "message",
          "label": "repeated",
          "packed": false,
          "typeName": "corvus.SyncdMutation"
        },
        {
          "name": "externalMutations",
          "number": 3,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ExternalBlobReference"
        },
        {
          "name": "snapshotMac",
          "number": 4,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "patchMac",
          "number": 5,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "keyId",
          "number": 6,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.KeyId"
        },
        {
          "name": "exitCode",
          "number": 7,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ExitCode"
        },
        {
          "name": "deviceIndex",
          "number": 8,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "clientDebugData",
          "number": 9,
          "type": "bytes",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.SyncdSnapshot",
      "name": "SyncdSnapshot",
      "fields": [
        {
          "name": "version",
          "number": 1,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.SyncdVersion"
        },
        {
          "name": "records",
          "number": 2,
          "type": "message",
          "label": "repeated",
          "packed": false,
          "typeName": "corvus.SyncdRecord"
        },
        {
          "name": "mac",
          "number": 3,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "keyId",
          "number": 4,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.KeyId"
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.SyncActionData",
      "name": "SyncActionData",
      "fields": [
        {
          "name": "index",
          "number": 1,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "value",
          "number": 2,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "padding",
          "number": 3,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "version",
          "number": 4,
          "type": "int32",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    }
  ],
  "enums": [
    {
      "fullName": "corvus.SyncdMutation.SyncdOperation",
      "name": "SyncdOperation",
      "values": {
        "SET": 0,
        "REMOVE": 1
      }
    }
  ]
}
