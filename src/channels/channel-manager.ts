import { ChannelError } from '../core/errors.js'
import type { BinaryNode } from '../protocol/protocol-types.js'
import { getChild, getContentString } from '../protocol/binary-node.js'
import { S_WHATSAPP_NET } from '../protocol/stanza-builder.js'
import type { MessageCodec } from '../messages/message-parser.js'
import type { MessageContent } from '../messages/message-utils.js'
import {
  assertChannelJid,
  buildChannelMessage,
  buildChannelMessagesQuery,
  buildChannelReaction,
  buildLiveUpdates,
  parseChannelMessages,
} from './channel-messages.js'
import type { ChannelMessage, ChannelMetadata, ChannelOperation, ChannelQueryIds, ReactionCodes } from './channel-types.js'

export interface MexResult {
  data?: Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any
  errors?: Array<{ message?: string; extensions?: { error_code?: number } }>
}

/** Query GraphQL-over-IQ (`w:mex`). */
export function buildMexQuery(queryId: string, variables: Record<string, unknown>, id: string): BinaryNode {
  return {
    tag: 'iq',
    attrs: { id, type: 'get', to: S_WHATSAPP_NET, xmlns: 'w:mex' },
    content: [{ tag: 'query', attrs: { query_id: queryId }, content: Buffer.from(JSON.stringify({ variables }), 'utf8') }],
  }
}

export function parseMexResult(result: BinaryNode): MexResult {
  const text = getContentString(getChild(result, 'result'))
  if (!text) throw new ChannelError('Empty mex response')
  let parsed: MexResult
  try {
    parsed = JSON.parse(text) as MexResult
  } catch (cause) {
    throw new ChannelError('Invalid mex response', { cause })
  }
  const first = parsed.errors?.[0]
  if (first) {
    throw new ChannelError(first.message ?? 'mex query failed', { statusCode: first.extensions?.error_code ?? 400, data: { errors: parsed.errors } })
  }
  return parsed
}

/**
 * Ekstrak metadata channel dari respons mex secara longgar (nama field mengikuti
 * respons GraphQL WhatsApp dan bisa berubah).
 */
export function extractChannelMetadata(node: Record<string, any> | undefined): ChannelMetadata | undefined { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!node?.id) return undefined
  const thread = node.thread_metadata ?? {}
  const viewer = node.viewer_metadata ?? {}
  const created = Number(thread.creation_time)
  const subscribers = Number(thread.subscribers_count)
  return {
    id: node.id,
    name: thread.name?.text,
    description: thread.description?.text,
    invite: thread.invite,
    subscribers: Number.isFinite(subscribers) ? subscribers : undefined,
    verified: thread.verification === 'VERIFIED',
    createdAt: Number.isFinite(created) ? created : undefined,
    pictureDirectPath: thread.picture?.direct_path,
    state: node.state?.type,
    role: viewer.role,
    muted: viewer.mute === undefined ? undefined : viewer.mute === 'ON',
  }
}

export interface ChannelManagerOptions {
  query: (node: BinaryNode, timeoutMs?: number) => Promise<BinaryNode>
  sendNode: (node: BinaryNode) => Promise<void>
  generateTag: () => string
  codec: MessageCodec
  /** Doc-ID `w:mex` per operasi; operasi tanpa ID akan gagal dengan `ERR_NOT_CONFIGURED`. */
  queryIds?: ChannelQueryIds
}

export class ChannelManager {
  readonly #opts: ChannelManagerOptions

  constructor(options: ChannelManagerOptions) {
    this.#opts = options
  }

  async #mex(operation: ChannelOperation, variables: Record<string, unknown>): Promise<MexResult> {
    const queryId = this.#opts.queryIds?.[operation]
    if (!queryId) {
      throw new ChannelError(`Channel operation "${operation}" needs a query id (queryIds.${operation})`, { code: 'ERR_NOT_CONFIGURED' })
    }
    return parseMexResult(await this.#opts.query(buildMexQuery(queryId, variables, this.#opts.generateTag())))
  }

  async create(name: string, description?: string, reactionCodes: ReactionCodes = 'ALL'): Promise<ChannelMetadata | undefined> {
    if (!name.trim()) throw new ChannelError('Channel name must not be empty')
    const res = await this.#mex('create', {
      newsletter_input: { name: name.trim(), description: description ?? null, picture: null, settings: { reaction_codes: { value: reactionCodes } } },
    })
    return extractChannelMetadata(Object.values(res.data ?? {})[0] as Record<string, unknown> | undefined)
  }

  /** `key` = JID channel atau kode undangan. */
  async metadata(type: 'jid' | 'invite', key: string): Promise<ChannelMetadata | undefined> {
    if (type === 'jid') assertChannelJid(key)
    const res = await this.#mex('metadata', {
      fetch_creation_time: true,
      fetch_full_image: true,
      fetch_viewer_metadata: true,
      input: { key, type: type.toUpperCase(), view_role: 'GUEST' },
    })
    return extractChannelMetadata(Object.values(res.data ?? {})[0] as Record<string, unknown> | undefined)
  }

  async follow(jid: string): Promise<void> {
    assertChannelJid(jid)
    await this.#mex('follow', { newsletter_id: jid })
  }
  async unfollow(jid: string): Promise<void> {
    assertChannelJid(jid)
    await this.#mex('unfollow', { newsletter_id: jid })
  }
  async mute(jid: string): Promise<void> {
    assertChannelJid(jid)
    await this.#mex('mute', { newsletter_id: jid })
  }
  async unmute(jid: string): Promise<void> {
    assertChannelJid(jid)
    await this.#mex('unmute', { newsletter_id: jid })
  }
  async delete(jid: string): Promise<void> {
    assertChannelJid(jid)
    await this.#mex('delete', { newsletter_id: jid })
  }
  async updateName(jid: string, name: string): Promise<void> {
    assertChannelJid(jid)
    await this.#mex('update', { newsletter_id: jid, updates: { name, settings: null } })
  }
  async updateDescription(jid: string, description: string): Promise<void> {
    assertChannelJid(jid)
    await this.#mex('update', { newsletter_id: jid, updates: { description, settings: null } })
  }

  /** Kirim pesan ke channel (hanya admin/pemilik). */
  async send(jid: string, content: MessageContent, id?: string): Promise<string> {
    const node = buildChannelMessage(jid, content, this.#opts.codec, id)
    await this.#opts.sendNode(node)
    return node.attrs.id!
  }

  async react(jid: string, serverId: string, code?: string): Promise<void> {
    await this.#opts.sendNode(buildChannelReaction(jid, serverId, code))
  }

  async fetchMessages(type: 'jid' | 'invite', key: string, count: number, after?: number): Promise<ChannelMessage[]> {
    const result = await this.#opts.query(buildChannelMessagesQuery(type, key, count, after !== undefined ? { after } : {}))
    return parseChannelMessages(result, type === 'jid' ? key : '', this.#opts.codec)
  }

  /** Mulai pembaruan langsung; mengembalikan durasi (detik) hingga perlu diperbarui lagi. */
  async subscribeLiveUpdates(jid: string): Promise<number | undefined> {
    const result = await this.#opts.query(buildLiveUpdates(jid))
    const duration = Number(getChild(result, 'live_updates')?.attrs.duration)
    return Number.isFinite(duration) ? duration : undefined
  }
}
