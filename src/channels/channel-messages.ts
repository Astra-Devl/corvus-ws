import { ChannelError } from '../core/errors.js'
import { getChild, getChildren, getContentBytes } from '../protocol/binary-node.js'
import type { BinaryNode } from '../protocol/protocol-types.js'
import { S_WHATSAPP_NET } from '../protocol/stanza-builder.js'
import type { MessageCodec } from '../messages/message-parser.js'
import type { MessageContent } from '../messages/message-utils.js'
import { getMediaType } from '../messages/relay-message.js'
import { generateMessageId } from '../messages/message-key.js'
import { NEWSLETTER_SERVER } from '../utils/jid.js'
import type { ChannelMessage } from './channel-types.js'


export function assertChannelJid(jid: string): void {
  if (!jid.endsWith(`@${NEWSLETTER_SERVER}`)) throw new ChannelError(`Not a channel JID: ${jid}`)
}

/** Channel tidak dienkripsi E2E: isi dikirim sebagai `<plaintext>` (protobuf polos). */
export function buildChannelMessage(jid: string, content: MessageContent, codec: MessageCodec, id = generateMessageId()): BinaryNode {
  assertChannelJid(jid)
  const mediaType = getMediaType(content)
  return {
    tag: 'message',
    attrs: { to: jid, id, type: mediaType ? 'media' : 'text' },
    content: [{ tag: 'plaintext', attrs: mediaType ? { mediatype: mediaType } : {}, content: codec.encode(content) }],
  }
}

/** Reaksi pada pesan channel; `code` kosong menghapus reaksi. */
export function buildChannelReaction(jid: string, serverId: string, code?: string, id = generateMessageId()): BinaryNode {
  assertChannelJid(jid)
  if (!serverId) throw new ChannelError('serverId is required')
  return {
    tag: 'message',
    attrs: { to: jid, ...(code ? {} : { edit: '7' }), type: 'reaction', server_id: serverId, id },
    content: [{ tag: 'reaction', attrs: code ? { code } : {} }],
  }
}

/** Ambil pesan channel (`type`: 'jid' atau 'invite'). */
export function buildChannelMessagesQuery(
  type: 'jid' | 'invite',
  key: string,
  count: number,
  options: { after?: number } = {},
): BinaryNode {
  if (type === 'jid') assertChannelJid(key)
  if (!Number.isInteger(count) || count < 1 || count > 100) throw new ChannelError('count must be between 1 and 100')
  return {
    tag: 'iq',
    attrs: { to: S_WHATSAPP_NET, type: 'get', xmlns: 'newsletter' },
    content: [
      {
        tag: 'messages',
        attrs: { type, ...(type === 'invite' ? { key } : { jid: key }), count: String(count), ...(options.after !== undefined && { after: String(options.after) }) },
      },
    ],
  }
}

/** Minta pembaruan langsung (views/reaksi) untuk sebuah channel. */
export function buildLiveUpdates(jid: string): BinaryNode {
  assertChannelJid(jid)
  return { tag: 'iq', attrs: { to: jid, type: 'set', xmlns: 'newsletter' }, content: [{ tag: 'live_updates', attrs: {} }] }
}

/** Parse `<message>` channel (dari hasil fetch atau push) memakai codec pesan. */
export function parseChannelMessage(node: BinaryNode, channelJid: string, codec: MessageCodec): ChannelMessage | undefined {
  const serverId = node.attrs.server_id
  if (!serverId) return undefined

  const plaintext = getContentBytes(getChild(node, 'plaintext'))
  let message: Record<string, unknown> | undefined
  if (plaintext) {
    try {
      message = codec.decode(plaintext)
    } catch {
      message = undefined
    }
  }
  const reactions = getChild(node, 'reactions')
  const views = Number(getChild(node, 'views_count')?.attrs.count)
  const ts = Number(node.attrs.t)

  return {
    serverId,
    id: node.attrs.message_id ?? node.attrs.id,
    channelJid,
    timestamp: node.attrs.t !== undefined && Number.isFinite(ts) ? ts : undefined,
    message,
    views: Number.isFinite(views) ? views : undefined,
    reactions: reactions
      ? getChildren(reactions, 'reaction').map((r) => ({ code: r.attrs.code ?? '', count: Number(r.attrs.count ?? 0) }))
      : [],
  }
}

/** `<iq><messages jid=..><message server_id=../>...`. */
export function parseChannelMessages(result: BinaryNode, channelJid: string, codec: MessageCodec): ChannelMessage[] {
  const container = getChild(result, 'messages')
  if (!container) return []
  return getChildren(container, 'message')
    .map((n) => parseChannelMessage(n, container.attrs.jid ?? channelJid, codec))
    .filter((m): m is ChannelMessage => m !== undefined)
}
