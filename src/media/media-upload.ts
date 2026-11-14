import { randomUUID } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { MediaError } from '../core/errors.js'
import { noopLogger } from '../core/defaults.js'
import type { Logger } from '../core/socket-config.js'
import { createMediaEncryptStream, generateMediaKey, type MediaType } from '../crypto/media-crypto.js'
import { getChild, getChildren } from '../protocol/binary-node.js'
import type { BinaryNode } from '../protocol/protocol-types.js'
import { S_WHATSAPP_NET } from '../protocol/stanza-builder.js'
import { MEDIA_PATHS, type MediaConn, type UploadResult } from './media-types.js'

export type FetchLike = typeof fetch

export interface MediaUploaderOptions {
  query: (node: BinaryNode, timeoutMs?: number) => Promise<BinaryNode>
  fetch?: FetchLike
  tmpDir?: string
  /** Batas waktu per upload (ms, default 120000). */
  timeoutMs?: number
  logger?: Logger
  now?: () => number
}

export function parseMediaConn(result: BinaryNode, fetchedAt: number): MediaConn {
  const conn = getChild(result, 'media_conn')
  if (!conn?.attrs.auth) throw new MediaError('Invalid media_conn response')
  return {
    auth: conn.attrs.auth,
    ttl: Number(conn.attrs.ttl ?? 300),
    fetchedAt,
    hosts: getChildren(conn, 'host').map((h) => ({
      hostname: h.attrs.hostname ?? '',
      maxContentLengthBytes: Number(h.attrs.maxContentLengthBytes ?? Number.MAX_SAFE_INTEGER),
    })).filter((h) => h.hostname),
  }
}

/** Mengenkripsi media ke file sementara lalu mengunggahnya ke host media. */
export class MediaUploader {
  readonly #opts: MediaUploaderOptions
  readonly #fetch: FetchLike
  readonly #logger: Logger
  readonly #now: () => number
  #conn: MediaConn | undefined

  constructor(options: MediaUploaderOptions) {
    this.#opts = options
    this.#fetch = options.fetch ?? fetch
    this.#logger = options.logger ?? noopLogger
    this.#now = options.now ?? Date.now
  }

  async getMediaConn(force = false): Promise<MediaConn> {
    const c = this.#conn
    if (!force && c && this.#now() < c.fetchedAt + c.ttl * 1000) return c

    const result = await this.#opts.query({
      tag: 'iq',
      attrs: { type: 'set', xmlns: 'w:m', to: S_WHATSAPP_NET },
      content: [{ tag: 'media_conn', attrs: {} }],
    })
    this.#conn = parseMediaConn(result, this.#now())
    return this.#conn
  }

  async upload(source: Readable, type: MediaType, options: { mediaKey?: Buffer } = {}): Promise<UploadResult> {
    const tmp = join(this.#opts.tmpDir ?? tmpdir(), `corvus-${randomUUID()}.enc`)
    const encrypt = createMediaEncryptStream(type, options.mediaKey ?? generateMediaKey())

    try {
      await pipeline(source, encrypt, createWriteStream(tmp, { mode: 0o600 }))
      const meta = encrypt.result!
      const size = (await stat(tmp)).size
      const token = meta.fileEncSha256.toString('base64url')

      let lastError: unknown
      for (const refresh of [false, true]) {
        const conn = await this.getMediaConn(refresh)
        const hosts = conn.hosts.filter((h) => size <= h.maxContentLengthBytes)
        if (hosts.length === 0) throw new MediaError(`File too large to upload (${size} bytes)`, { code: 'ERR_MEDIA_TOO_LARGE' })

        for (const host of hosts) {
          try {
            const url = `https://${host.hostname}${MEDIA_PATHS[type]}/${token}?auth=${encodeURIComponent(conn.auth)}&token=${token}`
            const res = await this.#fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/octet-stream', Origin: 'https://web.whatsapp.com', 'Content-Length': String(size) },
              body: Readable.toWeb(createReadStream(tmp)) as never,
              duplex: 'half',
              signal: AbortSignal.timeout(this.#opts.timeoutMs ?? 120_000),
            } as RequestInit)
            if (!res.ok) throw new MediaError(`Upload failed (${res.status})`, { statusCode: res.status, code: 'ERR_MEDIA_HTTP' })

            const json = (await res.json()) as { url?: string; direct_path?: string }
            if (!json.url || !json.direct_path) throw new MediaError('Upload response is missing url/direct_path')
            return {
              mediaKey: meta.mediaKey,
              fileSha256: meta.fileSha256,
              fileEncSha256: meta.fileEncSha256,
              fileLength: meta.fileLength,
              url: json.url,
              directPath: json.direct_path,
              mediaKeyTimestamp: Math.floor(this.#now() / 1000),
            }
          } catch (error) {
            lastError = error
            this.#logger.warn({ err: error, host: host.hostname }, 'media upload failed, trying next host')
          }
        }
        const status = (lastError as { statusCode?: number } | undefined)?.statusCode
        if (status !== 401 && status !== 403) break // hanya auth yang layak di-refresh
      }
      throw lastError instanceof MediaError ? lastError : new MediaError('Media upload failed', { cause: lastError })
    } finally {
      await rm(tmp, { force: true })
    }
  }
}
