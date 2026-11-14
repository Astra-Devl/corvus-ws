import { MessageError } from '../core/errors.js'
import type { CryptoEngine } from '../crypto/crypto-engine.js'
import { unpadRandomMax16 } from '../crypto/decryption.js'
import { jidToSignalAddress } from '../crypto/session.js'
import { getChildren } from '../protocol/binary-node.js'
import type { BinaryNode } from '../protocol/protocol-types.js'
import type { MessageKey } from './message-key.js'
import { isSameUser, jidKind, type MessageContent, type WAMessage } from './message-utils.js'

/** Encode/decode isi pesan <-> bytes (biasanya protobuf WAProto `Message`). */
export interface MessageCodec {
  encode(content: MessageContent): Uint8Array
  decode(bytes: Uint8Array): MessageContent
}

export interface EncNode {
  type: 'msg' | 'pkmsg' | 'skmsg'
  version: number
  ciphertext: Uint8Array
  mediaType?: string | undefined
}

export interface ParsedMessageNode {
  id: string
  /** Chat (grup) atau pengirim (1:1). */
  from: string
  participant?: string | undefined
  recipient?: string | undefined
  /** Pengirim sebenarnya (participant bila ada, kalau tidak `from`). */
  author: string
  isGroup: boolean
  isFromMe: boolean
  /** Epoch detik. */
  timestamp: number
  pushName?: string | undefined
  type?: string | undefined
  category?: string | undefined
  encs: EncNode[]
}

export function parseMessageNode(node: BinaryNode, ownJid?: string): ParsedMessageNode {
  if (node.tag !== 'message') throw new MessageError(`Expected <message>, got <${node.tag}>`)
  const { id, from, participant, recipient, t, notify, type, category } = node.attrs
  if (!id || !from) throw new MessageError('Message node is missing id/from')

  const encs: EncNode[] = []
  for (const enc of getChildren(node, 'enc')) {
    const kind = enc.attrs.type
    if ((kind !== 'msg' && kind !== 'pkmsg' && kind !== 'skmsg') || !(enc.content instanceof Uint8Array)) continue
    encs.push({
      type: kind,
      version: Number(enc.attrs.v ?? 2),
      ciphertext: enc.content,
      mediaType: enc.attrs.mediatype,
    })
  }

  const author = participant ?? from
  const ts = Number(t)
  return {
    id,
    from,
    participant,
    recipient,
    author,
    isGroup: jidKind(from) === 'group' || jidKind(from) === 'broadcast',
    isFromMe: ownJid !== undefined && isSameUser(author, ownJid),
    timestamp: Number.isFinite(ts) && t !== undefined ? ts : Math.floor(Date.now() / 1000),
    pushName: notify,
    type,
    category,
    encs,
  }
}

export function messageKeyOf(parsed: ParsedMessageNode): MessageKey {
  const remoteJid = parsed.isGroup ? parsed.from : parsed.isFromMe ? (parsed.recipient ?? parsed.from) : parsed.from
  return {
    remoteJid,
    fromMe: parsed.isFromMe,
    id: parsed.id,
    ...(parsed.isGroup && { participant: parsed.author }),
  }
}

export interface DecryptDeps {
  crypto: Pick<CryptoEngine, 'sessions' | 'senderKeys'>
  codec: MessageCodec
}

/**
 * Dekripsi semua `<enc>` pada pesan. Pesan yang hanya membawa distribusi
 * sender key menghasilkan `message: null`.
 */
export async function decryptMessageNode(parsed: ParsedMessageNode, deps: DecryptDeps): Promise<WAMessage> {
  const address = jidToSignalAddress(parsed.author)
  let content: MessageContent | undefined
  let lastError: unknown

  for (const enc of parsed.encs) {
    try {
      const plain =
        enc.type === 'skmsg'
          ? await deps.crypto.senderKeys.decrypt(`${parsed.from}::${address}`, enc.ciphertext)
          : await deps.crypto.sessions.decrypt(address, enc.type, enc.ciphertext)

      const decoded = deps.codec.decode(unpadRandomMax16(plain))
      const { senderKeyDistributionMessage: dist, ...rest } = decoded
      if (dist?.axolotlSenderKeyDistributionMessage) {
        await deps.crypto.senderKeys.processDistributionMessage(
          `${dist.groupId ?? parsed.from}::${address}`,
          dist.axolotlSenderKeyDistributionMessage,
        )
      }
      if (Object.keys(rest).some((k) => k !== 'messageContextInfo')) content = rest
    } catch (error) {
      lastError = error
    }
  }

  if (!content && lastError) {
    throw new MessageError(`Failed to decrypt message ${parsed.id}`, {
      cause: lastError,
      data: { id: parsed.id, from: parsed.from, author: parsed.author },
    })
  }

  return {
    key: messageKeyOf(parsed),
    message: content ?? null,
    messageTimestamp: parsed.timestamp,
    pushName: parsed.pushName,
    ...(parsed.isGroup && { participant: parsed.author }),
  }
}
