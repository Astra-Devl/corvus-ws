import { ValidationError } from '../core/errors.js'
import { jidKind, type JidKind } from './jid.js'

const fail = (message: string, name: string, value: unknown): never => {
  throw new ValidationError(message, { data: { name, value } })
}

export const isNonEmptyString = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') return false
  const proto = Object.getPrototypeOf(value) as unknown
  return proto === Object.prototype || proto === null
}

export function assertNonEmptyString(name: string, value: unknown): asserts value is string {
  if (!isNonEmptyString(value)) fail(`"${name}" must be a non-empty string`, name, value)
}

export function assertPositiveInteger(name: string, value: unknown, max = Number.MAX_SAFE_INTEGER): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > max) {
    fail(`"${name}" must be an integer between 1 and ${max}`, name, value)
  }
}

export function assertInRange(name: string, value: unknown, min: number, max: number): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    fail(`"${name}" must be between ${min} and ${max}`, name, value)
  }
}

export function assertOneOf<T extends string | number>(name: string, value: unknown, allowed: readonly T[]): asserts value is T {
  if (!allowed.includes(value as T)) fail(`"${name}" must be one of: ${allowed.join(', ')}`, name, value)
}

export function assertJid(name: string, value: unknown, kinds?: readonly JidKind[]): asserts value is string {
  if (!isNonEmptyString(value) || !value.includes('@')) fail(`"${name}" must be a JID`, name, value)
  if (kinds && !kinds.includes(jidKind(value as string))) fail(`"${name}" must be a ${kinds.join('/')} JID`, name, value)
}

export const clamp = (value: number, min: number, max: number): number => Math.min(Math.max(value, min), max)
