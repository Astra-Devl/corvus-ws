export interface TransportCloseInfo {
  code: number | undefined
  reason: string
  error?: Error | undefined
}

export interface TransportEventMap {
  open: undefined
  message: Uint8Array
  close: TransportCloseInfo
  error: Error
}

/** Subset API `ws` yang dipakai transport (agar mudah diganti/di-mock). */
export interface WebSocketLike {
  readonly readyState: number
  send(data: Uint8Array, callback?: (error?: Error) => void): void
  close(code?: number, reason?: string): void
  terminate?(): void
  on(event: string, listener: (...args: never[]) => void): unknown
}

export interface WebSocketOptions {
  origin: string
  headers: Record<string, string>
  handshakeTimeout: number
}

export type WebSocketFactory = (
  url: string,
  options: WebSocketOptions,
) => WebSocketLike | Promise<WebSocketLike>

export const WS_READY_STATE_OPEN = 1
