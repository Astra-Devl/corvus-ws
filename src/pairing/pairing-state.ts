import { InvalidStateError } from '../core/errors.js'

export type PairingMethod = 'qr' | 'code'
export type PairingStatus = 'idle' | 'pending' | 'paired' | 'expired' | 'failed' | 'cancelled'

export interface PairingStateChange {
  readonly from: PairingStatus
  readonly to: PairingStatus
  readonly method: PairingMethod | undefined
}

const TRANSITIONS: Readonly<Record<PairingStatus, readonly PairingStatus[]>> = {
  idle: ['pending', 'paired'],
  pending: ['pending', 'paired', 'expired', 'failed', 'cancelled'],
  paired: ['idle'],
  expired: ['pending', 'idle'],
  failed: ['pending', 'idle'],
  cancelled: ['pending', 'idle'],
}

export class PairingState {
  #status: PairingStatus = 'idle'
  #method: PairingMethod | undefined
  #startedAt: number | undefined
  #attempts = 0
  readonly #listeners = new Set<(change: PairingStateChange) => void>()

  get status(): PairingStatus {
    return this.#status
  }
  get method(): PairingMethod | undefined {
    return this.#method
  }
  get startedAt(): number | undefined {
    return this.#startedAt
  }
  /** Jumlah percobaan pairing sejak instance dibuat. */
  get attempts(): number {
    return this.#attempts
  }
  get isPending(): boolean {
    return this.#status === 'pending'
  }

  transition(to: PairingStatus, method?: PairingMethod): void {
    const from = this.#status
    if (!TRANSITIONS[from].includes(to)) {
      throw new InvalidStateError(`Invalid pairing transition: ${from} -> ${to}`, {
        data: { from, to },
      })
    }

    if (to === 'pending') {
      if (method) this.#method = method
      if (from !== 'pending') {
        this.#startedAt = Date.now()
        this.#attempts++
      }
    }
    this.#status = to

    const change: PairingStateChange = { from, to, method: this.#method }
    for (const listener of [...this.#listeners]) {
      try {
        listener(change)
      } catch {
        // abaikan error listener
      }
    }
  }

  reset(): void {
    this.#status = 'idle'
    this.#method = undefined
    this.#startedAt = undefined
  }

  onChange(listener: (change: PairingStateChange) => void): () => void {
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
    }
  }
}
