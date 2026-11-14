import { generateKeyPairSync, hkdfSync } from 'node:crypto'
import { CompatibilityError } from '../core/errors.js'
import { hasFfmpeg } from '../media/media-processor.js'

export interface CompatibilityReport {
  ok: boolean
  node: string
  /** Masalah yang membuat library tidak bisa berjalan. */
  issues: string[]
  /** Kemampuan opsional (true = tersedia). */
  optional: Record<'ws' | 'sharp' | 'ffmpeg', boolean>
}

export const MIN_NODE_MAJOR = 18

async function canImport(specifier: string): Promise<boolean> {
  try {
    await import(specifier)
    return true
  } catch {
    return false
  }
}

/** Periksa lingkungan (versi Node, fitur kripto, dan dependensi opsional). */
export async function checkCompatibility(): Promise<CompatibilityReport> {
  const issues: string[] = []
  const node = process.versions.node
  if (Number(node.split('.')[0]) < MIN_NODE_MAJOR) issues.push(`Node.js >= ${MIN_NODE_MAJOR} is required (found ${node})`)

  if (typeof fetch !== 'function') issues.push('Global fetch is not available')
  if (typeof AbortSignal.timeout !== 'function') issues.push('AbortSignal.timeout is not available')
  if (typeof structuredClone !== 'function') issues.push('structuredClone is not available')

  try {
    generateKeyPairSync('x25519')
    generateKeyPairSync('ed25519')
    hkdfSync('sha256', Buffer.alloc(1), Buffer.alloc(0), '', 16)
  } catch {
    issues.push('OpenSSL lacks X25519/Ed25519/HKDF support')
  }

  const [ws, sharp, ffmpeg] = await Promise.all([canImport('ws'), canImport('sharp'), hasFfmpeg()])
  return { ok: issues.length === 0, node, issues, optional: { ws, sharp, ffmpeg } }
}

export async function assertCompatible(): Promise<CompatibilityReport> {
  const report = await checkCompatibility()
  if (!report.ok) throw new CompatibilityError(`Incompatible environment: ${report.issues.join('; ')}`, { data: { issues: report.issues } })
  return report
}
