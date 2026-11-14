import { getChildren } from '../protocol/binary-node.js'
import type { BinaryNode } from '../protocol/protocol-types.js'
import type { MessageKey } from './message-key.js'
import { MessageStatus, receiptTypeToStatus } from './message-status.js'
import type { UserReceipt } from './message-utils.js'

export type ReceiptType = 'read' | 'read-self' | 'played' | 'sender' | 'hist_sync' | (string & {}) | undefined

export interface BuildReceiptOptions {
  jid: string
  participant?: string
  messageIds: readonly string[]
  /** `undefined` = tanda terkirim (delivery). */
  type?: ReceiptType
  /** Epoch detik. */
  timestamp?: number
}

/** `<receipt id to [participant] [type] t><list><item id/>...</list></receipt>` */
export function buildReceiptNode(options: BuildReceiptOptions): BinaryNode {
  const [first, ...rest] = options.messageIds
  if (first === undefined) throw new Error('At least one message id is required')

  const attrs: Record<string, string> = {
    id: first,
    to: options.jid,
    t: String(options.timestamp ?? Math.floor(Date.now() / 1000)),
  }
  if (options.participant) attrs.participant = options.participant
  if (options.type) attrs.type = options.type

  return rest.length === 0
    ? { tag: 'receipt', attrs }
    : {
        tag: 'receipt',
        attrs,
        content: [{ tag: 'list', attrs: {}, content: rest.map((id) => ({ tag: 'item', attrs: { id } })) }],
      }
}

/** Kelompokkan kunci per chat/pengirim menjadi node receipt "read". */
export function buildReadReceipts(keys: readonly MessageKey[], timestamp?: number): BinaryNode[] {
  const groups = new Map<string, { jid: string; participant: string | undefined; ids: string[] }>()
  for (const key of keys) {
    if (key.fromMe) continue
    const id = `${key.remoteJid}|${key.participant ?? ''}`
    const group = groups.get(id) ?? { jid: key.remoteJid, participant: key.participant, ids: [] }
    group.ids.push(key.id)
    groups.set(id, group)
  }
  return [...groups.values()].map((g) =>
    buildReceiptNode({
      jid: g.jid,
      messageIds: g.ids,
      type: 'read',
      ...(g.participant && { participant: g.participant }),
      ...(timestamp !== undefined && { timestamp }),
    }),
  )
}

export interface ParsedReceipt {
  /** Chat tempat pesan berada. */
  jid: string
  /** Penerima yang mengirim receipt (peserta grup, atau lawan bicara). */
  userJid: string
  type: string | undefined
  status: MessageStatus | undefined
  ids: string[]
  timestamp: number | undefined
  isGroup: boolean
}

export function parseReceiptNode(node: BinaryNode): ParsedReceipt {
  const { from = '', participant, type, id, t } = node.attrs
  const extra = getChildren(node, 'list').flatMap((l) => getChildren(l, 'item').map((i) => i.attrs.id))
  const ts = t === undefined ? undefined : Number(t)

  return {
    jid: from,
    userJid: participant ?? from,
    type,
    status: receiptTypeToStatus(type),
    ids: [...(id ? [id] : []), ...extra.filter((x): x is string => x !== undefined)],
    timestamp: ts !== undefined && Number.isFinite(ts) ? ts : undefined,
    isGroup: from.endsWith('@g.us') || from.endsWith('@broadcast'),
  }
}

export interface ReceiptUpdates {
  /** Perubahan status pesan milik kita (untuk chat 1:1). */
  statusUpdates: Array<{ key: MessageKey; update: { status: MessageStatus } }>
  /** Receipt per-penerima (grup, atau tambahan di 1:1). */
  receipts: Array<{ key: MessageKey; receipt: UserReceipt }>
}

/** Ubah receipt masuk menjadi pembaruan untuk store/event. */
export function receiptToUpdates(parsed: ParsedReceipt): ReceiptUpdates {
  const result: ReceiptUpdates = { statusUpdates: [], receipts: [] }
  for (const id of parsed.ids) {
    const key: MessageKey = { remoteJid: parsed.jid, fromMe: true, id }
    if (parsed.status !== undefined && !parsed.isGroup) {
      result.statusUpdates.push({ key, update: { status: parsed.status } })
    }
    const receipt: UserReceipt = { userJid: parsed.userJid }
    if (parsed.status === MessageStatus.DELIVERY_ACK) receipt.receiptTimestamp = parsed.timestamp
    else if (parsed.status === MessageStatus.READ) receipt.readTimestamp = parsed.timestamp
    else if (parsed.status === MessageStatus.PLAYED) receipt.playedTimestamp = parsed.timestamp
    result.receipts.push({ key, receipt })
  }
  return result
}
