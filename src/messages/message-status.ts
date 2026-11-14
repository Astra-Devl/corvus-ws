export const MessageStatus = {
  ERROR: 0,
  PENDING: 1,
  SERVER_ACK: 2,
  DELIVERY_ACK: 3,
  READ: 4,
  PLAYED: 5,
} as const

export type MessageStatus = (typeof MessageStatus)[keyof typeof MessageStatus]

/** Petakan atribut `type` pada `<receipt>` ke status pesan. */
export function receiptTypeToStatus(type: string | undefined): MessageStatus | undefined {
  switch (type) {
    case undefined:
    case 'sender':
    case 'inactive':
      return MessageStatus.DELIVERY_ACK
    case 'read':
    case 'read-self':
      return MessageStatus.READ
    case 'played':
    case 'played-self':
      return MessageStatus.PLAYED
    default:
      return undefined
  }
}

/** Status hanya boleh naik (ERROR selalu boleh menimpa PENDING). */
export function isStatusUpgrade(from: number | undefined, to: number): boolean {
  if (from === undefined) return true
  if (to === MessageStatus.ERROR) return from === MessageStatus.PENDING
  return to > from
}
