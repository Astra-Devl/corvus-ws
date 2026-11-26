/**
 * Klien GoBiz / GoPay Merchant (api.gobiz.co.id): login (password/OTP), daftar merchant,
 * riwayat transaksi, QRIS dinamis, dan pemantauan pembayaran masuk.
 *
 * Modul ini MURNI: tidak bergantung pada socket WhatsApp dan tidak membaca pengaturan global.
 * Semua data (QRIS, email, password, nomor, token) diberikan lewat argumen setiap pemanggilan.
 * Diadaptasi dari skrip GoPayMerchant milik pengguna (alur dan endpoint sama).
 */
import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const BASE_URL = 'https://api.gobiz.co.id'
const CLIENT_ID = 'go-biz-web-new'

export class GoBizError extends Error {
  readonly code: string
  constructor(message: string, code = 'GOBIZ_ERROR', options?: ErrorOptions) {
    super(message, options)
    this.name = 'GoBizError'
    this.code = code
  }
}

// ---------- tipe ----------

export interface GoBizTokens {
  accessToken: string
  refreshToken?: string
  expiresIn?: number
}

/** Data akun yang diberikan pemilik bot pada setiap pemanggilan. */
export interface GoBizAuth {
  /** Login password. */
  email?: string
  password?: string
  /** Login OTP (nomor HP, boleh 08xx / 628xx / +628xx). */
  phone?: string
  /** Token yang sudah ada (melewati login). */
  token?: string
  merchantId?: string
  /**
   * Berkas cache token (mis. `./gopay_cache.json`, format skrip GoPayMerchant: `gopay_token`, `gopay_merchant_id`).
   * Token dibaca dari sini; login baru juga menyimpannya ke sini.
   */
  cacheFile?: string
}

export interface GoBizHttp {
  /** POST JSON; mengembalikan JSON hasil parse. */
  post(url: string, headers: Record<string, string>, body: unknown): Promise<any> // eslint-disable-line @typescript-eslint/no-explicit-any
  /** Permintaan HTTP biasa (analytics / journals / validasi token). */
  fetch(url: string, init: { method: string; headers: Record<string, string>; body?: string }): Promise<{ status: number; ok: boolean; json(): Promise<any> }> // eslint-disable-line @typescript-eslint/no-explicit-any
}

export interface GoBizOptions {
  http?: GoBizHttp
  now?: () => number
  /** Zona waktu untuk jendela pencarian (default Asia/Jakarta). */
  timezone?: string
}

export interface GoBizPayment {
  id: string
  /** Nominal dalam satuan Rupiah. */
  amount: number
  /** ISO 8601. */
  time: string
  raw: unknown
}

export interface GoBizSession {
  token: string
  merchantId: string
  merchantName?: string
}

// ---------- HTTP ----------

const headersFor = (uniqueId: string, token?: string): Record<string, string> => ({
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'id',
  'Authentication-Type': 'go-id',
  Authorization: token ? `Bearer ${token}` : 'Bearer',
  Connection: 'keep-alive',
  'Content-Type': 'application/json',
  'Gojek-Country-Code': 'ID',
  'Gojek-Timezone': 'Asia/Jakarta',
  Origin: 'https://portal.gofoodmerchant.co.id',
  Referer: 'https://portal.gofoodmerchant.co.id/',
  'Sec-Fetch-Dest': 'empty',
  'Sec-Fetch-Mode': 'cors',
  'Sec-Fetch-Site': 'cross-site',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
  'X-AppVersion': 'platform-v3.107.0-94ce5d57',
  'X-PhoneMake': 'Windows 10 64-bit',
  'X-PhoneModel': 'Chrome 149.0.0.0 on Windows 10 64-bit',
  'X-Platform': 'Web',
  'X-User-Locale': 'en-US',
  'X-User-Type': 'merchant',
  'x-DeviceOS': 'Web',
  'x-appId': 'go-biz-web-dashboard',
  'x-uniqueid': uniqueId,
})

/** POST via `curl -4` seperti skrip asli; body dikirim lewat stdin agar kredensial tidak tampak di daftar proses. */
function curlPost(url: string, headers: Record<string, string>, body: unknown): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
  return new Promise((resolve, reject) => {
    const args = ['-4', '-s', '-X', 'POST', url, '--max-time', '30', '--data-binary', '@-']
    for (const [k, v] of Object.entries(headers)) args.push('-H', `${k}: ${v}`)
    const child = spawn('curl', args, { stdio: ['pipe', 'pipe', 'pipe'] })
    let out = ''
    let err = ''
    child.stdout.on('data', (d: Buffer) => (out += d.toString()))
    child.stderr.on('data', (d: Buffer) => (err += d.toString()))
    child.on('error', (e) => reject(new GoBizError(`curl tidak bisa dijalankan: ${e.message}`, 'GOBIZ_NETWORK')))
    child.on('close', (code) => {
      if (code !== 0) return reject(new GoBizError(`curl gagal (${code}): ${err.trim() || 'tanpa pesan'}`, 'GOBIZ_NETWORK'))
      try {
        resolve(JSON.parse(out))
      } catch {
        reject(new GoBizError('Respons GoBiz bukan JSON', 'GOBIZ_BAD_RESPONSE'))
      }
    })
    child.stdin.end(JSON.stringify(body))
  })
}

export const defaultHttp: GoBizHttp = {
  post: curlPost,
  fetch: (url, init) => fetch(url, init),
}

// ---------- cache token ----------

const memoryCache = new Map<string, { token?: string; merchantId?: string; merchantName?: string }>()
const cacheKey = (auth: GoBizAuth): string => `${auth.email ?? ''}|${normalizePhone(auth.phone ?? '')}|${auth.cacheFile ?? ''}`

/** Nama berkas cache bawaan skrip GoPayMerchant. */
export const DEFAULT_GOPAY_CACHE = './gopay_cache.json'

/**
 * Baca cache token. Format berkas `gopay_cache.json` milik skrip asli (`gopay_token`,
 * `gopay_merchant_id`) dan format ringkas (`token`, `merchantId`) sama-sama dikenali.
 */
function readFileCache(file: string | undefined): { token?: string; merchantId?: string; merchantName?: string } {
  if (!file) return {}
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8'))
    const token = raw.gopay_token ?? raw.token
    const merchantId = raw.gopay_merchant_id ?? raw.merchantId
    const merchantName = raw.gopay_merchant_name ?? raw.merchantName
    return { ...(token && { token }), ...(merchantId && { merchantId }), ...(merchantName && { merchantName }) }
  } catch {
    return {}
  }
}

function remember(auth: GoBizAuth, data: { token?: string; merchantId?: string; merchantName?: string }): void {
  const merged = { ...memoryCache.get(cacheKey(auth)), ...data }
  memoryCache.set(cacheKey(auth), merged)
  if (auth.cacheFile) {
    try {
      // pertahankan kunci lain di berkas, tulis dengan nama kunci skrip asli agar kompatibel
      let existing: Record<string, unknown> = {}
      try {
        existing = JSON.parse(readFileSync(auth.cacheFile, 'utf8'))
      } catch {
        /* berkas belum ada */
      }
      const out = { ...existing }
      if (data.token) out.gopay_token = data.token
      if (data.merchantId) out.gopay_merchant_id = data.merchantId
      if (data.merchantName) out.gopay_merchant_name = data.merchantName
      writeFileSync(auth.cacheFile, JSON.stringify(out, null, 2), { mode: 0o600 })
    } catch {
      /* cache bersifat opsional */
    }
  }
}

/** Hapus token tersimpan (memori) untuk akun ini. */
export const forgetGoBizSession = (auth: GoBizAuth): void => void memoryCache.delete(cacheKey(auth))

// ---------- util ----------

/** `08123…` / `+62 812…` / `62812…` → `812…` (tanpa kode negara). */
export function normalizePhone(phone: string): string {
  let p = phone.trim().replace(/\D/g, '')
  if (p.startsWith('62')) p = p.slice(2)
  else if (p.startsWith('0')) p = p.slice(1)
  return p
}

export const maskEmail = (email: string): string => email.replace(/^(.{2}).*(@.*)$/, '$1***$2')
export const maskPhone = (phone: string): string => {
  const p = normalizePhone(phone)
  return p.length > 5 ? `+62${p.slice(0, 3)}****${p.slice(-3)}` : `+62${p}`
}

const firstError = (data: any): string | undefined => data?.errors?.[0]?.message // eslint-disable-line @typescript-eslint/no-explicit-any

function toTokens(data: any): GoBizTokens { // eslint-disable-line @typescript-eslint/no-explicit-any
  if (!data?.access_token) throw new GoBizError('Respons login tidak memuat access_token', 'GOBIZ_BAD_RESPONSE')
  return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresIn: data.expires_in }
}

// ---------- QRIS ----------

/** CRC16-CCITT (poly 0x1021, init 0xFFFF) → 4 digit heksa kapital. */
export function crc16ccitt(input: string): string {
  let crc = 0xffff
  for (const byte of Buffer.from(input, 'utf8')) {
    crc ^= byte << 8
    for (let i = 0; i < 8; i++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff
  }
  return crc.toString(16).toUpperCase().padStart(4, '0')
}

/** QRIS statis → QRIS dinamis dengan nominal tertentu (Rupiah, bilangan bulat). */
export function buildDynamicQris(staticQris: string, amount: number): string {
  if (!staticQris) throw new GoBizError('String QRIS statis kosong', 'GOBIZ_INVALID_QRIS')
  if (!Number.isInteger(amount) || amount <= 0) throw new GoBizError('Nominal harus bilangan bulat > 0', 'GOBIZ_INVALID_AMOUNT')
  const data = staticQris.endsWith('6304') ? staticQris : staticQris.slice(0, -4)
  const step1 = data.replace('010211', '010212')
  if (!step1.includes('5802ID')) throw new GoBizError('Format QRIS tidak valid — pastikan string QRIS statis benar', 'GOBIZ_INVALID_QRIS')
  const [before, after] = step1.split('5802ID')
  const nominal = `54${String(amount).length.toString().padStart(2, '0')}${amount}`
  const raw = `${before}${nominal}5802ID${after}`
  return raw + crc16ccitt(raw)
}

/** Render QRIS menjadi PNG. Butuh paket opsional `qrcode` (npm i qrcode). */
export async function renderQrPng(qris: string): Promise<Buffer> {
  let mod: any // eslint-disable-line @typescript-eslint/no-explicit-any
  try {
    mod = await import('qrcode' as string)
  } catch {
    throw new GoBizError('Paket "qrcode" belum terpasang (npm i qrcode) — tidak bisa membuat gambar QR', 'GOBIZ_NO_QRCODE')
  }
  const lib = mod.default ?? mod
  const dataUrl: string = await lib.toDataURL(qris, { scale: 8, errorCorrectionLevel: 'M' })
  return Buffer.from(dataUrl.split(',')[1]!, 'base64')
}

// ---------- klien ----------

export class GoBizClient {
  readonly #http: GoBizHttp
  readonly #now: () => number
  readonly #tz: string

  constructor(options: GoBizOptions = {}) {
    this.#http = options.http ?? defaultHttp
    this.#now = options.now ?? Date.now
    this.#tz = options.timezone ?? 'Asia/Jakarta'
  }

  async loginWithPassword(email: string, password: string): Promise<GoBizTokens> {
    const headers = headersFor(randomUUID())
    // langkah 1: validasi email (peringatan saja bila gagal, seperti skrip asli)
    await this.#http.post(`${BASE_URL}/goid/login/request`, headers, { email, login_type: 'password', client_id: CLIENT_ID }).catch(() => undefined)
    const data = await this.#http.post(`${BASE_URL}/goid/token`, headers, { client_id: CLIENT_ID, grant_type: 'password', data: { email, password } })
    if (data?.errors?.length) throw new GoBizError(`Login gagal: ${firstError(data) ?? 'password salah atau akun bermasalah'}`, 'GOBIZ_LOGIN_FAILED')
    return toTokens(data)
  }

  /** Minta kode OTP ke nomor HP. Mengembalikan `otpToken` bila server menyediakannya. */
  async requestOtp(phone: string): Promise<{ phone: string; otpToken?: string }> {
    const normalized = normalizePhone(phone)
    if (normalized.length < 8) throw new GoBizError('Nomor HP tidak valid', 'GOBIZ_INVALID_PHONE')
    const data = await this.#http.post(`${BASE_URL}/goid/login/request`, headersFor(randomUUID()), {
      client_id: CLIENT_ID, phone_number: normalized, country_code: '62', login_type: 'otp',
    })
    if (data?.errors?.length) throw new GoBizError(`Request OTP gagal: ${firstError(data)}`, 'GOBIZ_OTP_REQUEST_FAILED')
    const body = data?.data ?? data
    const otpToken: string | undefined = body?.otp_token ?? body?.token
    return { phone: normalized, ...(otpToken && { otpToken }) }
  }

  async verifyOtp(input: { phone: string; otp: string; otpToken?: string }): Promise<GoBizTokens> {
    if (!input.otp?.trim()) throw new GoBizError('Kode OTP tidak boleh kosong', 'GOBIZ_OTP_EMPTY')
    const phone = normalizePhone(input.phone)
    const data = await this.#http.post(`${BASE_URL}/goid/token`, headersFor(randomUUID()), {
      client_id: CLIENT_ID,
      grant_type: 'otp',
      data: { otp: input.otp.trim(), ...(input.otpToken ? { otp_token: input.otpToken } : { phone_number: phone }) },
    })
    if (data?.errors?.length) throw new GoBizError(`Login OTP gagal: ${firstError(data) ?? 'kode OTP salah atau kedaluwarsa'}`, 'GOBIZ_LOGIN_FAILED')
    return toTokens(data)
  }

  async isTokenValid(token: string): Promise<boolean> {
    try {
      const res = await this.#http.fetch(`${BASE_URL}/v1/merchants/search`, {
        method: 'POST',
        headers: headersFor(randomUUID(), token),
        body: JSON.stringify({ from: 0, to: 1, _source: ['id'] }),
      })
      return res.status !== 401
    } catch {
      return false
    }
  }

  async getMerchants(token: string): Promise<Array<{ id: string; name?: string }>> {
    const res = await this.#http.fetch(`${BASE_URL}/v1/merchants/search`, {
      method: 'POST',
      headers: headersFor(randomUUID(), token),
      body: JSON.stringify({ from: 0, to: 50, _source: ['id', 'merchant_name'] }),
    })
    const data = await res.json()
    if (!res.ok) throw new GoBizError(`Gagal mengambil merchant (${res.status}): ${firstError(data) ?? 'autentikasi gagal'}`, 'GOBIZ_AUTH')
    const list: any[] = Array.isArray(data) ? data : data?.merchants ?? data?.hits?.hits?.map((h: any) => h._source ?? h) ?? data?.hits ?? data?.data ?? [] // eslint-disable-line @typescript-eslint/no-explicit-any
    return list.map((m) => ({ id: String(m.id ?? m.merchant_id), ...(m.merchant_name && { name: String(m.merchant_name) }) })).filter((m) => m.id !== 'undefined')
  }

  /**
   * Siapkan sesi: pakai token yang diberikan/tersimpan bila masih valid; selain itu login password.
   * Untuk akun OTP tanpa token valid → `GOBIZ_NEEDS_OTP` (jalankan `requestOtp` + `verifyOtp` dulu).
   */
  async ensureSession(auth: GoBizAuth): Promise<GoBizSession> {
    const cached = { ...readFileCache(auth.cacheFile), ...memoryCache.get(cacheKey(auth)) }
    let token = auth.token ?? cached.token
    if (!token || !(await this.isTokenValid(token))) {
      if (auth.email && auth.password) {
        token = (await this.loginWithPassword(auth.email, auth.password)).accessToken
        remember(auth, { token })
      } else {
        throw new GoBizError('Belum login: jalankan login OTP (sendLoginGobiz + sendOtpGobiz) atau berikan email & password', 'GOBIZ_NEEDS_OTP')
      }
    }
    let merchantId = auth.merchantId ?? cached.merchantId
    let merchantName = cached.merchantName
    if (!merchantId) {
      const merchants = await this.getMerchants(token)
      if (merchants.length === 0) throw new GoBizError('Tidak ada merchant yang terasosiasi dengan akun ini', 'GOBIZ_NO_MERCHANT')
      merchantId = merchants[0]!.id
      merchantName = merchants[0]!.name
      remember(auth, { token, merchantId, ...(merchantName && { merchantName }) })
    }
    return { token, merchantId, ...(merchantName && { merchantName }) }
  }

  /** Simpan token hasil login OTP agar bisa dipakai `ensureSession`. */
  storeToken(auth: GoBizAuth, token: string): void {
    remember(auth, { token })
  }

  async #authedRequest(auth: GoBizAuth, build: (session: GoBizSession) => { url: string; method: string; body?: string; accept?: string }): Promise<any> { // eslint-disable-line @typescript-eslint/no-explicit-any
    for (const attempt of [0, 1]) {
      const session = await this.ensureSession(attempt === 0 ? auth : { ...auth, token: undefined })
      const req = build(session)
      const res = await this.#http.fetch(req.url, {
        method: req.method,
        headers: { ...headersFor(randomUUID(), session.token), ...(req.accept && { accept: req.accept }) },
        ...(req.body && { body: req.body }),
      })
      if (res.status === 401 && attempt === 0) {
        forgetGoBizSession(auth)
        continue
      }
      if (!res.ok) throw new GoBizError(`HTTP ${res.status} dari GoBiz`, 'GOBIZ_HTTP')
      return res.json()
    }
    throw new GoBizError('Autentikasi GoBiz gagal', 'GOBIZ_AUTH')
  }

  /** Transaksi masuk (analytics v2, cadangan: journals) dalam `days` hari terakhir. */
  async getTransactions(auth: GoBizAuth, { days = 1, size = 50 }: { days?: number; size?: number } = {}): Promise<GoBizPayment[]> {
    const end = new Date(this.#now())
    const start = new Date(end.getTime() - days * 86_400_000)
    const analytics = await this.#authedRequest(auth, (s) => {
      const url = new URL('https://api.gojekapi.com/merchant-analytics/v2/merchants/transactions')
      url.searchParams.set('from', '0')
      url.searchParams.set('size', String(size))
      url.searchParams.set('statuses', 'SETTLEMENT,CAPTURE,REFUND,PARTIAL_REFUND')
      url.searchParams.set('payment_types', 'QRIS,GOPAY,OFFLINE_CREDIT_CARD,OFFLINE_DEBIT_CARD,CREDIT_CARD')
      url.searchParams.set('start_time', start.toISOString())
      url.searchParams.set('end_time', end.toISOString())
      url.searchParams.set('merchant_ids', s.merchantId)
      return { url: url.toString(), method: 'GET' }
    })
    if (Array.isArray(analytics?.transactions)) return analytics.transactions.map(toPayment)

    const journal = await this.#authedRequest(auth, (s) => ({
      url: `${BASE_URL}/journals/search`,
      method: 'POST',
      accept: 'application/json, text/plain, */*, application/vnd.journal.v1+json',
      body: JSON.stringify(journalQuery(s.merchantId, start.toISOString(), end.toISOString(), size)),
    }))
    return (Array.isArray(journal?.data) ? journal.data : [])
      .filter((item: any) => item?.metadata?.transaction) // eslint-disable-line @typescript-eslint/no-explicit-any
      .map((item: any) => toPayment(item.metadata.transaction, item)) // eslint-disable-line @typescript-eslint/no-explicit-any
  }

  /** Cari pembayaran dengan nominal tertentu yang masuk setelah `since` (ms epoch). */
  async findPayment(auth: GoBizAuth, { amount, since = 0, days = 1, tolerance = 0, exclude }: { amount: number; since?: number; days?: number; tolerance?: number; /** ID transaksi yang sudah dipakai pesanan lain. */ exclude?: ReadonlySet<string> }): Promise<GoBizPayment | undefined> {
    const list = await this.getTransactions(auth, { days, size: 50 })
    return list.find((p) => Math.abs(p.amount - amount) <= tolerance && Date.parse(p.time) >= since && !exclude?.has(p.id))
  }

  /** Tunggu pembayaran masuk sampai `timeoutMs`; mengembalikan `undefined` bila habis waktu. */
  async waitForPayment(
    auth: GoBizAuth,
    { amount, since = this.#now(), timeoutMs = 5 * 60_000, intervalMs = 6_000, tolerance = 0 }: { amount: number; since?: number; timeoutMs?: number; intervalMs?: number; tolerance?: number },
  ): Promise<GoBizPayment | undefined> {
    const deadline = this.#now() + timeoutMs
    for (;;) {
      const found = await this.findPayment(auth, { amount, since, tolerance })
      if (found) return found
      if (this.#now() + intervalMs > deadline) return undefined
      await new Promise((r) => setTimeout(r, intervalMs))
    }
  }

  /** Waktu lokal (zona konfigurasi) untuk pesan, mis. `22 Nov 2026 14.05`. */
  formatTime(iso: string | number | Date): string {
    return new Intl.DateTimeFormat('id-ID', { timeZone: this.#tz, dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(iso))
  }
}

function toPayment(tx: any, raw: unknown = tx): GoBizPayment { // eslint-disable-line @typescript-eslint/no-explicit-any
  const gross = typeof tx.gross_amount === 'number' ? tx.gross_amount : Number(tx.gross_amount ?? 0)
  return {
    id: String(tx.transaction_id ?? tx.id ?? tx.order_id ?? `${tx.transaction_time}_${gross}`),
    amount: gross / 100,
    time: tx.transaction_time ?? '',
    raw,
  }
}

function journalQuery(merchantId: string, start: string, end: string, size: number) {
  const sources = ['GOSAVE_ONLINE', 'GoSave', 'GODEALS_ONLINE']
  return {
    from: 0,
    size,
    sort: { time: { order: 'desc' } },
    included_categories: { incoming: ['transaction_share', 'action'] },
    query: [{
      op: 'and',
      clauses: [
        { op: 'not', clauses: [{ op: 'or', clauses: [
          { field: 'metadata.source', op: 'in', value: sources },
          { field: 'metadata.gopay.source', op: 'in', value: sources },
        ] }] },
        { field: 'metadata.transaction.status', op: 'in', value: ['settlement', 'capture', 'refund', 'partial_refund'] },
        { op: 'or', clauses: [{ op: 'or', clauses: [{ field: 'metadata.transaction.payment_type', op: 'in', value: ['qris', 'gopay', 'offline_credit_card', 'offline_debit_card', 'credit_card'] }] }] },
        { field: 'metadata.transaction.transaction_time', op: 'gte', value: start },
        { field: 'metadata.transaction.transaction_time', op: 'lte', value: end },
        { field: 'metadata.transaction.merchant_id', op: 'equal', value: merchantId },
      ],
    }],
  }
}
