import { CallError } from '../core/errors.js'
import type { BinaryNode } from '../protocol/protocol-types.js'
import { FINAL_CALL_STATUSES, type CallInfo } from './call-types.js'

export interface CallManagerOptions {
  query: (node: BinaryNode, timeoutMs?: number) => Promise<BinaryNode>
  /** JID akun sendiri. */
  ownJid: string
  /** `true` menolak semua panggilan masuk; fungsi memutuskan per panggilan. */
  autoReject?: boolean | ((call: CallInfo) => boolean)
  /** Berapa lama riwayat panggilan selesai disimpan (default 10 menit). */
  retainMs?: number
  now?: () => number
}

/** Pelacak panggilan masuk + penolakan. */
export class CallManager {
  readonly #opts: CallManagerOptions
  readonly #calls = new Map<string, CallInfo>()
  readonly #rejected = new Set<string>()
  readonly #retain: number
  readonly #now: () => number

  constructor(options: CallManagerOptions) {
    this.#opts = options
    this.#retain = options.retainMs ?? 10 * 60_000
    this.#now = options.now ?? Date.now
  }

  /** Daftar panggilan yang masih berlangsung / berdering. */
  get active(): CallInfo[] {
    return [...this.#calls.values()].filter((c) => !FINAL_CALL_STATUSES.includes(c.status))
  }

  get(callId: string): CallInfo | undefined {
    return this.#calls.get(callId)
  }

  /** Dipakai sebagai `onCall` pada `CallEventsModule`. */
  handle(call: CallInfo): void {
    const previous = this.#calls.get(call.id)
    // info video/grup dari offer dipertahankan pada pembaruan berikutnya
    const merged: CallInfo = previous ? { ...previous, status: call.status, reason: call.reason ?? previous.reason } : call
    this.#calls.set(call.id, merged)
    this.#prune()

    if (call.status === 'offer' && !previous) {
      const reject = this.#opts.autoReject
      if (reject === true || (typeof reject === 'function' && reject(call))) {
        void this.reject(call.id).catch(() => {
          /* gagal menolak tidak boleh menghentikan alur event */
        })
      }
    }
  }

  /** Tolak panggilan masuk. */
  async reject(callId: string, callFrom?: string): Promise<void> {
    const known = this.#calls.get(callId)
    const from = callFrom ?? known?.from
    if (!from) throw new CallError('Unknown call; pass callFrom explicitly', { data: { callId } })
    if (this.#rejected.has(callId)) return
    this.#rejected.add(callId)

    try {
      await this.#opts.query({
        tag: 'call',
        attrs: { from: this.#opts.ownJid, to: from },
        content: [{ tag: 'reject', attrs: { 'call-id': callId, 'call-creator': from, count: '0' } }],
      })
    } catch (error) {
      this.#rejected.delete(callId)
      throw error
    }
    if (known) this.#calls.set(callId, { ...known, status: 'reject' })
  }

  #prune(): void {
    const cutoff = Math.floor((this.#now() - this.#retain) / 1000)
    for (const [id, call] of this.#calls) {
      if (FINAL_CALL_STATUSES.includes(call.status) && call.date < cutoff) {
        this.#calls.delete(id)
        this.#rejected.delete(id)
      }
    }
  }
}
