import { VersionError, toError } from '../core/errors.js'
import {
  DEFAULT_VERSION_HEADERS,
  DEFAULT_VERSION_SOURCES,
  DEFAULT_VERSION_TIMEOUT_MS,
  MAX_VERSION_BODY_BYTES,
} from './version-defaults.js'
import { assertValidVersion } from './version-validator.js'
import type { FetchVersionOptions, VersionInfo, VersionSourceDefinition } from './version-types.js'

/** Ambil versi dari satu sumber. */
export async function fetchVersionFromSource(
  source: VersionSourceDefinition,
  options: FetchVersionOptions = {},
): Promise<VersionInfo> {
  const doFetch = options.fetch ?? globalThis.fetch
  if (typeof doFetch !== 'function') throw new VersionError('Global fetch is not available')

  const timeoutMs = options.timeoutMs ?? DEFAULT_VERSION_TIMEOUT_MS
  const data = { source: source.name, url: source.url }
  // Timer sendiri (bukan AbortSignal.timeout) agar pasti aktif dan bisa dibersihkan.
  const controller = new AbortController()
  let timedOut = false
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeoutMs)
  const timeoutError = (cause: unknown) =>
    new VersionError(`Request to ${source.name} timed out after ${timeoutMs}ms`, { cause, data })

  try {
    let response: Response
    try {
      response = await doFetch(source.url, {
        headers: { ...DEFAULT_VERSION_HEADERS, ...options.headers, ...source.headers },
        signal: controller.signal,
      })
    } catch (cause) {
      throw timedOut ? timeoutError(cause) : new VersionError(`Request to ${source.name} failed`, { cause, data })
    }
    if (!response.ok) {
      throw new VersionError(`${source.name} responded with HTTP ${response.status}`, { statusCode: response.status, data })
    }

    let body: string
    try {
      body = await response.text()
    } catch (cause) {
      throw timedOut ? timeoutError(cause) : new VersionError(`Could not read the response from ${source.name}`, { cause, data })
    }
    if (body.length > MAX_VERSION_BODY_BYTES) {
      throw new VersionError(`Response from ${source.name} is too large`, { data: { ...data, length: body.length } })
    }

    let version
    try {
      version = assertValidVersion(source.parse(body))
    } catch (cause) {
      throw new VersionError(`Could not read a version from ${source.name}`, { cause, data })
    }
    return { version, source: 'remote', fetchedAt: Date.now(), sourceName: source.name }
  } finally {
    clearTimeout(timer)
  }
}

/** Ambil versi terbaru; sumber dicoba berurutan sampai ada yang berhasil. */
export async function fetchLatestVersion(options: FetchVersionOptions = {}): Promise<VersionInfo> {
  const sources = options.sources ?? DEFAULT_VERSION_SOURCES
  if (sources.length === 0) throw new VersionError('No version sources configured')

  const errors: Error[] = []
  for (const source of sources) {
    try {
      return await fetchVersionFromSource(source, options)
    } catch (error) {
      errors.push(toError(error))
    }
  }
  throw new VersionError(`Could not fetch the latest version: ${errors.map((e) => e.message).join('; ')}`, {
    cause: errors[errors.length - 1],
    data: { errors: errors.map((e) => e.message) },
  })
}
