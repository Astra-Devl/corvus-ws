import { MessageError } from '../core/errors.js'
import type { MessageKey } from './message-key.js'
import { PROTOCOL_TYPE } from './message-delete.js'
import type { MessageContent } from './message-utils.js'

/** Edit pesan milik sendiri dengan isi baru. */
export function buildEditMessage(key: MessageKey, content: MessageContent, timestampMs = Date.now()): MessageContent {
  if (!key.fromMe) throw new MessageError('Only your own messages can be edited')
  return {
    protocolMessage: {
      key,
      type: PROTOCOL_TYPE.MESSAGE_EDIT,
      editedMessage: content,
      timestampMs,
    },
  }
}
