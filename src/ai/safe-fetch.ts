import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const PRIVATE_V4 = [/^0\./, /^10\./, /^127\./, /^169\.254\./, /^172\.(1[6-9]|2\d|3[01])\./, /^192\.168\./, /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, /^192\.0\.0\./, /^198\.(1[89])\./, /^2(2[4-9]|[3-5]\d)\./]

function isPrivateIp(ip: string): boolean {
  if (ip.includes(':')) {
    const v = ip.toLowerCase()
    if (v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80')) return true
    const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v)
    return mapped ? isPrivateIp(mapped[1]!) : false
  }
  return PRIVATE_V4.some((r) => r.test(ip))
}

/** Tolak URL non-http(s) atau yang menuju alamat internal (perlindungan SSRF untuk URL dari AI). */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('URL tidak valid')
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Hanya URL http(s) yang diizinkan')
  const host = url.hostname.replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) throw new Error('Alamat internal tidak diizinkan')
  const ips = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address)
  if (ips.length === 0 || ips.some(isPrivateIp)) throw new Error('Alamat internal tidak diizinkan')
  return url
}

export interface SafeFetchOptions {
  maxBytes?: number
  timeoutMs?: number
  fetch?: typeof fetch
  /** Lewati pengecekan DNS/alamat (hanya untuk pengujian). */
  allowPrivate?: boolean
}

/** Unduh URL publik sebagai Buffer: redirect diperiksa tiap lompatan, ukuran dibatasi. */
export async function fetchPublicBuffer(rawUrl: string, options: SafeFetchOptions = {}): Promise<{ buffer: Buffer; mimeType: string }> {
  const maxBytes = options.maxBytes ?? 25 * 1024 * 1024
  const doFetch = options.fetch ?? fetch
  let current = rawUrl
  for (let hop = 0; hop < 4; hop++) {
    const url = options.allowPrivate ? new URL(current) : await assertPublicUrl(current)
    const res = await doFetch(url, { redirect: 'manual', signal: AbortSignal.timeout(options.timeoutMs ?? 30_000), headers: { 'User-Agent': 'corvus-ws' } })
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      current = new URL(res.headers.get('location')!, url).toString()
      continue
    }
    if (!res.ok) throw new Error(`Unduhan gagal (HTTP ${res.status})`)
    const declared = Number(res.headers.get('content-length') ?? 0)
    if (declared > maxBytes) throw new Error('Berkas terlalu besar')
    const chunks: Buffer[] = []
    let size = 0
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      size += chunk.length
      if (size > maxBytes) throw new Error('Berkas terlalu besar')
      chunks.push(Buffer.from(chunk))
    }
    return { buffer: Buffer.concat(chunks), mimeType: (res.headers.get('content-type') ?? 'application/octet-stream').split(';')[0]!.trim() }
  }
  throw new Error('Terlalu banyak pengalihan (redirect)')
}
