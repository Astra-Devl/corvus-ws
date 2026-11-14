/** Event lokal untuk menghapus chat dan pesannya dari store. */
export const deleteEvents = (jid: string): { chatsDelete: string[]; messagesDelete: { jid: string; all: true } } => ({
  chatsDelete: [jid],
  messagesDelete: { jid, all: true },
})

/** Event lokal untuk mengosongkan isi chat (chat tetap ada). */
export const clearEvents = (jid: string): { messagesDelete: { jid: string; all: true } } => ({
  messagesDelete: { jid, all: true },
})
