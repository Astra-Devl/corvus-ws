import { ProtocolError } from '../core/errors.js'
import { TAGS } from './protocol-types.js'

export interface TokenLocation {
  readonly index: number
  /** Nomor kamus ganda (0-3); `undefined` untuk token byte-tunggal. */
  readonly dict?: number
}

export interface TokenTables {
  /** Indeks 0 dicadangkan (diabaikan); token valid mulai dari indeks 1. */
  single: readonly string[]
  /** Maksimal 4 kamus, masing-masing maksimal 256 token. */
  doubles?: ReadonlyArray<readonly string[]>
}

export class TokenDictionary {
  readonly single: readonly string[]
  readonly doubles: ReadonlyArray<readonly string[]>
  readonly #map = new Map<string, TokenLocation>()

  constructor(tables: TokenTables) {
    const doubles = tables.doubles ?? []
    if (tables.single.length > TAGS.DICTIONARY_0) {
      throw new ProtocolError(`Single-byte token table too large (max ${TAGS.DICTIONARY_0})`)
    }
    if (doubles.length > 4 || doubles.some((d) => d.length > 256)) {
      throw new ProtocolError('Double-byte token tables: max 4 tables of 256 entries')
    }
    this.single = tables.single
    this.doubles = doubles

    this.single.forEach((token, index) => {
      if (index > 0 && token && !this.#map.has(token)) this.#map.set(token, { index })
    })
    this.doubles.forEach((table, dict) => {
      table.forEach((token, index) => {
        if (token && !this.#map.has(token)) this.#map.set(token, { dict, index })
      })
    })
  }

  static empty(): TokenDictionary {
    return new TokenDictionary({ single: [''] })
  }

  static fromJSON(json: unknown): TokenDictionary {
    const v = json as { single?: unknown; doubles?: unknown } | null
    const isStrings = (x: unknown): x is string[] =>
      Array.isArray(x) && x.every((s) => typeof s === 'string')
    if (!v || !isStrings(v.single)) throw new ProtocolError('Invalid token dictionary: "single"')
    const doubles = v.doubles ?? []
    if (!Array.isArray(doubles) || !doubles.every(isStrings)) {
      throw new ProtocolError('Invalid token dictionary: "doubles"')
    }
    return new TokenDictionary({ single: v.single, doubles })
  }

  get size(): number {
    return this.#map.size
  }

  lookup(token: string): TokenLocation | undefined {
    return this.#map.get(token)
  }

  getSingle(index: number): string {
    const token = this.single[index]
    if (index < 1 || token === undefined) {
      throw new ProtocolError(`Unknown single-byte token: ${index}`)
    }
    return token
  }

  getDouble(dict: number, index: number): string {
    const token = this.doubles[dict]?.[index]
    if (token === undefined) throw new ProtocolError(`Unknown double-byte token: ${dict}/${index}`)
    return token
  }
}

let defaultDictionary = TokenDictionary.empty()

/**
 * Kamus bawaan KOSONG: isi dengan tabel token protokol yang sebenarnya
 * (`TokenDictionary.fromJSON`) sebelum berkomunikasi dengan server.
 */
export function setDefaultTokenDictionary(dictionary: TokenDictionary): void {
  defaultDictionary = dictionary
}

export function getDefaultTokenDictionary(): TokenDictionary {
  return defaultDictionary
}
