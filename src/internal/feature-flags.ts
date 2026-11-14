/** Flag yang benar-benar dipakai di library, beserta nilai bawaannya. */
export const DEFAULT_FLAGS = {
  /** Kirim receipt pengiriman untuk pesan masuk. */
  'receive.sendReceipts': true,
  /** Kirim nack ke server bila dekripsi pesan gagal. */
  'receive.nackOnDecryptError': true,
} as const

export type FeatureFlagName = keyof typeof DEFAULT_FLAGS

function parseEnv(text: string | undefined): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  for (const raw of (text ?? '').split(',')) {
    const item = raw.trim()
    if (!item) continue
    if (item.startsWith('-')) out[item.slice(1)] = false
    else if (item.includes('=')) {
      const [name, value] = item.split('=') as [string, string]
      out[name.trim()] = !['false', '0', 'off', 'no'].includes(value.trim().toLowerCase())
    } else out[item] = true
  }
  return out
}

/**
 * Pengelola flag fitur. Prioritas: `set()` > opsi konstruktor > env `CORVUS_FLAGS`
 * (mis. `CORVUS_FLAGS="receive.sendReceipts=false,-receive.nackOnDecryptError"`).
 */
export class FeatureFlags {
  readonly #values = new Map<string, boolean>()

  constructor(overrides: Record<string, boolean> = {}, env: string | undefined = process.env.CORVUS_FLAGS) {
    for (const [name, value] of Object.entries(DEFAULT_FLAGS)) this.#values.set(name, value)
    for (const [name, value] of Object.entries({ ...parseEnv(env), ...overrides })) this.#values.set(name, value)
  }

  isEnabled(name: FeatureFlagName | (string & {})): boolean {
    return this.#values.get(name) ?? false
  }

  set(name: string, value: boolean): void {
    this.#values.set(name, value)
  }

  all(): Record<string, boolean> {
    return Object.fromEntries(this.#values)
  }
}
