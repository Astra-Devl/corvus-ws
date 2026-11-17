// File ini dibuat otomatis oleh scripts/generate-proto.cjs dari proto/schemas/waMessage.proto.
// JANGAN DIEDIT — ubah file .proto lalu jalankan `npm run proto:generate`.
/* eslint-disable */
import type { FileDescriptor } from '../loader/proto-registry.js'
import type { Call } from './waCall.js'
import type { HistorySyncNotification, MessageContextInfo, MessageKey } from './waCommon.js'
import type { ForwardedNewsletterMessageInfo } from './waNewsletter.js'
import type { AppStateSyncKeyRequest, AppStateSyncKeyShare } from './waSync.js'

export const ContextInfo_ExternalAdReplyInfo_MediaType = {
  NONE: 0,
  IMAGE: 1,
  VIDEO: 2,
} as const
export type ContextInfo_ExternalAdReplyInfo_MediaType = (typeof ContextInfo_ExternalAdReplyInfo_MediaType)[keyof typeof ContextInfo_ExternalAdReplyInfo_MediaType]

export const ExtendedTextMessage_FontType = {
  SANS_SERIF: 0,
  SERIF: 1,
  NORICAN_REGULAR: 2,
  BRYNDAN_WRITE: 3,
  BEBASNEUE_REGULAR: 4,
  OSWALD_HEAVY: 5,
} as const
export type ExtendedTextMessage_FontType = (typeof ExtendedTextMessage_FontType)[keyof typeof ExtendedTextMessage_FontType]

export const ExtendedTextMessage_PreviewType = {
  NONE: 0,
  VIDEO: 1,
  PLACEHOLDER: 4,
  IMAGE: 5,
} as const
export type ExtendedTextMessage_PreviewType = (typeof ExtendedTextMessage_PreviewType)[keyof typeof ExtendedTextMessage_PreviewType]

export const VideoMessage_GifAttribution = {
  NONE: 0,
  GIPHY: 1,
  TENOR: 2,
} as const
export type VideoMessage_GifAttribution = (typeof VideoMessage_GifAttribution)[keyof typeof VideoMessage_GifAttribution]

export const KeepInChatMessage_KeepType = {
  UNKNOWN: 0,
  KEEP_FOR_ALL: 1,
  UNDO_KEEP_FOR_ALL: 2,
} as const
export type KeepInChatMessage_KeepType = (typeof KeepInChatMessage_KeepType)[keyof typeof KeepInChatMessage_KeepType]

export const ProtocolMessage_Type = {
  REVOKE: 0,
  EPHEMERAL_SETTING: 3,
  EPHEMERAL_SYNC_RESPONSE: 4,
  HISTORY_SYNC_NOTIFICATION: 5,
  APP_STATE_SYNC_KEY_SHARE: 6,
  APP_STATE_SYNC_KEY_REQUEST: 7,
  MSG_FANOUT_BACKFILL_REQUEST: 8,
  INITIAL_SECURITY_NOTIFICATION_SETTING_SYNC: 9,
  APP_STATE_FATAL_EXCEPTION_NOTIFICATION: 10,
  SHARE_PHONE_NUMBER: 11,
  MESSAGE_EDIT: 14,
} as const
export type ProtocolMessage_Type = (typeof ProtocolMessage_Type)[keyof typeof ProtocolMessage_Type]

export const ButtonsMessage_HeaderType = {
  UNKNOWN: 0,
  EMPTY: 1,
  TEXT: 2,
  DOCUMENT: 3,
  IMAGE: 4,
  VIDEO: 5,
  LOCATION: 6,
} as const
export type ButtonsMessage_HeaderType = (typeof ButtonsMessage_HeaderType)[keyof typeof ButtonsMessage_HeaderType]

export const ButtonsMessage_Button_Type = {
  UNKNOWN: 0,
  RESPONSE: 1,
  NATIVE_FLOW: 2,
} as const
export type ButtonsMessage_Button_Type = (typeof ButtonsMessage_Button_Type)[keyof typeof ButtonsMessage_Button_Type]

export const ButtonsResponseMessage_Type = {
  UNKNOWN: 0,
  DISPLAY_TEXT: 1,
} as const
export type ButtonsResponseMessage_Type = (typeof ButtonsResponseMessage_Type)[keyof typeof ButtonsResponseMessage_Type]

export const ListMessage_ListType = {
  UNKNOWN: 0,
  SINGLE_SELECT: 1,
  PRODUCT_LIST: 2,
} as const
export type ListMessage_ListType = (typeof ListMessage_ListType)[keyof typeof ListMessage_ListType]

export const ListResponseMessage_ListType = {
  UNKNOWN: 0,
  SINGLE_SELECT: 1,
} as const
export type ListResponseMessage_ListType = (typeof ListResponseMessage_ListType)[keyof typeof ListResponseMessage_ListType]

export const InteractiveResponseMessage_Body_Format = {
  DEFAULT: 0,
  EXTENSIONS_1: 1,
} as const
export type InteractiveResponseMessage_Body_Format = (typeof InteractiveResponseMessage_Body_Format)[keyof typeof InteractiveResponseMessage_Body_Format]

export interface Message {
  conversation?: string | null
  senderKeyDistributionMessage?: Message_SenderKeyDistributionMessage | null
  imageMessage?: ImageMessage | null
  contactMessage?: ContactMessage | null
  locationMessage?: LocationMessage | null
  extendedTextMessage?: ExtendedTextMessage | null
  documentMessage?: DocumentMessage | null
  audioMessage?: AudioMessage | null
  videoMessage?: VideoMessage | null
  call?: Call | null
  protocolMessage?: ProtocolMessage | null
  contactsArrayMessage?: ContactsArrayMessage | null
  liveLocationMessage?: LiveLocationMessage | null
  templateMessage?: TemplateMessage | null
  stickerMessage?: StickerMessage | null
  groupInviteMessage?: GroupInviteMessage | null
  templateButtonReplyMessage?: TemplateButtonReplyMessage | null
  deviceSentMessage?: DeviceSentMessage | null
  messageContextInfo?: MessageContextInfo | null
  listMessage?: ListMessage | null
  viewOnceMessage?: FutureProofMessage | null
  listResponseMessage?: ListResponseMessage | null
  ephemeralMessage?: FutureProofMessage | null
  buttonsMessage?: ButtonsMessage | null
  buttonsResponseMessage?: ButtonsResponseMessage | null
  interactiveMessage?: InteractiveMessage | null
  reactionMessage?: ReactionMessage | null
  interactiveResponseMessage?: InteractiveResponseMessage | null
  pollCreationMessage?: PollCreationMessage | null
  pollUpdateMessage?: PollUpdateMessage | null
  keepInChatMessage?: KeepInChatMessage | null
  documentWithCaptionMessage?: FutureProofMessage | null
  viewOnceMessageV2?: FutureProofMessage | null
  editedMessage?: FutureProofMessage | null
  viewOnceMessageV2Extension?: FutureProofMessage | null
}

export interface Message_SenderKeyDistributionMessage {
  groupId?: string | null
  axolotlSenderKeyDistributionMessage?: Uint8Array | null
}

export interface FutureProofMessage {
  message?: Message | null
}

export interface DeviceSentMessage {
  destinationJid?: string | null
  message?: Message | null
  phash?: string | null
}

export interface ContextInfo {
  stanzaId?: string | null
  participant?: string | null
  quotedMessage?: Message | null
  remoteJid?: string | null
  mentionedJid?: Array<string> | null
  conversionSource?: string | null
  conversionData?: Uint8Array | null
  conversionDelaySeconds?: number | null
  forwardingScore?: number | null
  isForwarded?: boolean | null
  placeholderKey?: MessageKey | null
  expiration?: number | null
  ephemeralSettingTimestamp?: number | bigint | null
  ephemeralSharedSecret?: Uint8Array | null
  externalAdReply?: ContextInfo_ExternalAdReplyInfo | null
  groupSubject?: string | null
  parentGroupJid?: string | null
  forwardedNewsletterMessageInfo?: ForwardedNewsletterMessageInfo | null
}

export interface ContextInfo_ExternalAdReplyInfo {
  title?: string | null
  body?: string | null
  mediaType?: number | null
  thumbnailUrl?: string | null
  mediaUrl?: string | null
  thumbnail?: Uint8Array | null
  sourceType?: string | null
  sourceId?: string | null
  sourceUrl?: string | null
  containsAutoReply?: boolean | null
  renderLargerThumbnail?: boolean | null
  showAdAttribution?: boolean | null
}

export interface ExtendedTextMessage {
  text?: string | null
  matchedText?: string | null
  canonicalUrl?: string | null
  description?: string | null
  title?: string | null
  textArgb?: number | null
  backgroundArgb?: number | null
  font?: number | null
  previewType?: number | null
  jpegThumbnail?: Uint8Array | null
  contextInfo?: ContextInfo | null
  doNotPlayInline?: boolean | null
  thumbnailDirectPath?: string | null
  thumbnailSha256?: Uint8Array | null
  thumbnailEncSha256?: Uint8Array | null
  mediaKey?: Uint8Array | null
  mediaKeyTimestamp?: number | bigint | null
  thumbnailHeight?: number | null
  thumbnailWidth?: number | null
}

export interface ImageMessage {
  url?: string | null
  mimetype?: string | null
  caption?: string | null
  fileSha256?: Uint8Array | null
  fileLength?: number | bigint | null
  height?: number | null
  width?: number | null
  mediaKey?: Uint8Array | null
  fileEncSha256?: Uint8Array | null
  directPath?: string | null
  mediaKeyTimestamp?: number | bigint | null
  jpegThumbnail?: Uint8Array | null
  contextInfo?: ContextInfo | null
  viewOnce?: boolean | null
  thumbnailDirectPath?: string | null
  thumbnailSha256?: Uint8Array | null
  thumbnailEncSha256?: Uint8Array | null
  staticUrl?: string | null
}

export interface VideoMessage {
  url?: string | null
  mimetype?: string | null
  fileSha256?: Uint8Array | null
  fileLength?: number | bigint | null
  seconds?: number | null
  mediaKey?: Uint8Array | null
  caption?: string | null
  gifPlayback?: boolean | null
  height?: number | null
  width?: number | null
  fileEncSha256?: Uint8Array | null
  directPath?: string | null
  mediaKeyTimestamp?: number | bigint | null
  jpegThumbnail?: Uint8Array | null
  contextInfo?: ContextInfo | null
  streamingSidecar?: Uint8Array | null
  gifAttribution?: number | null
  viewOnce?: boolean | null
  thumbnailDirectPath?: string | null
  thumbnailSha256?: Uint8Array | null
  thumbnailEncSha256?: Uint8Array | null
  staticUrl?: string | null
}

export interface AudioMessage {
  url?: string | null
  mimetype?: string | null
  fileSha256?: Uint8Array | null
  fileLength?: number | bigint | null
  seconds?: number | null
  ptt?: boolean | null
  mediaKey?: Uint8Array | null
  fileEncSha256?: Uint8Array | null
  directPath?: string | null
  mediaKeyTimestamp?: number | bigint | null
  contextInfo?: ContextInfo | null
  streamingSidecar?: Uint8Array | null
  waveform?: Uint8Array | null
  backgroundArgb?: number | null
  viewOnce?: boolean | null
}

export interface DocumentMessage {
  url?: string | null
  mimetype?: string | null
  title?: string | null
  fileSha256?: Uint8Array | null
  fileLength?: number | bigint | null
  pageCount?: number | null
  mediaKey?: Uint8Array | null
  fileName?: string | null
  fileEncSha256?: Uint8Array | null
  directPath?: string | null
  mediaKeyTimestamp?: number | bigint | null
  contactVcard?: string | null
  thumbnailDirectPath?: string | null
  thumbnailSha256?: Uint8Array | null
  thumbnailEncSha256?: Uint8Array | null
  jpegThumbnail?: Uint8Array | null
  contextInfo?: ContextInfo | null
  thumbnailHeight?: number | null
  thumbnailWidth?: number | null
  caption?: string | null
}

export interface StickerMessage {
  url?: string | null
  fileSha256?: Uint8Array | null
  fileEncSha256?: Uint8Array | null
  mediaKey?: Uint8Array | null
  mimetype?: string | null
  height?: number | null
  width?: number | null
  directPath?: string | null
  fileLength?: number | bigint | null
  mediaKeyTimestamp?: number | bigint | null
  firstFrameLength?: number | null
  firstFrameSidecar?: Uint8Array | null
  isAnimated?: boolean | null
  pngThumbnail?: Uint8Array | null
  contextInfo?: ContextInfo | null
  stickerSentTs?: number | bigint | null
  isAvatar?: boolean | null
}

export interface LocationMessage {
  degreesLatitude?: number | null
  degreesLongitude?: number | null
  name?: string | null
  address?: string | null
  url?: string | null
  isLive?: boolean | null
  accuracyInMeters?: number | null
  speedInMps?: number | null
  degreesClockwiseFromMagneticNorth?: number | null
  comment?: string | null
  jpegThumbnail?: Uint8Array | null
  contextInfo?: ContextInfo | null
}

export interface LiveLocationMessage {
  degreesLatitude?: number | null
  degreesLongitude?: number | null
  accuracyInMeters?: number | null
  speedInMps?: number | null
  degreesClockwiseFromMagneticNorth?: number | null
  caption?: string | null
  sequenceNumber?: number | bigint | null
  timeOffset?: number | null
  jpegThumbnail?: Uint8Array | null
  contextInfo?: ContextInfo | null
}

export interface ContactMessage {
  displayName?: string | null
  vcard?: string | null
  contextInfo?: ContextInfo | null
}

export interface ContactsArrayMessage {
  displayName?: string | null
  contacts?: Array<ContactMessage> | null
  contextInfo?: ContextInfo | null
}

export interface GroupInviteMessage {
  groupJid?: string | null
  inviteCode?: string | null
  inviteExpiration?: number | bigint | null
  groupName?: string | null
  jpegThumbnail?: Uint8Array | null
  caption?: string | null
  contextInfo?: ContextInfo | null
}

export interface ReactionMessage {
  key?: MessageKey | null
  text?: string | null
  groupingKey?: string | null
  senderTimestampMs?: number | bigint | null
}

export interface KeepInChatMessage {
  key?: MessageKey | null
  keepType?: number | null
  timestampMs?: number | bigint | null
}

export interface ProtocolMessage {
  key?: MessageKey | null
  type?: number | null
  ephemeralExpiration?: number | null
  ephemeralSettingTimestamp?: number | bigint | null
  historySyncNotification?: HistorySyncNotification | null
  appStateSyncKeyShare?: AppStateSyncKeyShare | null
  appStateSyncKeyRequest?: AppStateSyncKeyRequest | null
  editedMessage?: Message | null
  timestampMs?: number | bigint | null
}

export interface PollCreationMessage {
  encKey?: Uint8Array | null
  name?: string | null
  options?: Array<PollCreationMessage_Option> | null
  selectableOptionsCount?: number | null
  contextInfo?: ContextInfo | null
}

export interface PollCreationMessage_Option {
  optionName?: string | null
  optionHash?: string | null
}

export interface PollUpdateMessage {
  pollCreationMessageKey?: MessageKey | null
  vote?: PollEncValue | null
  metadata?: PollUpdateMessageMetadata | null
  senderTimestampMs?: number | bigint | null
}

export interface PollEncValue {
  encPayload?: Uint8Array | null
  encIv?: Uint8Array | null
}

export interface PollUpdateMessageMetadata {

}

export interface ButtonsMessage {
  text?: string | null // oneof header
  documentMessage?: DocumentMessage | null // oneof header
  imageMessage?: ImageMessage | null // oneof header
  videoMessage?: VideoMessage | null // oneof header
  locationMessage?: LocationMessage | null // oneof header
  contentText?: string | null
  footerText?: string | null
  contextInfo?: ContextInfo | null
  buttons?: Array<ButtonsMessage_Button> | null
  headerType?: number | null
}

export interface ButtonsMessage_Button {
  buttonId?: string | null
  buttonText?: ButtonsMessage_Button_ButtonText | null
  type?: number | null
  nativeFlowInfo?: ButtonsMessage_Button_NativeFlowInfo | null
}

export interface ButtonsMessage_Button_ButtonText {
  displayText?: string | null
}

export interface ButtonsMessage_Button_NativeFlowInfo {
  name?: string | null
  paramsJson?: string | null
}

export interface ButtonsResponseMessage {
  selectedButtonId?: string | null
  selectedDisplayText?: string | null // oneof response
  contextInfo?: ContextInfo | null
  type?: number | null
}

export interface ListMessage {
  title?: string | null
  description?: string | null
  buttonText?: string | null
  listType?: number | null
  sections?: Array<ListMessage_Section> | null
  footerText?: string | null
  contextInfo?: ContextInfo | null
}

export interface ListMessage_Section {
  title?: string | null
  rows?: Array<ListMessage_Row> | null
}

export interface ListMessage_Row {
  title?: string | null
  description?: string | null
  rowId?: string | null
}

export interface ListResponseMessage {
  title?: string | null
  listType?: number | null
  singleSelectReply?: ListResponseMessage_SingleSelectReply | null
  contextInfo?: ContextInfo | null
  description?: string | null
}

export interface ListResponseMessage_SingleSelectReply {
  selectedRowId?: string | null
}

export interface TemplateMessage {
  contextInfo?: ContextInfo | null
  hydratedTemplate?: TemplateMessage_HydratedFourRowTemplate | null
  templateId?: string | null
  hydratedFourRowTemplate?: TemplateMessage_HydratedFourRowTemplate | null // oneof format
  interactiveMessageTemplate?: InteractiveMessage | null // oneof format
}

export interface TemplateMessage_HydratedFourRowTemplate {
  documentMessage?: DocumentMessage | null // oneof title
  hydratedTitleText?: string | null // oneof title
  imageMessage?: ImageMessage | null // oneof title
  videoMessage?: VideoMessage | null // oneof title
  locationMessage?: LocationMessage | null // oneof title
  hydratedContentText?: string | null
  hydratedFooterText?: string | null
  hydratedButtons?: Array<TemplateMessage_HydratedFourRowTemplate_HydratedTemplateButton> | null
  templateId?: string | null
}

export interface TemplateMessage_HydratedFourRowTemplate_HydratedTemplateButton {
  index?: number | null
  quickReplyButton?: TemplateMessage_HydratedFourRowTemplate_HydratedTemplateButton_HydratedQuickReplyButton | null // oneof hydratedButton
  urlButton?: TemplateMessage_HydratedFourRowTemplate_HydratedTemplateButton_HydratedURLButton | null // oneof hydratedButton
  callButton?: TemplateMessage_HydratedFourRowTemplate_HydratedTemplateButton_HydratedCallButton | null // oneof hydratedButton
}

export interface TemplateMessage_HydratedFourRowTemplate_HydratedTemplateButton_HydratedQuickReplyButton {
  displayText?: string | null
  id?: string | null
}

export interface TemplateMessage_HydratedFourRowTemplate_HydratedTemplateButton_HydratedURLButton {
  displayText?: string | null
  url?: string | null
}

export interface TemplateMessage_HydratedFourRowTemplate_HydratedTemplateButton_HydratedCallButton {
  displayText?: string | null
  phoneNumber?: string | null
}

export interface TemplateButtonReplyMessage {
  selectedId?: string | null
  selectedDisplayText?: string | null
  contextInfo?: ContextInfo | null
  selectedIndex?: number | null
  selectedCarouselCardIndex?: number | null
}

export interface InteractiveMessage {
  header?: InteractiveMessage_Header | null
  body?: InteractiveMessage_Body | null
  footer?: InteractiveMessage_Footer | null
  contextInfo?: ContextInfo | null
  nativeFlowMessage?: InteractiveMessage_NativeFlowMessage | null // oneof interactiveMessage
  carouselMessage?: InteractiveMessage_CarouselMessage | null // oneof interactiveMessage
}

export interface InteractiveMessage_Header {
  title?: string | null
  subtitle?: string | null
  hasMediaAttachment?: boolean | null
  documentMessage?: DocumentMessage | null // oneof media
  imageMessage?: ImageMessage | null // oneof media
  jpegThumbnail?: Uint8Array | null // oneof media
  videoMessage?: VideoMessage | null // oneof media
  locationMessage?: LocationMessage | null // oneof media
}

export interface InteractiveMessage_Body {
  text?: string | null
}

export interface InteractiveMessage_Footer {
  text?: string | null
}

export interface InteractiveMessage_NativeFlowMessage {
  buttons?: Array<InteractiveMessage_NativeFlowMessage_NativeFlowButton> | null
  messageParamsJson?: string | null
  messageVersion?: number | null
}

export interface InteractiveMessage_NativeFlowMessage_NativeFlowButton {
  name?: string | null
  buttonParamsJson?: string | null
}

export interface InteractiveMessage_CarouselMessage {
  cards?: Array<InteractiveMessage> | null
  messageVersion?: number | null
}

export interface InteractiveResponseMessage {
  body?: InteractiveResponseMessage_Body | null
  contextInfo?: ContextInfo | null
  nativeFlowResponseMessage?: InteractiveResponseMessage_NativeFlowResponseMessage | null // oneof interactiveResponseMessage
}

export interface InteractiveResponseMessage_Body {
  text?: string | null
  format?: number | null
}

export interface InteractiveResponseMessage_NativeFlowResponseMessage {
  name?: string | null
  paramsJson?: string | null
  version?: number | null
}

export const waMessageDescriptor: FileDescriptor = {
  "name": "waMessage.proto",
  "package": "corvus",
  "syntax": "proto2",
  "imports": [
    "waCommon.proto",
    "waCall.proto",
    "waSync.proto",
    "waNewsletter.proto"
  ],
  "messages": [
    {
      "fullName": "corvus.Message",
      "name": "Message",
      "fields": [
        {
          "name": "conversation",
          "number": 1,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "senderKeyDistributionMessage",
          "number": 2,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.Message.SenderKeyDistributionMessage"
        },
        {
          "name": "imageMessage",
          "number": 3,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ImageMessage"
        },
        {
          "name": "contactMessage",
          "number": 4,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ContactMessage"
        },
        {
          "name": "locationMessage",
          "number": 5,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.LocationMessage"
        },
        {
          "name": "extendedTextMessage",
          "number": 6,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ExtendedTextMessage"
        },
        {
          "name": "documentMessage",
          "number": 7,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.DocumentMessage"
        },
        {
          "name": "audioMessage",
          "number": 8,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.AudioMessage"
        },
        {
          "name": "videoMessage",
          "number": 9,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.VideoMessage"
        },
        {
          "name": "call",
          "number": 10,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.Call"
        },
        {
          "name": "protocolMessage",
          "number": 12,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ProtocolMessage"
        },
        {
          "name": "contactsArrayMessage",
          "number": 13,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ContactsArrayMessage"
        },
        {
          "name": "liveLocationMessage",
          "number": 18,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.LiveLocationMessage"
        },
        {
          "name": "templateMessage",
          "number": 25,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.TemplateMessage"
        },
        {
          "name": "stickerMessage",
          "number": 26,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.StickerMessage"
        },
        {
          "name": "groupInviteMessage",
          "number": 28,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.GroupInviteMessage"
        },
        {
          "name": "templateButtonReplyMessage",
          "number": 29,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.TemplateButtonReplyMessage"
        },
        {
          "name": "deviceSentMessage",
          "number": 31,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.DeviceSentMessage"
        },
        {
          "name": "messageContextInfo",
          "number": 35,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.MessageContextInfo"
        },
        {
          "name": "listMessage",
          "number": 36,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ListMessage"
        },
        {
          "name": "viewOnceMessage",
          "number": 37,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.FutureProofMessage"
        },
        {
          "name": "listResponseMessage",
          "number": 39,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ListResponseMessage"
        },
        {
          "name": "ephemeralMessage",
          "number": 40,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.FutureProofMessage"
        },
        {
          "name": "buttonsMessage",
          "number": 42,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ButtonsMessage"
        },
        {
          "name": "buttonsResponseMessage",
          "number": 43,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ButtonsResponseMessage"
        },
        {
          "name": "interactiveMessage",
          "number": 45,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.InteractiveMessage"
        },
        {
          "name": "reactionMessage",
          "number": 46,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ReactionMessage"
        },
        {
          "name": "interactiveResponseMessage",
          "number": 48,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.InteractiveResponseMessage"
        },
        {
          "name": "pollCreationMessage",
          "number": 49,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.PollCreationMessage"
        },
        {
          "name": "pollUpdateMessage",
          "number": 50,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.PollUpdateMessage"
        },
        {
          "name": "keepInChatMessage",
          "number": 51,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.KeepInChatMessage"
        },
        {
          "name": "documentWithCaptionMessage",
          "number": 53,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.FutureProofMessage"
        },
        {
          "name": "viewOnceMessageV2",
          "number": 55,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.FutureProofMessage"
        },
        {
          "name": "editedMessage",
          "number": 58,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.FutureProofMessage"
        },
        {
          "name": "viewOnceMessageV2Extension",
          "number": 59,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.FutureProofMessage"
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.Message.SenderKeyDistributionMessage",
      "name": "SenderKeyDistributionMessage",
      "fields": [
        {
          "name": "groupId",
          "number": 1,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "axolotlSenderKeyDistributionMessage",
          "number": 2,
          "type": "bytes",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.FutureProofMessage",
      "name": "FutureProofMessage",
      "fields": [
        {
          "name": "message",
          "number": 1,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.Message"
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.DeviceSentMessage",
      "name": "DeviceSentMessage",
      "fields": [
        {
          "name": "destinationJid",
          "number": 1,
          "type": "string",
          "label": "optional",
          "packed": false
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
          "name": "phash",
          "number": 3,
          "type": "string",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.ContextInfo",
      "name": "ContextInfo",
      "fields": [
        {
          "name": "stanzaId",
          "number": 1,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "participant",
          "number": 2,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "quotedMessage",
          "number": 3,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.Message"
        },
        {
          "name": "remoteJid",
          "number": 4,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "mentionedJid",
          "number": 15,
          "type": "string",
          "label": "repeated",
          "packed": false
        },
        {
          "name": "conversionSource",
          "number": 18,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "conversionData",
          "number": 19,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "conversionDelaySeconds",
          "number": 20,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "forwardingScore",
          "number": 21,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "isForwarded",
          "number": 22,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "placeholderKey",
          "number": 24,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.MessageKey"
        },
        {
          "name": "expiration",
          "number": 25,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "ephemeralSettingTimestamp",
          "number": 26,
          "type": "int64",
          "label": "optional",
          "packed": false
        },
        {
          "name": "ephemeralSharedSecret",
          "number": 27,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "externalAdReply",
          "number": 28,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ContextInfo.ExternalAdReplyInfo"
        },
        {
          "name": "groupSubject",
          "number": 34,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "parentGroupJid",
          "number": 35,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "forwardedNewsletterMessageInfo",
          "number": 43,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ForwardedNewsletterMessageInfo"
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.ContextInfo.ExternalAdReplyInfo",
      "name": "ExternalAdReplyInfo",
      "fields": [
        {
          "name": "title",
          "number": 1,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "body",
          "number": 2,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "mediaType",
          "number": 3,
          "type": "enum",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ContextInfo.ExternalAdReplyInfo.MediaType"
        },
        {
          "name": "thumbnailUrl",
          "number": 4,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "mediaUrl",
          "number": 5,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "thumbnail",
          "number": 6,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "sourceType",
          "number": 7,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "sourceId",
          "number": 8,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "sourceUrl",
          "number": 9,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "containsAutoReply",
          "number": 10,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "renderLargerThumbnail",
          "number": 11,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "showAdAttribution",
          "number": 12,
          "type": "bool",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.ExtendedTextMessage",
      "name": "ExtendedTextMessage",
      "fields": [
        {
          "name": "text",
          "number": 1,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "matchedText",
          "number": 2,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "canonicalUrl",
          "number": 4,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "description",
          "number": 5,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "title",
          "number": 6,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "textArgb",
          "number": 7,
          "type": "fixed32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "backgroundArgb",
          "number": 8,
          "type": "fixed32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "font",
          "number": 9,
          "type": "enum",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ExtendedTextMessage.FontType"
        },
        {
          "name": "previewType",
          "number": 10,
          "type": "enum",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ExtendedTextMessage.PreviewType"
        },
        {
          "name": "jpegThumbnail",
          "number": 16,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "contextInfo",
          "number": 17,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ContextInfo"
        },
        {
          "name": "doNotPlayInline",
          "number": 18,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "thumbnailDirectPath",
          "number": 19,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "thumbnailSha256",
          "number": 20,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "thumbnailEncSha256",
          "number": 21,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "mediaKey",
          "number": 22,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "mediaKeyTimestamp",
          "number": 23,
          "type": "int64",
          "label": "optional",
          "packed": false
        },
        {
          "name": "thumbnailHeight",
          "number": 24,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "thumbnailWidth",
          "number": 25,
          "type": "uint32",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.ImageMessage",
      "name": "ImageMessage",
      "fields": [
        {
          "name": "url",
          "number": 1,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "mimetype",
          "number": 2,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "caption",
          "number": 3,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "fileSha256",
          "number": 4,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "fileLength",
          "number": 5,
          "type": "uint64",
          "label": "optional",
          "packed": false
        },
        {
          "name": "height",
          "number": 6,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "width",
          "number": 7,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "mediaKey",
          "number": 8,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "fileEncSha256",
          "number": 9,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "directPath",
          "number": 11,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "mediaKeyTimestamp",
          "number": 12,
          "type": "int64",
          "label": "optional",
          "packed": false
        },
        {
          "name": "jpegThumbnail",
          "number": 16,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "contextInfo",
          "number": 17,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ContextInfo"
        },
        {
          "name": "viewOnce",
          "number": 25,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "thumbnailDirectPath",
          "number": 26,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "thumbnailSha256",
          "number": 27,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "thumbnailEncSha256",
          "number": 28,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "staticUrl",
          "number": 29,
          "type": "string",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.VideoMessage",
      "name": "VideoMessage",
      "fields": [
        {
          "name": "url",
          "number": 1,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "mimetype",
          "number": 2,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "fileSha256",
          "number": 3,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "fileLength",
          "number": 4,
          "type": "uint64",
          "label": "optional",
          "packed": false
        },
        {
          "name": "seconds",
          "number": 5,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "mediaKey",
          "number": 6,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "caption",
          "number": 7,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "gifPlayback",
          "number": 8,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "height",
          "number": 9,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "width",
          "number": 10,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "fileEncSha256",
          "number": 11,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "directPath",
          "number": 13,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "mediaKeyTimestamp",
          "number": 14,
          "type": "int64",
          "label": "optional",
          "packed": false
        },
        {
          "name": "jpegThumbnail",
          "number": 16,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "contextInfo",
          "number": 17,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ContextInfo"
        },
        {
          "name": "streamingSidecar",
          "number": 18,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "gifAttribution",
          "number": 19,
          "type": "enum",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.VideoMessage.GifAttribution"
        },
        {
          "name": "viewOnce",
          "number": 20,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "thumbnailDirectPath",
          "number": 21,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "thumbnailSha256",
          "number": 22,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "thumbnailEncSha256",
          "number": 23,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "staticUrl",
          "number": 24,
          "type": "string",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.AudioMessage",
      "name": "AudioMessage",
      "fields": [
        {
          "name": "url",
          "number": 1,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "mimetype",
          "number": 2,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "fileSha256",
          "number": 3,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "fileLength",
          "number": 4,
          "type": "uint64",
          "label": "optional",
          "packed": false
        },
        {
          "name": "seconds",
          "number": 5,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "ptt",
          "number": 6,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "mediaKey",
          "number": 7,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "fileEncSha256",
          "number": 8,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "directPath",
          "number": 9,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "mediaKeyTimestamp",
          "number": 10,
          "type": "int64",
          "label": "optional",
          "packed": false
        },
        {
          "name": "contextInfo",
          "number": 17,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ContextInfo"
        },
        {
          "name": "streamingSidecar",
          "number": 18,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "waveform",
          "number": 19,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "backgroundArgb",
          "number": 20,
          "type": "fixed32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "viewOnce",
          "number": 21,
          "type": "bool",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.DocumentMessage",
      "name": "DocumentMessage",
      "fields": [
        {
          "name": "url",
          "number": 1,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "mimetype",
          "number": 2,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "title",
          "number": 3,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "fileSha256",
          "number": 4,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "fileLength",
          "number": 5,
          "type": "uint64",
          "label": "optional",
          "packed": false
        },
        {
          "name": "pageCount",
          "number": 6,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "mediaKey",
          "number": 7,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "fileName",
          "number": 8,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "fileEncSha256",
          "number": 9,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "directPath",
          "number": 10,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "mediaKeyTimestamp",
          "number": 11,
          "type": "int64",
          "label": "optional",
          "packed": false
        },
        {
          "name": "contactVcard",
          "number": 12,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "thumbnailDirectPath",
          "number": 13,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "thumbnailSha256",
          "number": 14,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "thumbnailEncSha256",
          "number": 15,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "jpegThumbnail",
          "number": 16,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "contextInfo",
          "number": 17,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ContextInfo"
        },
        {
          "name": "thumbnailHeight",
          "number": 18,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "thumbnailWidth",
          "number": 19,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "caption",
          "number": 20,
          "type": "string",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.StickerMessage",
      "name": "StickerMessage",
      "fields": [
        {
          "name": "url",
          "number": 1,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "fileSha256",
          "number": 2,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "fileEncSha256",
          "number": 3,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "mediaKey",
          "number": 4,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "mimetype",
          "number": 5,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "height",
          "number": 6,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "width",
          "number": 7,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "directPath",
          "number": 8,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "fileLength",
          "number": 9,
          "type": "uint64",
          "label": "optional",
          "packed": false
        },
        {
          "name": "mediaKeyTimestamp",
          "number": 10,
          "type": "int64",
          "label": "optional",
          "packed": false
        },
        {
          "name": "firstFrameLength",
          "number": 11,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "firstFrameSidecar",
          "number": 12,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "isAnimated",
          "number": 13,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "pngThumbnail",
          "number": 16,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "contextInfo",
          "number": 17,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ContextInfo"
        },
        {
          "name": "stickerSentTs",
          "number": 18,
          "type": "int64",
          "label": "optional",
          "packed": false
        },
        {
          "name": "isAvatar",
          "number": 19,
          "type": "bool",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.LocationMessage",
      "name": "LocationMessage",
      "fields": [
        {
          "name": "degreesLatitude",
          "number": 1,
          "type": "double",
          "label": "optional",
          "packed": false
        },
        {
          "name": "degreesLongitude",
          "number": 2,
          "type": "double",
          "label": "optional",
          "packed": false
        },
        {
          "name": "name",
          "number": 3,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "address",
          "number": 4,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "url",
          "number": 5,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "isLive",
          "number": 6,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "accuracyInMeters",
          "number": 7,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "speedInMps",
          "number": 8,
          "type": "float",
          "label": "optional",
          "packed": false
        },
        {
          "name": "degreesClockwiseFromMagneticNorth",
          "number": 9,
          "type": "int32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "comment",
          "number": 11,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "jpegThumbnail",
          "number": 16,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "contextInfo",
          "number": 17,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ContextInfo"
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.LiveLocationMessage",
      "name": "LiveLocationMessage",
      "fields": [
        {
          "name": "degreesLatitude",
          "number": 1,
          "type": "double",
          "label": "optional",
          "packed": false
        },
        {
          "name": "degreesLongitude",
          "number": 2,
          "type": "double",
          "label": "optional",
          "packed": false
        },
        {
          "name": "accuracyInMeters",
          "number": 3,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "speedInMps",
          "number": 4,
          "type": "float",
          "label": "optional",
          "packed": false
        },
        {
          "name": "degreesClockwiseFromMagneticNorth",
          "number": 5,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "caption",
          "number": 6,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "sequenceNumber",
          "number": 7,
          "type": "int64",
          "label": "optional",
          "packed": false
        },
        {
          "name": "timeOffset",
          "number": 8,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "jpegThumbnail",
          "number": 16,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "contextInfo",
          "number": 17,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ContextInfo"
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.ContactMessage",
      "name": "ContactMessage",
      "fields": [
        {
          "name": "displayName",
          "number": 1,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "vcard",
          "number": 16,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "contextInfo",
          "number": 17,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ContextInfo"
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.ContactsArrayMessage",
      "name": "ContactsArrayMessage",
      "fields": [
        {
          "name": "displayName",
          "number": 1,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "contacts",
          "number": 2,
          "type": "message",
          "label": "repeated",
          "packed": false,
          "typeName": "corvus.ContactMessage"
        },
        {
          "name": "contextInfo",
          "number": 17,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ContextInfo"
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.GroupInviteMessage",
      "name": "GroupInviteMessage",
      "fields": [
        {
          "name": "groupJid",
          "number": 1,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "inviteCode",
          "number": 2,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "inviteExpiration",
          "number": 3,
          "type": "int64",
          "label": "optional",
          "packed": false
        },
        {
          "name": "groupName",
          "number": 4,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "jpegThumbnail",
          "number": 5,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "caption",
          "number": 6,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "contextInfo",
          "number": 7,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ContextInfo"
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.ReactionMessage",
      "name": "ReactionMessage",
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
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.KeepInChatMessage",
      "name": "KeepInChatMessage",
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
          "name": "keepType",
          "number": 2,
          "type": "enum",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.KeepInChatMessage.KeepType"
        },
        {
          "name": "timestampMs",
          "number": 3,
          "type": "int64",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.ProtocolMessage",
      "name": "ProtocolMessage",
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
          "name": "type",
          "number": 2,
          "type": "enum",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ProtocolMessage.Type"
        },
        {
          "name": "ephemeralExpiration",
          "number": 4,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "ephemeralSettingTimestamp",
          "number": 5,
          "type": "int64",
          "label": "optional",
          "packed": false
        },
        {
          "name": "historySyncNotification",
          "number": 6,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.HistorySyncNotification"
        },
        {
          "name": "appStateSyncKeyShare",
          "number": 7,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.AppStateSyncKeyShare"
        },
        {
          "name": "appStateSyncKeyRequest",
          "number": 8,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.AppStateSyncKeyRequest"
        },
        {
          "name": "editedMessage",
          "number": 14,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.Message"
        },
        {
          "name": "timestampMs",
          "number": 15,
          "type": "int64",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.PollCreationMessage",
      "name": "PollCreationMessage",
      "fields": [
        {
          "name": "encKey",
          "number": 1,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "name",
          "number": 2,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "options",
          "number": 3,
          "type": "message",
          "label": "repeated",
          "packed": false,
          "typeName": "corvus.PollCreationMessage.Option"
        },
        {
          "name": "selectableOptionsCount",
          "number": 4,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "contextInfo",
          "number": 5,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ContextInfo"
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.PollCreationMessage.Option",
      "name": "Option",
      "fields": [
        {
          "name": "optionName",
          "number": 1,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "optionHash",
          "number": 2,
          "type": "string",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.PollUpdateMessage",
      "name": "PollUpdateMessage",
      "fields": [
        {
          "name": "pollCreationMessageKey",
          "number": 1,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.MessageKey"
        },
        {
          "name": "vote",
          "number": 2,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.PollEncValue"
        },
        {
          "name": "metadata",
          "number": 3,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.PollUpdateMessageMetadata"
        },
        {
          "name": "senderTimestampMs",
          "number": 4,
          "type": "int64",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.PollEncValue",
      "name": "PollEncValue",
      "fields": [
        {
          "name": "encPayload",
          "number": 1,
          "type": "bytes",
          "label": "optional",
          "packed": false
        },
        {
          "name": "encIv",
          "number": 2,
          "type": "bytes",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.PollUpdateMessageMetadata",
      "name": "PollUpdateMessageMetadata",
      "fields": [],
      "oneofs": []
    },
    {
      "fullName": "corvus.ButtonsMessage",
      "name": "ButtonsMessage",
      "fields": [
        {
          "name": "text",
          "number": 1,
          "type": "string",
          "label": "optional",
          "packed": false,
          "oneof": "header"
        },
        {
          "name": "documentMessage",
          "number": 2,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.DocumentMessage",
          "oneof": "header"
        },
        {
          "name": "imageMessage",
          "number": 3,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ImageMessage",
          "oneof": "header"
        },
        {
          "name": "videoMessage",
          "number": 4,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.VideoMessage",
          "oneof": "header"
        },
        {
          "name": "locationMessage",
          "number": 5,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.LocationMessage",
          "oneof": "header"
        },
        {
          "name": "contentText",
          "number": 6,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "footerText",
          "number": 7,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "contextInfo",
          "number": 8,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ContextInfo"
        },
        {
          "name": "buttons",
          "number": 9,
          "type": "message",
          "label": "repeated",
          "packed": false,
          "typeName": "corvus.ButtonsMessage.Button"
        },
        {
          "name": "headerType",
          "number": 10,
          "type": "enum",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ButtonsMessage.HeaderType"
        }
      ],
      "oneofs": [
        "header"
      ]
    },
    {
      "fullName": "corvus.ButtonsMessage.Button",
      "name": "Button",
      "fields": [
        {
          "name": "buttonId",
          "number": 1,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "buttonText",
          "number": 2,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ButtonsMessage.Button.ButtonText"
        },
        {
          "name": "type",
          "number": 3,
          "type": "enum",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ButtonsMessage.Button.Type"
        },
        {
          "name": "nativeFlowInfo",
          "number": 4,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ButtonsMessage.Button.NativeFlowInfo"
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.ButtonsMessage.Button.ButtonText",
      "name": "ButtonText",
      "fields": [
        {
          "name": "displayText",
          "number": 1,
          "type": "string",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.ButtonsMessage.Button.NativeFlowInfo",
      "name": "NativeFlowInfo",
      "fields": [
        {
          "name": "name",
          "number": 1,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "paramsJson",
          "number": 2,
          "type": "string",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.ButtonsResponseMessage",
      "name": "ButtonsResponseMessage",
      "fields": [
        {
          "name": "selectedButtonId",
          "number": 1,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "selectedDisplayText",
          "number": 2,
          "type": "string",
          "label": "optional",
          "packed": false,
          "oneof": "response"
        },
        {
          "name": "contextInfo",
          "number": 3,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ContextInfo"
        },
        {
          "name": "type",
          "number": 4,
          "type": "enum",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ButtonsResponseMessage.Type"
        }
      ],
      "oneofs": [
        "response"
      ]
    },
    {
      "fullName": "corvus.ListMessage",
      "name": "ListMessage",
      "fields": [
        {
          "name": "title",
          "number": 1,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "description",
          "number": 2,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "buttonText",
          "number": 3,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "listType",
          "number": 4,
          "type": "enum",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ListMessage.ListType"
        },
        {
          "name": "sections",
          "number": 5,
          "type": "message",
          "label": "repeated",
          "packed": false,
          "typeName": "corvus.ListMessage.Section"
        },
        {
          "name": "footerText",
          "number": 7,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "contextInfo",
          "number": 8,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ContextInfo"
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.ListMessage.Section",
      "name": "Section",
      "fields": [
        {
          "name": "title",
          "number": 1,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "rows",
          "number": 2,
          "type": "message",
          "label": "repeated",
          "packed": false,
          "typeName": "corvus.ListMessage.Row"
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.ListMessage.Row",
      "name": "Row",
      "fields": [
        {
          "name": "title",
          "number": 1,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "description",
          "number": 2,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "rowId",
          "number": 3,
          "type": "string",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.ListResponseMessage",
      "name": "ListResponseMessage",
      "fields": [
        {
          "name": "title",
          "number": 1,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "listType",
          "number": 2,
          "type": "enum",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ListResponseMessage.ListType"
        },
        {
          "name": "singleSelectReply",
          "number": 3,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ListResponseMessage.SingleSelectReply"
        },
        {
          "name": "contextInfo",
          "number": 4,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ContextInfo"
        },
        {
          "name": "description",
          "number": 5,
          "type": "string",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.ListResponseMessage.SingleSelectReply",
      "name": "SingleSelectReply",
      "fields": [
        {
          "name": "selectedRowId",
          "number": 1,
          "type": "string",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.TemplateMessage",
      "name": "TemplateMessage",
      "fields": [
        {
          "name": "contextInfo",
          "number": 3,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ContextInfo"
        },
        {
          "name": "hydratedTemplate",
          "number": 4,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.TemplateMessage.HydratedFourRowTemplate"
        },
        {
          "name": "templateId",
          "number": 9,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "hydratedFourRowTemplate",
          "number": 2,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.TemplateMessage.HydratedFourRowTemplate",
          "oneof": "format"
        },
        {
          "name": "interactiveMessageTemplate",
          "number": 5,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.InteractiveMessage",
          "oneof": "format"
        }
      ],
      "oneofs": [
        "format"
      ]
    },
    {
      "fullName": "corvus.TemplateMessage.HydratedFourRowTemplate",
      "name": "HydratedFourRowTemplate",
      "fields": [
        {
          "name": "documentMessage",
          "number": 1,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.DocumentMessage",
          "oneof": "title"
        },
        {
          "name": "hydratedTitleText",
          "number": 2,
          "type": "string",
          "label": "optional",
          "packed": false,
          "oneof": "title"
        },
        {
          "name": "imageMessage",
          "number": 3,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ImageMessage",
          "oneof": "title"
        },
        {
          "name": "videoMessage",
          "number": 4,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.VideoMessage",
          "oneof": "title"
        },
        {
          "name": "locationMessage",
          "number": 5,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.LocationMessage",
          "oneof": "title"
        },
        {
          "name": "hydratedContentText",
          "number": 6,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "hydratedFooterText",
          "number": 7,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "hydratedButtons",
          "number": 8,
          "type": "message",
          "label": "repeated",
          "packed": false,
          "typeName": "corvus.TemplateMessage.HydratedFourRowTemplate.HydratedTemplateButton"
        },
        {
          "name": "templateId",
          "number": 9,
          "type": "string",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": [
        "title"
      ]
    },
    {
      "fullName": "corvus.TemplateMessage.HydratedFourRowTemplate.HydratedTemplateButton",
      "name": "HydratedTemplateButton",
      "fields": [
        {
          "name": "index",
          "number": 4,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "quickReplyButton",
          "number": 1,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.TemplateMessage.HydratedFourRowTemplate.HydratedTemplateButton.HydratedQuickReplyButton",
          "oneof": "hydratedButton"
        },
        {
          "name": "urlButton",
          "number": 2,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.TemplateMessage.HydratedFourRowTemplate.HydratedTemplateButton.HydratedURLButton",
          "oneof": "hydratedButton"
        },
        {
          "name": "callButton",
          "number": 3,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.TemplateMessage.HydratedFourRowTemplate.HydratedTemplateButton.HydratedCallButton",
          "oneof": "hydratedButton"
        }
      ],
      "oneofs": [
        "hydratedButton"
      ]
    },
    {
      "fullName": "corvus.TemplateMessage.HydratedFourRowTemplate.HydratedTemplateButton.HydratedQuickReplyButton",
      "name": "HydratedQuickReplyButton",
      "fields": [
        {
          "name": "displayText",
          "number": 1,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "id",
          "number": 2,
          "type": "string",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.TemplateMessage.HydratedFourRowTemplate.HydratedTemplateButton.HydratedURLButton",
      "name": "HydratedURLButton",
      "fields": [
        {
          "name": "displayText",
          "number": 1,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "url",
          "number": 2,
          "type": "string",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.TemplateMessage.HydratedFourRowTemplate.HydratedTemplateButton.HydratedCallButton",
      "name": "HydratedCallButton",
      "fields": [
        {
          "name": "displayText",
          "number": 1,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "phoneNumber",
          "number": 2,
          "type": "string",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.TemplateButtonReplyMessage",
      "name": "TemplateButtonReplyMessage",
      "fields": [
        {
          "name": "selectedId",
          "number": 1,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "selectedDisplayText",
          "number": 2,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "contextInfo",
          "number": 3,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ContextInfo"
        },
        {
          "name": "selectedIndex",
          "number": 4,
          "type": "uint32",
          "label": "optional",
          "packed": false
        },
        {
          "name": "selectedCarouselCardIndex",
          "number": 5,
          "type": "uint32",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.InteractiveMessage",
      "name": "InteractiveMessage",
      "fields": [
        {
          "name": "header",
          "number": 1,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.InteractiveMessage.Header"
        },
        {
          "name": "body",
          "number": 2,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.InteractiveMessage.Body"
        },
        {
          "name": "footer",
          "number": 3,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.InteractiveMessage.Footer"
        },
        {
          "name": "contextInfo",
          "number": 15,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ContextInfo"
        },
        {
          "name": "nativeFlowMessage",
          "number": 6,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.InteractiveMessage.NativeFlowMessage",
          "oneof": "interactiveMessage"
        },
        {
          "name": "carouselMessage",
          "number": 7,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.InteractiveMessage.CarouselMessage",
          "oneof": "interactiveMessage"
        }
      ],
      "oneofs": [
        "interactiveMessage"
      ]
    },
    {
      "fullName": "corvus.InteractiveMessage.Header",
      "name": "Header",
      "fields": [
        {
          "name": "title",
          "number": 1,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "subtitle",
          "number": 2,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "hasMediaAttachment",
          "number": 5,
          "type": "bool",
          "label": "optional",
          "packed": false
        },
        {
          "name": "documentMessage",
          "number": 3,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.DocumentMessage",
          "oneof": "media"
        },
        {
          "name": "imageMessage",
          "number": 4,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ImageMessage",
          "oneof": "media"
        },
        {
          "name": "jpegThumbnail",
          "number": 6,
          "type": "bytes",
          "label": "optional",
          "packed": false,
          "oneof": "media"
        },
        {
          "name": "videoMessage",
          "number": 7,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.VideoMessage",
          "oneof": "media"
        },
        {
          "name": "locationMessage",
          "number": 8,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.LocationMessage",
          "oneof": "media"
        }
      ],
      "oneofs": [
        "media"
      ]
    },
    {
      "fullName": "corvus.InteractiveMessage.Body",
      "name": "Body",
      "fields": [
        {
          "name": "text",
          "number": 1,
          "type": "string",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.InteractiveMessage.Footer",
      "name": "Footer",
      "fields": [
        {
          "name": "text",
          "number": 1,
          "type": "string",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.InteractiveMessage.NativeFlowMessage",
      "name": "NativeFlowMessage",
      "fields": [
        {
          "name": "buttons",
          "number": 1,
          "type": "message",
          "label": "repeated",
          "packed": false,
          "typeName": "corvus.InteractiveMessage.NativeFlowMessage.NativeFlowButton"
        },
        {
          "name": "messageParamsJson",
          "number": 2,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "messageVersion",
          "number": 3,
          "type": "int32",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.InteractiveMessage.NativeFlowMessage.NativeFlowButton",
      "name": "NativeFlowButton",
      "fields": [
        {
          "name": "name",
          "number": 1,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "buttonParamsJson",
          "number": 2,
          "type": "string",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.InteractiveMessage.CarouselMessage",
      "name": "CarouselMessage",
      "fields": [
        {
          "name": "cards",
          "number": 1,
          "type": "message",
          "label": "repeated",
          "packed": false,
          "typeName": "corvus.InteractiveMessage"
        },
        {
          "name": "messageVersion",
          "number": 2,
          "type": "int32",
          "label": "optional",
          "packed": false
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.InteractiveResponseMessage",
      "name": "InteractiveResponseMessage",
      "fields": [
        {
          "name": "body",
          "number": 1,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.InteractiveResponseMessage.Body"
        },
        {
          "name": "contextInfo",
          "number": 15,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.ContextInfo"
        },
        {
          "name": "nativeFlowResponseMessage",
          "number": 2,
          "type": "message",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.InteractiveResponseMessage.NativeFlowResponseMessage",
          "oneof": "interactiveResponseMessage"
        }
      ],
      "oneofs": [
        "interactiveResponseMessage"
      ]
    },
    {
      "fullName": "corvus.InteractiveResponseMessage.Body",
      "name": "Body",
      "fields": [
        {
          "name": "text",
          "number": 1,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "format",
          "number": 2,
          "type": "enum",
          "label": "optional",
          "packed": false,
          "typeName": "corvus.InteractiveResponseMessage.Body.Format"
        }
      ],
      "oneofs": []
    },
    {
      "fullName": "corvus.InteractiveResponseMessage.NativeFlowResponseMessage",
      "name": "NativeFlowResponseMessage",
      "fields": [
        {
          "name": "name",
          "number": 1,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "paramsJson",
          "number": 2,
          "type": "string",
          "label": "optional",
          "packed": false
        },
        {
          "name": "version",
          "number": 3,
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
      "fullName": "corvus.ContextInfo.ExternalAdReplyInfo.MediaType",
      "name": "MediaType",
      "values": {
        "NONE": 0,
        "IMAGE": 1,
        "VIDEO": 2
      }
    },
    {
      "fullName": "corvus.ExtendedTextMessage.FontType",
      "name": "FontType",
      "values": {
        "SANS_SERIF": 0,
        "SERIF": 1,
        "NORICAN_REGULAR": 2,
        "BRYNDAN_WRITE": 3,
        "BEBASNEUE_REGULAR": 4,
        "OSWALD_HEAVY": 5
      }
    },
    {
      "fullName": "corvus.ExtendedTextMessage.PreviewType",
      "name": "PreviewType",
      "values": {
        "NONE": 0,
        "VIDEO": 1,
        "PLACEHOLDER": 4,
        "IMAGE": 5
      }
    },
    {
      "fullName": "corvus.VideoMessage.GifAttribution",
      "name": "GifAttribution",
      "values": {
        "NONE": 0,
        "GIPHY": 1,
        "TENOR": 2
      }
    },
    {
      "fullName": "corvus.KeepInChatMessage.KeepType",
      "name": "KeepType",
      "values": {
        "UNKNOWN": 0,
        "KEEP_FOR_ALL": 1,
        "UNDO_KEEP_FOR_ALL": 2
      }
    },
    {
      "fullName": "corvus.ProtocolMessage.Type",
      "name": "Type",
      "values": {
        "REVOKE": 0,
        "EPHEMERAL_SETTING": 3,
        "EPHEMERAL_SYNC_RESPONSE": 4,
        "HISTORY_SYNC_NOTIFICATION": 5,
        "APP_STATE_SYNC_KEY_SHARE": 6,
        "APP_STATE_SYNC_KEY_REQUEST": 7,
        "MSG_FANOUT_BACKFILL_REQUEST": 8,
        "INITIAL_SECURITY_NOTIFICATION_SETTING_SYNC": 9,
        "APP_STATE_FATAL_EXCEPTION_NOTIFICATION": 10,
        "SHARE_PHONE_NUMBER": 11,
        "MESSAGE_EDIT": 14
      }
    },
    {
      "fullName": "corvus.ButtonsMessage.HeaderType",
      "name": "HeaderType",
      "values": {
        "UNKNOWN": 0,
        "EMPTY": 1,
        "TEXT": 2,
        "DOCUMENT": 3,
        "IMAGE": 4,
        "VIDEO": 5,
        "LOCATION": 6
      }
    },
    {
      "fullName": "corvus.ButtonsMessage.Button.Type",
      "name": "Type",
      "values": {
        "UNKNOWN": 0,
        "RESPONSE": 1,
        "NATIVE_FLOW": 2
      }
    },
    {
      "fullName": "corvus.ButtonsResponseMessage.Type",
      "name": "Type",
      "values": {
        "UNKNOWN": 0,
        "DISPLAY_TEXT": 1
      }
    },
    {
      "fullName": "corvus.ListMessage.ListType",
      "name": "ListType",
      "values": {
        "UNKNOWN": 0,
        "SINGLE_SELECT": 1,
        "PRODUCT_LIST": 2
      }
    },
    {
      "fullName": "corvus.ListResponseMessage.ListType",
      "name": "ListType",
      "values": {
        "UNKNOWN": 0,
        "SINGLE_SELECT": 1
      }
    },
    {
      "fullName": "corvus.InteractiveResponseMessage.Body.Format",
      "name": "Format",
      "values": {
        "DEFAULT": 0,
        "EXTENSIONS_1": 1
      }
    }
  ]
}
