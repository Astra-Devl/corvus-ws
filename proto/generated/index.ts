// File ini dibuat otomatis oleh scripts/generate-proto.cjs dari proto/schemas/*.
// JANGAN DIEDIT — ubah file .proto lalu jalankan `npm run proto:generate`.
/* eslint-disable */
import type { FileDescriptor } from '../loader/proto-registry.js'
import { waDescriptor } from './wa.js'
import { waBusinessDescriptor } from './waBusiness.js'
import { waCallDescriptor } from './waCall.js'
import { waCommonDescriptor } from './waCommon.js'
import { waGroupDescriptor } from './waGroup.js'
import { waSyncDescriptor } from './waSync.js'
import { waNewsletterDescriptor } from './waNewsletter.js'
import { waMessageDescriptor } from './waMessage.js'
import { waWebDescriptor } from './waWeb.js'
import { waHistoryDescriptor } from './waHistory.js'
import { waMediaDescriptor } from './waMedia.js'
import type * as wa from './wa.js'
import type * as waBusiness from './waBusiness.js'
import type * as waCall from './waCall.js'
import type * as waCommon from './waCommon.js'
import type * as waGroup from './waGroup.js'
import type * as waSync from './waSync.js'
import type * as waNewsletter from './waNewsletter.js'
import type * as waMessage from './waMessage.js'
import type * as waWeb from './waWeb.js'
import type * as waHistory from './waHistory.js'
import type * as waMedia from './waMedia.js'

export * from './wa.js'
export * from './waBusiness.js'
export * from './waCall.js'
export * from './waCommon.js'
export * from './waGroup.js'
export * from './waSync.js'
export * from './waNewsletter.js'
export * from './waMessage.js'
export * from './waWeb.js'
export * from './waHistory.js'
export * from './waMedia.js'

export const PACKAGE = "corvus"

/** Semua file skema, dependensi lebih dulu. */
export const descriptors: readonly FileDescriptor[] = [waDescriptor, waBusinessDescriptor, waCallDescriptor, waCommonDescriptor, waGroupDescriptor, waSyncDescriptor, waNewsletterDescriptor, waMessageDescriptor, waWebDescriptor, waHistoryDescriptor, waMediaDescriptor]

/** Nama pendek (nama interface) -> nama lengkap di skema. */
export const PROTO_NAMES = {
  HandshakeMessage: "corvus.HandshakeMessage",
  HandshakeMessage_ClientHello: "corvus.HandshakeMessage.ClientHello",
  HandshakeMessage_ServerHello: "corvus.HandshakeMessage.ServerHello",
  HandshakeMessage_ClientFinish: "corvus.HandshakeMessage.ClientFinish",
  CertChain: "corvus.CertChain",
  CertChain_NoiseCertificate: "corvus.CertChain.NoiseCertificate",
  CertChain_NoiseCertificate_Details: "corvus.CertChain.NoiseCertificate.Details",
  ADVSignedDeviceIdentity: "corvus.ADVSignedDeviceIdentity",
  ADVSignedDeviceIdentityHMAC: "corvus.ADVSignedDeviceIdentityHMAC",
  ADVDeviceIdentity: "corvus.ADVDeviceIdentity",
  ADVKeyIndexList: "corvus.ADVKeyIndexList",
  ADVSignedKeyIndexList: "corvus.ADVSignedKeyIndexList",
  AppVersion: "corvus.AppVersion",
  ClientPayload: "corvus.ClientPayload",
  ClientPayload_UserAgent: "corvus.ClientPayload.UserAgent",
  ClientPayload_WebInfo: "corvus.ClientPayload.WebInfo",
  ClientPayload_DevicePairingRegistrationData: "corvus.ClientPayload.DevicePairingRegistrationData",
  DeviceProps: "corvus.DeviceProps",
  DeviceProps_HistorySyncConfig: "corvus.DeviceProps.HistorySyncConfig",
  SignalMessage: "corvus.SignalMessage",
  PreKeySignalMessage: "corvus.PreKeySignalMessage",
  SenderKeyMessage: "corvus.SenderKeyMessage",
  SignalSenderKeyDistributionMessage: "corvus.SignalSenderKeyDistributionMessage",
  VerifiedNameCertificate: "corvus.VerifiedNameCertificate",
  VerifiedNameCertificate_Details: "corvus.VerifiedNameCertificate.Details",
  LocalizedName: "corvus.LocalizedName",
  BizAccountLinkInfo: "corvus.BizAccountLinkInfo",
  BizAccountPayload: "corvus.BizAccountPayload",
  Call: "corvus.Call",
  MessageKey: "corvus.MessageKey",
  DeviceListMetadata: "corvus.DeviceListMetadata",
  MessageContextInfo: "corvus.MessageContextInfo",
  HistorySyncNotification: "corvus.HistorySyncNotification",
  Pushname: "corvus.Pushname",
  GroupParticipant: "corvus.GroupParticipant",
  PastParticipant: "corvus.PastParticipant",
  KeyId: "corvus.KeyId",
  AppStateSyncKeyId: "corvus.AppStateSyncKeyId",
  AppStateSyncKeyFingerprint: "corvus.AppStateSyncKeyFingerprint",
  AppStateSyncKeyData: "corvus.AppStateSyncKeyData",
  AppStateSyncKey: "corvus.AppStateSyncKey",
  AppStateSyncKeyShare: "corvus.AppStateSyncKeyShare",
  AppStateSyncKeyRequest: "corvus.AppStateSyncKeyRequest",
  SyncdVersion: "corvus.SyncdVersion",
  SyncdIndex: "corvus.SyncdIndex",
  SyncdValue: "corvus.SyncdValue",
  SyncdRecord: "corvus.SyncdRecord",
  SyncdMutation: "corvus.SyncdMutation",
  SyncdMutations: "corvus.SyncdMutations",
  ExternalBlobReference: "corvus.ExternalBlobReference",
  ExitCode: "corvus.ExitCode",
  SyncdPatch: "corvus.SyncdPatch",
  SyncdSnapshot: "corvus.SyncdSnapshot",
  SyncActionData: "corvus.SyncActionData",
  ForwardedNewsletterMessageInfo: "corvus.ForwardedNewsletterMessageInfo",
  Message: "corvus.Message",
  Message_SenderKeyDistributionMessage: "corvus.Message.SenderKeyDistributionMessage",
  FutureProofMessage: "corvus.FutureProofMessage",
  DeviceSentMessage: "corvus.DeviceSentMessage",
  ContextInfo: "corvus.ContextInfo",
  ContextInfo_ExternalAdReplyInfo: "corvus.ContextInfo.ExternalAdReplyInfo",
  ExtendedTextMessage: "corvus.ExtendedTextMessage",
  ImageMessage: "corvus.ImageMessage",
  VideoMessage: "corvus.VideoMessage",
  AudioMessage: "corvus.AudioMessage",
  DocumentMessage: "corvus.DocumentMessage",
  StickerMessage: "corvus.StickerMessage",
  LocationMessage: "corvus.LocationMessage",
  LiveLocationMessage: "corvus.LiveLocationMessage",
  ContactMessage: "corvus.ContactMessage",
  ContactsArrayMessage: "corvus.ContactsArrayMessage",
  GroupInviteMessage: "corvus.GroupInviteMessage",
  ReactionMessage: "corvus.ReactionMessage",
  KeepInChatMessage: "corvus.KeepInChatMessage",
  ProtocolMessage: "corvus.ProtocolMessage",
  PollCreationMessage: "corvus.PollCreationMessage",
  PollCreationMessage_Option: "corvus.PollCreationMessage.Option",
  PollUpdateMessage: "corvus.PollUpdateMessage",
  PollEncValue: "corvus.PollEncValue",
  PollUpdateMessageMetadata: "corvus.PollUpdateMessageMetadata",
  ButtonsMessage: "corvus.ButtonsMessage",
  ButtonsMessage_Button: "corvus.ButtonsMessage.Button",
  ButtonsMessage_Button_ButtonText: "corvus.ButtonsMessage.Button.ButtonText",
  ButtonsMessage_Button_NativeFlowInfo: "corvus.ButtonsMessage.Button.NativeFlowInfo",
  ButtonsResponseMessage: "corvus.ButtonsResponseMessage",
  ListMessage: "corvus.ListMessage",
  ListMessage_Section: "corvus.ListMessage.Section",
  ListMessage_Row: "corvus.ListMessage.Row",
  ListResponseMessage: "corvus.ListResponseMessage",
  ListResponseMessage_SingleSelectReply: "corvus.ListResponseMessage.SingleSelectReply",
  TemplateMessage: "corvus.TemplateMessage",
  TemplateMessage_HydratedFourRowTemplate: "corvus.TemplateMessage.HydratedFourRowTemplate",
  TemplateMessage_HydratedFourRowTemplate_HydratedTemplateButton: "corvus.TemplateMessage.HydratedFourRowTemplate.HydratedTemplateButton",
  TemplateMessage_HydratedFourRowTemplate_HydratedTemplateButton_HydratedQuickReplyButton: "corvus.TemplateMessage.HydratedFourRowTemplate.HydratedTemplateButton.HydratedQuickReplyButton",
  TemplateMessage_HydratedFourRowTemplate_HydratedTemplateButton_HydratedURLButton: "corvus.TemplateMessage.HydratedFourRowTemplate.HydratedTemplateButton.HydratedURLButton",
  TemplateMessage_HydratedFourRowTemplate_HydratedTemplateButton_HydratedCallButton: "corvus.TemplateMessage.HydratedFourRowTemplate.HydratedTemplateButton.HydratedCallButton",
  TemplateButtonReplyMessage: "corvus.TemplateButtonReplyMessage",
  InteractiveMessage: "corvus.InteractiveMessage",
  InteractiveMessage_Header: "corvus.InteractiveMessage.Header",
  InteractiveMessage_Body: "corvus.InteractiveMessage.Body",
  InteractiveMessage_Footer: "corvus.InteractiveMessage.Footer",
  InteractiveMessage_NativeFlowMessage: "corvus.InteractiveMessage.NativeFlowMessage",
  InteractiveMessage_NativeFlowMessage_NativeFlowButton: "corvus.InteractiveMessage.NativeFlowMessage.NativeFlowButton",
  InteractiveMessage_CarouselMessage: "corvus.InteractiveMessage.CarouselMessage",
  InteractiveResponseMessage: "corvus.InteractiveResponseMessage",
  InteractiveResponseMessage_Body: "corvus.InteractiveResponseMessage.Body",
  InteractiveResponseMessage_NativeFlowResponseMessage: "corvus.InteractiveResponseMessage.NativeFlowResponseMessage",
  WebMessageInfo: "corvus.WebMessageInfo",
  UserReceipt: "corvus.UserReceipt",
  Reaction: "corvus.Reaction",
  HistorySync: "corvus.HistorySync",
  HistorySyncMsg: "corvus.HistorySyncMsg",
  Conversation: "corvus.Conversation",
  MediaRetryNotification: "corvus.MediaRetryNotification",
  ServerErrorReceipt: "corvus.ServerErrorReceipt",
} as const

/** Nama pendek -> tipe TypeScript. */
export interface ProtoTypes {
  HandshakeMessage: wa.HandshakeMessage
  HandshakeMessage_ClientHello: wa.HandshakeMessage_ClientHello
  HandshakeMessage_ServerHello: wa.HandshakeMessage_ServerHello
  HandshakeMessage_ClientFinish: wa.HandshakeMessage_ClientFinish
  CertChain: wa.CertChain
  CertChain_NoiseCertificate: wa.CertChain_NoiseCertificate
  CertChain_NoiseCertificate_Details: wa.CertChain_NoiseCertificate_Details
  ADVSignedDeviceIdentity: wa.ADVSignedDeviceIdentity
  ADVSignedDeviceIdentityHMAC: wa.ADVSignedDeviceIdentityHMAC
  ADVDeviceIdentity: wa.ADVDeviceIdentity
  ADVKeyIndexList: wa.ADVKeyIndexList
  ADVSignedKeyIndexList: wa.ADVSignedKeyIndexList
  AppVersion: wa.AppVersion
  ClientPayload: wa.ClientPayload
  ClientPayload_UserAgent: wa.ClientPayload_UserAgent
  ClientPayload_WebInfo: wa.ClientPayload_WebInfo
  ClientPayload_DevicePairingRegistrationData: wa.ClientPayload_DevicePairingRegistrationData
  DeviceProps: wa.DeviceProps
  DeviceProps_HistorySyncConfig: wa.DeviceProps_HistorySyncConfig
  SignalMessage: wa.SignalMessage
  PreKeySignalMessage: wa.PreKeySignalMessage
  SenderKeyMessage: wa.SenderKeyMessage
  SignalSenderKeyDistributionMessage: wa.SignalSenderKeyDistributionMessage
  VerifiedNameCertificate: waBusiness.VerifiedNameCertificate
  VerifiedNameCertificate_Details: waBusiness.VerifiedNameCertificate_Details
  LocalizedName: waBusiness.LocalizedName
  BizAccountLinkInfo: waBusiness.BizAccountLinkInfo
  BizAccountPayload: waBusiness.BizAccountPayload
  Call: waCall.Call
  MessageKey: waCommon.MessageKey
  DeviceListMetadata: waCommon.DeviceListMetadata
  MessageContextInfo: waCommon.MessageContextInfo
  HistorySyncNotification: waCommon.HistorySyncNotification
  Pushname: waCommon.Pushname
  GroupParticipant: waGroup.GroupParticipant
  PastParticipant: waGroup.PastParticipant
  KeyId: waSync.KeyId
  AppStateSyncKeyId: waSync.AppStateSyncKeyId
  AppStateSyncKeyFingerprint: waSync.AppStateSyncKeyFingerprint
  AppStateSyncKeyData: waSync.AppStateSyncKeyData
  AppStateSyncKey: waSync.AppStateSyncKey
  AppStateSyncKeyShare: waSync.AppStateSyncKeyShare
  AppStateSyncKeyRequest: waSync.AppStateSyncKeyRequest
  SyncdVersion: waSync.SyncdVersion
  SyncdIndex: waSync.SyncdIndex
  SyncdValue: waSync.SyncdValue
  SyncdRecord: waSync.SyncdRecord
  SyncdMutation: waSync.SyncdMutation
  SyncdMutations: waSync.SyncdMutations
  ExternalBlobReference: waSync.ExternalBlobReference
  ExitCode: waSync.ExitCode
  SyncdPatch: waSync.SyncdPatch
  SyncdSnapshot: waSync.SyncdSnapshot
  SyncActionData: waSync.SyncActionData
  ForwardedNewsletterMessageInfo: waNewsletter.ForwardedNewsletterMessageInfo
  Message: waMessage.Message
  Message_SenderKeyDistributionMessage: waMessage.Message_SenderKeyDistributionMessage
  FutureProofMessage: waMessage.FutureProofMessage
  DeviceSentMessage: waMessage.DeviceSentMessage
  ContextInfo: waMessage.ContextInfo
  ContextInfo_ExternalAdReplyInfo: waMessage.ContextInfo_ExternalAdReplyInfo
  ExtendedTextMessage: waMessage.ExtendedTextMessage
  ImageMessage: waMessage.ImageMessage
  VideoMessage: waMessage.VideoMessage
  AudioMessage: waMessage.AudioMessage
  DocumentMessage: waMessage.DocumentMessage
  StickerMessage: waMessage.StickerMessage
  LocationMessage: waMessage.LocationMessage
  LiveLocationMessage: waMessage.LiveLocationMessage
  ContactMessage: waMessage.ContactMessage
  ContactsArrayMessage: waMessage.ContactsArrayMessage
  GroupInviteMessage: waMessage.GroupInviteMessage
  ReactionMessage: waMessage.ReactionMessage
  KeepInChatMessage: waMessage.KeepInChatMessage
  ProtocolMessage: waMessage.ProtocolMessage
  PollCreationMessage: waMessage.PollCreationMessage
  PollCreationMessage_Option: waMessage.PollCreationMessage_Option
  PollUpdateMessage: waMessage.PollUpdateMessage
  PollEncValue: waMessage.PollEncValue
  PollUpdateMessageMetadata: waMessage.PollUpdateMessageMetadata
  ButtonsMessage: waMessage.ButtonsMessage
  ButtonsMessage_Button: waMessage.ButtonsMessage_Button
  ButtonsMessage_Button_ButtonText: waMessage.ButtonsMessage_Button_ButtonText
  ButtonsMessage_Button_NativeFlowInfo: waMessage.ButtonsMessage_Button_NativeFlowInfo
  ButtonsResponseMessage: waMessage.ButtonsResponseMessage
  ListMessage: waMessage.ListMessage
  ListMessage_Section: waMessage.ListMessage_Section
  ListMessage_Row: waMessage.ListMessage_Row
  ListResponseMessage: waMessage.ListResponseMessage
  ListResponseMessage_SingleSelectReply: waMessage.ListResponseMessage_SingleSelectReply
  TemplateMessage: waMessage.TemplateMessage
  TemplateMessage_HydratedFourRowTemplate: waMessage.TemplateMessage_HydratedFourRowTemplate
  TemplateMessage_HydratedFourRowTemplate_HydratedTemplateButton: waMessage.TemplateMessage_HydratedFourRowTemplate_HydratedTemplateButton
  TemplateMessage_HydratedFourRowTemplate_HydratedTemplateButton_HydratedQuickReplyButton: waMessage.TemplateMessage_HydratedFourRowTemplate_HydratedTemplateButton_HydratedQuickReplyButton
  TemplateMessage_HydratedFourRowTemplate_HydratedTemplateButton_HydratedURLButton: waMessage.TemplateMessage_HydratedFourRowTemplate_HydratedTemplateButton_HydratedURLButton
  TemplateMessage_HydratedFourRowTemplate_HydratedTemplateButton_HydratedCallButton: waMessage.TemplateMessage_HydratedFourRowTemplate_HydratedTemplateButton_HydratedCallButton
  TemplateButtonReplyMessage: waMessage.TemplateButtonReplyMessage
  InteractiveMessage: waMessage.InteractiveMessage
  InteractiveMessage_Header: waMessage.InteractiveMessage_Header
  InteractiveMessage_Body: waMessage.InteractiveMessage_Body
  InteractiveMessage_Footer: waMessage.InteractiveMessage_Footer
  InteractiveMessage_NativeFlowMessage: waMessage.InteractiveMessage_NativeFlowMessage
  InteractiveMessage_NativeFlowMessage_NativeFlowButton: waMessage.InteractiveMessage_NativeFlowMessage_NativeFlowButton
  InteractiveMessage_CarouselMessage: waMessage.InteractiveMessage_CarouselMessage
  InteractiveResponseMessage: waMessage.InteractiveResponseMessage
  InteractiveResponseMessage_Body: waMessage.InteractiveResponseMessage_Body
  InteractiveResponseMessage_NativeFlowResponseMessage: waMessage.InteractiveResponseMessage_NativeFlowResponseMessage
  WebMessageInfo: waWeb.WebMessageInfo
  UserReceipt: waWeb.UserReceipt
  Reaction: waWeb.Reaction
  HistorySync: waHistory.HistorySync
  HistorySyncMsg: waHistory.HistorySyncMsg
  Conversation: waHistory.Conversation
  MediaRetryNotification: waMedia.MediaRetryNotification
  ServerErrorReceipt: waMedia.ServerErrorReceipt
}

export type ProtoTypeName = keyof ProtoTypes
