// File ini dibuat otomatis oleh scripts/generate-proto.cjs dari proto/schemas/waBusiness.proto.
// JANGAN DIEDIT — ubah file .proto lalu jalankan `npm run proto:generate`.
/* eslint-disable */
import type { FileDescriptor } from '../loader/proto-registry.js'

export const BizAccountLinkInfo_HostStorageType = {
  ON_PREMISE: 0,
  FACEBOOK: 1,
} as const
export type BizAccountLinkInfo_HostStorageType = (typeof BizAccountLinkInfo_HostStorageType)[keyof typeof BizAccountLinkInfo_HostStorageType]

export const BizAccountLinkInfo_AccountType = {
  ENTERPRISE: 0,
  PAGE: 1,
} as const
export type BizAccountLinkInfo_AccountType = (typeof BizAccountLinkInfo_AccountType)[keyof typeof BizAccountLinkInfo_AccountType]

export interface VerifiedNameCertificate {
  details?: Uint8Array | null
  signature?: Uint8Array | null
  serverSignature?: Uint8Array | null
}

export interface VerifiedNameCertificate_Details {
  serial?: number | bigint | null
  issuer?: string | null
  verifiedName?: string | null
  localizedNames?: Array<LocalizedName> | null
  issueTime?: number | bigint | null
}

export interface LocalizedName {
  lg?: string | null
  lc?: string | null
  verifiedName?: string | null
}

export interface BizAccountLinkInfo {
  whatsappBizAcctFbid?: number | bigint | null
  whatsappAcctNumber?: string | null
  issueTime?: number | bigint | null
  hostStorage?: number | null
  accountType?: number | null
}

export interface BizAccountPayload {
  vnameCert?: VerifiedNameCertificate | null
  bizAcctLinkInfo?: Uint8Array | null
}

export const waBusinessDescriptor: FileDescriptor = {
  "name": "waBusiness.proto",
  "package": "corvus",
  "syntax": "proto2",
  "imports": [],
  "messages": [
    {
      "fullName": "corvus.VerifiedNameCertificate",
      "name": "VerifiedNameCertificate",
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
        },
        {
          "name": "serverSignature",
          "number": 3,
          "type": "bytes",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.VerifiedNameCertificate.Details",
      "name": "Details",
      "fields": [
        {
          "name": "serial",
          "number": 1,
          "type": "uint64",
          "label": "optional",
          "packed": false
        },
        {
          "name": "issuer",
          "number": 2,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "verifiedName",
          "number": 4,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "localizedNames",
          "number": 8,
          "type": "message",
          "label": "repeated",
          "packed": false,
          "typeName": "corvus.LocalizedName"
        },
        {
          "name": "issueTime",
          "number": 10,
          "type": "uint64",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.LocalizedName",
      "name": "LocalizedName",
      "fields": [
        {
          "name": "lg",
          "number": 1,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "lc",
          "number": 2,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "verifiedName",
          "number": 3,
          "type": "string",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.BizAccountLinkInfo",
      "name": "BizAccountLinkInfo",
      "fields": [
        {
          "name": "whatsappBizAcctFbid",
          "number": 1,
          "type": "uint64",
          "label": "optional",
          "packed": false
        },
        {
          "name": "whatsappAcctNumber",
          "number": 2,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "issueTime",
          "number": 3,
          "type": "uint64",
          "label": "optional",
          "packed": false
        },
        {
          "name": "hostStorage",
          "number": 4,
          "type": "enum",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.BizAccountLinkInfo.HostStorageType"
        },
        {
          "name": "accountType",
          "number": 5,
          "type": "enum",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.BizAccountLinkInfo.AccountType"
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.BizAccountPayload",
      "name": "BizAccountPayload",
      "fields": [
        {
          "name": "vnameCert",
          "number": 1,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.VerifiedNameCertificate"
        },
        {
          "name": "bizAcctLinkInfo",
          "number": 2,
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
      "fullName": "corvus.BizAccountLinkInfo.HostStorageType",
      "name": "HostStorageType",
      "values": {
        "ON_PREMISE": 0,
        "FACEBOOK": 1
      }
    },
    {
      "fullName": "corvus.BizAccountLinkInfo.AccountType",
      "name": "AccountType",
      "values": {
        "ENTERPRISE": 0,
        "PAGE": 1
      }
    }
  ]
}
