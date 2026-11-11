import type { CONNECTION_STATUSES } from './constants.js'
import { InvalidStateError } from './errors.js'

export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number]

export interface StateChange {
  readonly from: ConnectionStatus
  readonly to: ConnectionStatus
  readonly at: number
}

export interface DisconnectInfo {
  readonly error: Error | undefined
  readonly date: Date
}

const TRANSITIONS: Readonly<Record<ConnectionStatus, readonly ConnectionStatus[]>> = {
  idle: ['connecting'],
  connecting: ['open', 'closing', 'closed'],
  open: ['closing', 'closed'],
  closing: ['closed'],
  closed: ['connecting'],
}

/** State machine sederhana untuk siklus hidup socket. */
export class SocketState {
  #status: ConnectionStatus = 'idle'
  #openedAt: number | undefined
  #lastDisconnect: DisconnectInfo | undefined
  readonly #listeners = new Set<(change: StateChange) => void>()

  get status(): ConnectionStatus {
    return this.#status
  }

  get lastDisconnect(): DisconnectInfo | undefined {
    return this.#lastDisconnect
  }

  get uptimeMs(): number {
    return this.#status === 'open' && this.#openedAt !== undefined ? Date.now() - this.#openedAt : 0
  }

  /** `connecting` atau `open`. */
  get isActive(): boolean {
    return this.#status === 'connecting' || this.#status === 'open'
  }

  is(...statuses: ConnectionStatus[]): boolean {
    return statuses.includes(this.#status)
  }

  canTransition(to: ConnectionStatus): boolean {
    return TRANSITIONS[this.#status].includes(to)
  }

  transition(to: ConnectionStatus): void {
    const from = this.#status
    if (!this.canTransition(to)) {
      throw new InvalidStateError(`Invalid state transition: ${from} -> ${to}`, {
        data: { from, to },
      })
    }
    this.#status = to
    if (to === 'open') this.#openedAt = Date.now()
    if (to === 'closed') this.#openedAt = undefined

    const change: StateChange = { from, to, at: Date.now() }
    for (const listener of [...this.#listeners]) {
      try {
        listener(change)
      } catch {
        // listener error tidak boleh merusak state machine
      }
    }
  }

  recordDisconnect(error?: Error): void {
    this.#lastDisconnect = { error, date: new Date() }
  }

  assertOpen(): void {
    if (this.#status !== 'open') {
      throw new InvalidStateError(`Socket is not open (current: ${this.#status})`, {
        data: { status: this.#status },
      })
    }
  }

  onChange(listener: (change: StateChange) => void): () => void {
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
    }
  }
}
