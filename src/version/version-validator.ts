import { VersionError } from '../core/errors.js'
import { parseVersion } from '../protocol/protocol-version.js'
import { WA_WEB_MAJOR, WA_WEB_MINOR } from './version-defaults.js'
import type { WAVersion } from './version-types.js'

export interface VersionIssue {
  code: 'format' | 'implausible'
  message: string
}

export interface ValidateVersionOptions {
  /** Periksa juga bahwa angkanya masuk akal untuk WhatsApp Web (mayor 2, minor 3000, revisi > 0). */
  strict?: boolean | undefined
}

export function validateVersion(version: unknown, options: ValidateVersionOptions = {}): VersionIssue[] {
  if (!Array.isArray(version) || version.length !== 3 || !version.every((n) => Number.isSafeInteger(n) && n >= 0)) {
    return [{ code: 'format', message: 'version must be [major, minor, revision] of non-negative integers' }]
  }
  if (!options.strict) return []

  const [major, minor, revision] = version as [number, number, number]
  const issues: VersionIssue[] = []
  if (major !== WA_WEB_MAJOR) issues.push({ code: 'implausible', message: `major must be ${WA_WEB_MAJOR}, got ${major}` })
  if (minor !== WA_WEB_MINOR) issues.push({ code: 'implausible', message: `minor must be ${WA_WEB_MINOR}, got ${minor}` })
  if (revision <= 0) issues.push({ code: 'implausible', message: 'revision must be greater than 0' })
  return issues
}

export function isValidVersion(version: unknown, options?: ValidateVersionOptions): version is WAVersion {
  return validateVersion(version, options).length === 0
}

export function assertValidVersion(version: unknown, options?: ValidateVersionOptions): WAVersion {
  const issues = validateVersion(version, options)
  if (issues.length > 0) {
    throw new VersionError(`Invalid version: ${issues.map((i) => i.message).join('; ')}`, { data: { version, issues } })
  }
  return version as WAVersion
}

/** Terima `"2.3000.123"` atau `[2, 3000, 123]`; hasilnya dijamin valid. */
export function normalizeVersion(input: string | readonly number[]): WAVersion {
  if (typeof input === 'string') {
    try {
      return assertValidVersion(parseVersion(input))
    } catch (cause) {
      if (cause instanceof VersionError) throw cause
      throw new VersionError(`Invalid version string: "${input}"`, { cause })
    }
  }
  return assertValidVersion([...input])
}
