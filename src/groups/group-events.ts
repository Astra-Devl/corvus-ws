import { noopLogger } from '../core/defaults.js'
import type { Logger } from '../core/socket-config.js'
import type { SocketContext, SocketModule } from '../core/socket.js'
import { getChild, getChildren, getContentString } from '../protocol/binary-node.js'
import type { ProtocolEngine } from '../protocol/protocol-engine.js'
import type { BinaryNode } from '../protocol/protocol-types.js'
import { buildAck } from '../protocol/stanza-builder.js'
import { extractGroupMetadata, normalizeGroupJid } from './group-metadata.js'
import type { GroupMetadata, ParticipantAction } from './group-types.js'

export interface GroupParticipantsEvent {
  id: string
  author: string | undefined
  participants: string[]
  action: ParticipantAction
}

export type GroupNotification =
  | { kind: 'create'; group: GroupMetadata }
  | { kind: 'participants'; event: GroupParticipantsEvent }
  | { kind: 'update'; update: Partial<GroupMetadata> & { id: string } }

const PARTICIPANT_ACTIONS: readonly string[] = ['add', 'remove', 'promote', 'demote']
const num = (v: string | undefined): number | undefined => (v !== undefined && Number.isFinite(Number(v)) ? Number(v) : undefined)

/** Terjemahkan `<notification type="w:gp2">` menjadi daftar perubahan. */
export function parseGroupNotification(node: BinaryNode): GroupNotification[] {
  const id = normalizeGroupJid(node.attrs.from ?? '')
  const author = node.attrs.participant
  const out: GroupNotification[] = []

  for (const child of Array.isArray(node.content) ? node.content : []) {
    const update = (fields: Partial<GroupMetadata>): void => {
      out.push({ kind: 'update', update: { id, ...fields } })
    }
    if (PARTICIPANT_ACTIONS.includes(child.tag)) {
      out.push({
        kind: 'participants',
        event: {
          id,
          author,
          action: child.tag as ParticipantAction,
          participants: getChildren(child, 'participant').map((p) => p.attrs.jid).filter((j): j is string => !!j),
        },
      })
      continue
    }

    switch (child.tag) {
      case 'create': {
        const group = getChild(child, 'group')
        if (group) out.push({ kind: 'create', group: extractGroupMetadata(group) })
        break
      }
      case 'subject':
        update({ subject: child.attrs.subject, subjectOwner: child.attrs.s_o ?? author, subjectTime: num(child.attrs.s_t) })
        break
      case 'description': {
        const body = getChild(child, 'body')
        update(getChild(child, 'delete') ? { desc: undefined, descId: undefined } : { desc: getContentString(body), descId: child.attrs.id })
        break
      }
      case 'announcement':
        update({ announce: true })
        break
      case 'not_announcement':
        update({ announce: false })
        break
      case 'locked':
        update({ restrict: true })
        break
      case 'unlocked':
        update({ restrict: false })
        break
      case 'ephemeral':
        update({ ephemeralDuration: num(child.attrs.expiration) ?? 0 })
        break
      case 'not_ephemeral':
        update({ ephemeralDuration: 0 })
        break
      case 'membership_approval_mode':
        update({ joinApprovalMode: getChild(child, 'group_join')?.attrs.state === 'on' })
        break
      case 'member_add_mode':
        update({ memberAddMode: getContentString(child) })
        break
      default:
        break
    }
  }
  return out
}

export interface GroupEventsOptions {
  engine: Pick<ProtocolEngine, 'on' | 'sendNode'>
  /** Dipanggil untuk setiap grup yang berubah (mis. invalidasi cache metadata). */
  onChange?: (groupJid: string, notifications: GroupNotification[]) => void
  logger?: Logger
}

/** Modul socket: ubah notifikasi grup menjadi event `groups.*` dan kirim ack. */
export class GroupEventsModule implements SocketModule {
  readonly name = 'group-events'
  readonly #opts: GroupEventsOptions
  readonly #logger: Logger
  #ctx: SocketContext | undefined
  #off: (() => void) | undefined

  constructor(options: GroupEventsOptions) {
    this.#opts = options
    this.#logger = options.logger ?? noopLogger
  }

  setup(ctx: SocketContext): void {
    this.#ctx = ctx
    if (this.#off) return
    this.#off = this.#opts.engine.on({ tag: 'notification', attrs: { type: 'w:gp2' } }, (node) => this.#handle(node))
  }

  dispose(): void {
    this.#off?.()
    this.#off = undefined
    this.#ctx = undefined
  }

  async #handle(node: BinaryNode): Promise<void> {
    const ctx = this.#ctx
    let notifications: GroupNotification[] = []
    try {
      notifications = parseGroupNotification(node)
    } catch (error) {
      this.#logger.warn({ err: error }, 'failed to parse group notification')
    }

    if (ctx) {
      for (const n of notifications) {
        if (n.kind === 'create') ctx.ev.emit('groups.upsert', [n.group])
        else if (n.kind === 'update') ctx.ev.emit('groups.update', [n.update])
        else ctx.ev.emit('group-participants.update', n.event as unknown as Record<string, unknown>)
      }
    }
    if (notifications.length > 0) this.#opts.onChange?.(normalizeGroupJid(node.attrs.from ?? ''), notifications)
    await this.#opts.engine.sendNode(buildAck(node, { type: node.attrs.type ?? 'w:gp2' }))
  }
}
