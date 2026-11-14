export type BinaryNodeContent = string | Uint8Array | BinaryNode[]

export interface BinaryNode {
  tag: string
  attrs: Record<string, string>
  content?: BinaryNodeContent | undefined
}

/** Filter untuk mencocokkan node masuk. */
export interface NodeFilter {
  tag?: string
  attrs?: Record<string, string>
  /** Node harus punya child dengan tag ini. */
  child?: string
}

/** Tag penanda format biner. */
export const TAGS = {
  LIST_EMPTY: 0,
  STREAM_END: 2,
  DICTIONARY_0: 236,
  DICTIONARY_1: 237,
  DICTIONARY_2: 238,
  DICTIONARY_3: 239,
  INTEROP_JID: 245,
  FB_JID: 246,
  AD_JID: 247,
  LIST_8: 248,
  LIST_16: 249,
  JID_PAIR: 250,
  HEX_8: 251,
  BINARY_8: 252,
  BINARY_20: 253,
  BINARY_32: 254,
  NIBBLE_8: 255,
} as const

/** Panjang maksimum string yang boleh dipadatkan (nibble/hex). */
export const PACKED_MAX = 127

/** Nilai `domainType` pada AD_JID. */
export const JID_DOMAIN_TYPES = {
  's.whatsapp.net': 0,
  lid: 1,
  hosted: 128,
  'hosted.lid': 129,
} as const

export const MAX_NODE_DEPTH = 128

/** Codec node <-> bytes (satu instance terikat pada satu kamus token). */
export interface NodeCodec {
  encode(node: BinaryNode): Uint8Array
  decode(data: Uint8Array): BinaryNode
}
