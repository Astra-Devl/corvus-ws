import type { ChatUpdate } from '../store/store-events.js'

export const archiveUpdate = (jid: string, archived: boolean): ChatUpdate => ({ id: jid, archived })
