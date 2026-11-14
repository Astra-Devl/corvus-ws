import { ContactError } from '../core/errors.js'
import { getChild, getChildren, getContentString } from '../protocol/binary-node.js'
import type { BinaryNode } from '../protocol/protocol-types.js'
import { S_WHATSAPP_NET } from '../protocol/stanza-builder.js'
import { jidDecode, jidEncode } from '../messages/message-utils.js'
import type { DeviceInfo, USyncProtocol, USyncUser, USyncUserResult } from './contact-types.js'

export interface USyncQueryOptions {
  protocols: readonly USyncProtocol[]
  users: readonly USyncUser[]
  sid: string
  context?: 'interactive' | 'message' | 'notification'
  mode?: 'query' | 'delta'
}

function protocolNode(protocol: USyncProtocol): BinaryNode {
  return protocol === 'devices'
    ? { tag: 'devices', attrs: { version: '2' } }
    : { tag: protocol, attrs: {} }
}

function userNode(user: USyncUser): BinaryNode {
  if (user.phone !== undefined) {
    const digits = user.phone.replace(/\D/g, '')
    if (digits.length < 5) throw new ContactError(`Invalid phone number: ${user.phone}`)
    return { tag: 'user', attrs: {}, content: [{ tag: 'contact', attrs: {}, content: `+${digits}` }] }
  }
  if (user.jid) return { tag: 'user', attrs: { jid: user.jid } }
  throw new ContactError('USync user needs a jid or a phone')
}

/** `<iq xmlns="usync" type="get"><usync ...><query>..</query><list>..</list></usync></iq>` */
export function buildUSyncQuery(options: USyncQueryOptions): BinaryNode {
  if (options.users.length === 0) throw new ContactError('USync query needs at least one user')
  return {
    tag: 'iq',
    attrs: { to: S_WHATSAPP_NET, type: 'get', xmlns: 'usync' },
    content: [
      {
        tag: 'usync',
        attrs: { context: options.context ?? 'interactive', mode: options.mode ?? 'query', sid: options.sid, last: 'true', index: '0' },
        content: [
          { tag: 'query', attrs: {}, content: options.protocols.map(protocolNode) },
          { tag: 'list', attrs: {}, content: options.users.map(userNode) },
        ],
      },
    ],
  }
}

export function parseDevices(user: BinaryNode): DeviceInfo[] {
  const decoded = jidDecode(user.attrs.jid ?? '')
  const list = getChild(getChild(user, 'devices') ?? { tag: '', attrs: {} }, 'device-list')
  if (!decoded || !list) return []
  return getChildren(list, 'device').map((d) => {
    const id = Number(d.attrs.id)
    return {
      jid: jidEncode(decoded.user, decoded.server, id),
      id,
      keyIndex: d.attrs['key-index'] !== undefined ? Number(d.attrs['key-index']) : undefined,
      isHosted: d.attrs.is_hosted === 'true',
    }
  })
}

/** Parse hasil `<iq><usync><list><user .../>...`. */
export function parseUSyncResult(result: BinaryNode): USyncUserResult[] {
  const list = getChild(getChild(result, 'usync') ?? { tag: '', attrs: {} }, 'list')
  if (!list) return []

  return getChildren(list, 'user').map((user) => {
    const contact = getChild(user, 'contact')
    const status = getChild(user, 'status')
    const lid = getChild(user, 'lid')
    const setAt = Number(status?.attrs.t)
    return {
      jid: user.attrs.jid ?? '',
      query: contact ? getContentString(contact)?.replace(/^\+/, '') : undefined,
      exists: contact ? contact.attrs.type === 'in' : undefined,
      lid: lid?.attrs.val,
      status: status
        ? { text: getContentString(status) ?? '', setAt: Number.isFinite(setAt) && status.attrs.t !== undefined ? setAt : undefined }
        : undefined,
      devices: getChild(user, 'devices') ? parseDevices(user) : undefined,
    }
  })
}
