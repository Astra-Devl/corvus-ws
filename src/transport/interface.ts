import type { TypedEventEmitter } from '../core/event-emitter.js'
import type { ResolvedSocketConfig } from '../core/socket-config.js'
import type { TransportEventMap } from './websocket-events.js'

export type TransportState = 'idle' | 'connecting' | 'open' | 'closing' | 'closed'

/** Kontrak transport byte-oriented (WebSocket, atau mock untuk test). */
export interface Transport {
  readonly events: TypedEventEmitter<TransportEventMap>
  readonly state: TransportState
  /** Resolve saat koneksi terbuka; reject jika gagal/timeout. */
  connect(): Promise<void>
  send(data: Uint8Array): Promise<void>
  close(code?: number, reason?: string): Promise<void>
}

export type TransportFactory = (config: ResolvedSocketConfig) => Transport
