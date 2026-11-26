/**
 * Fungsi `sock.*Gobiz` — jembatan antara klien GoBiz (`gobiz.ts`) dan pengiriman pesan WhatsApp.
 * Dipisah dari fitur kirim pesan biasa. Semua pengaturan (QRIS, email, password, nomor, dll.)
 * diberikan pada pemanggilan fungsi masing-masing; tidak ada pengaturan global.
 *
 * Aturan pesan: bila ada gambar → dikirim sebagai foto dengan `caption`; bila tidak → teks (`text`).
 */
import type { SendOptions } from '../messages/send-message.js'
import type { SockContextShortcuts, SockMediaSource, SockSendMessage } from '../sock-api.js'
import {
  buildDynamicQris, GoBizClient, GoBizError, maskEmail, maskPhone, normalizePhone, renderQrPng,
  type GoBizAuth, type GoBizOptions, type GoBizPayment,
} from './gobiz.js'

export type GobizTemplate<V> = string | ((vars: V) => string)

/** Opsi pengiriman pesan yang dipakai bersama semua fungsi Gobiz. */
export interface GobizSendOptions {
  /** Opsi kirim (`quoted`, `contextInfo`, `ephemeralExpiration`, dll.). */
  send?: SendOptions
  /** Tambahan isi pesan: `externalAdReply`, `forwardedNewsletter`, `mentionAll`, dll. */
  extra?: SockContextShortcuts
  /** Opsi klien GoBiz (mis. zona waktu); umumnya tidak perlu diisi. */
  gobiz?: GoBizOptions
}

const fill = <V extends object>(tpl: GobizTemplate<V> | undefined, vars: V, fallback: string): string => {
  const raw = typeof tpl === 'function' ? tpl(vars) : tpl ?? fallback
  return raw.replace(/\{(\w+)\}/g, (_m, k: string) => String((vars as Record<string, unknown>)[k] ?? ''))
}

export interface GobizCreatePaymentVars { amount: string; rawAmount: number; orderId: string; expires: string; qris: string; merchant: string }
export type GobizPaymentStatus = 'paid' | 'pending' | 'timeout' | 'error'
export interface GobizStatusVars { amount: string; rawAmount: number; orderId: string; time: string; status: GobizPaymentStatus; error: string }
export interface GobizLoginVars { method: string; account: string; merchant: string; error: string }
type CreatePaymentVars = GobizCreatePaymentVars
type PaymentStatus = GobizPaymentStatus
type StatusVars = GobizStatusVars
type LoginVars = GobizLoginVars

const rupiah = (n: number): string => `Rp ${n.toLocaleString('id-ID')}`

export function createGobizApi(sendMessage: SockSendMessage) {
  /** Foto + caption bila ada gambar, selain itu teks. */
  async function deliver(
    jid: string,
    message: { image?: SockMediaSource | undefined; caption: string; text: string },
    opts: GobizSendOptions,
  ) {
    const content = message.image !== undefined
      ? { image: message.image, caption: message.caption, ...opts.extra }
      : { text: message.text, ...opts.extra }
    return sendMessage(jid, content as never, opts.send)
  }

  // ------------------------------------------------------------------ buat pembayaran
  async function sendCreatePaymentGobiz(
    jid: string,
    options: GobizSendOptions & {
      /** String QRIS statis milik merchant (data QR dari pemilik bot). */
      qris: string
      /** Nominal dalam Rupiah (bilangan bulat). */
      amount: number
      orderId?: string
      /** Masa berlaku yang ditampilkan di pesan (ms, default 10 menit). */
      expiresInMs?: number
      merchantName?: string
      /** `true`/kosong: buat gambar QR otomatis; `false`: hanya teks; atau sumber gambar sendiri (link/path/Buffer). */
      image?: boolean | SockMediaSource
      /** Dipakai bila ada foto. Placeholder: {amount} {orderId} {expires} {qris} {merchant}. */
      caption?: GobizTemplate<CreatePaymentVars>
      /** Dipakai bila tidak ada foto. */
      text?: GobizTemplate<CreatePaymentVars>
    },
  ) {
    const orderId = options.orderId ?? `INV-${Date.now().toString(36).toUpperCase()}`
    const qris = buildDynamicQris(options.qris, options.amount)
    const since = Date.now()
    const expiresAt = since + (options.expiresInMs ?? 10 * 60_000)
    const client = new GoBizClient(options.gobiz)
    const vars: CreatePaymentVars = {
      amount: rupiah(options.amount), rawAmount: options.amount, orderId, expires: client.formatTime(expiresAt), qris, merchant: options.merchantName ?? '',
    }
    const defaultCaption = '💳 *PEMBAYARAN QRIS*\n\nOrder: {orderId}\nNominal: *{amount}*\nBerlaku sampai: {expires}\n\nScan QR di atas dengan e-wallet atau m-banking apa pun.'
    const defaultText = `${defaultCaption.replace('QR di atas', 'kode QRIS di bawah')}\n\n{qris}`

    let image: SockMediaSource | undefined
    let reason: string | undefined
    if (options.image === false) image = undefined
    else if (options.image === undefined || options.image === true) {
      try {
        image = await renderQrPng(qris)
      } catch (error) {
        if (!(error instanceof GoBizError) || error.code !== 'GOBIZ_NO_QRCODE') throw error
        reason = error.message // paket qrcode tidak ada → fallback teks
      }
    } else image = options.image

    const message = await deliver(jid, { image, caption: fill(options.caption, vars, defaultCaption), text: fill(options.text, vars, defaultText) }, options)
    return { message, orderId, amount: options.amount, qris, since, expiresAt, imageSent: image !== undefined, ...(reason && { reason }) }
  }

  // ------------------------------------------------------------------ status pembayaran
  async function sendStatusPaymentGobiz(
    jid: string,
    options: GobizSendOptions & {
      /**
       * Akun GoBiz. Boleh dikosongkan bila memakai `cacheFile`: token dan merchant diambil dari berkas cache.
       */
      auth?: GoBizAuth
      /** Berkas cache token (mis. `./gopay_cache.json`) sebagai sumber `auth`. */
      cacheFile?: string
      /** Nominal Rupiah yang ditunggu. */
      amount: number
      orderId?: string
      /** Hanya hitung pembayaran setelah waktu ini (ms epoch; pakai `since` dari sendCreatePaymentGobiz). */
      since?: number
      /** `true`/objek: tunggu sampai ada pembayaran atau habis waktu; kosong: cek sekali. */
      wait?: boolean | { timeoutMs?: number; intervalMs?: number }
      tolerance?: number
      /** Teks per status (atau satu template untuk semuanya). Dipakai bila tidak ada foto. */
      text?: Partial<Record<PaymentStatus, GobizTemplate<StatusVars>>> | GobizTemplate<StatusVars>
      /** Caption per status bila ada foto. */
      caption?: Partial<Record<PaymentStatus, GobizTemplate<StatusVars>>> | GobizTemplate<StatusVars>
      /** Foto per status (link/path/Buffer); status tanpa foto dikirim sebagai teks. */
      image?: Partial<Record<PaymentStatus, SockMediaSource>>
      /** Kirim pesan juga saat error (default true). */
      notifyOnError?: boolean
    },
  ) {
    const client = new GoBizClient(options.gobiz)
    const orderId = options.orderId ?? ''
    const auth: GoBizAuth = { ...options.auth, ...(options.cacheFile && { cacheFile: options.cacheFile }) }
    let status: PaymentStatus
    let payment: GoBizPayment | undefined
    let error = ''
    try {
      if (!auth.cacheFile && !auth.token && !(auth.email && auth.password) && !auth.phone) throw new GoBizError('Isi auth atau cacheFile (mis. ./gopay_cache.json)', 'GOBIZ_INVALID_AUTH')
      const query = { amount: options.amount, ...(options.since !== undefined && { since: options.since }), ...(options.tolerance !== undefined && { tolerance: options.tolerance }) }
      if (options.wait) {
        const w = options.wait === true ? {} : options.wait
        payment = await client.waitForPayment(auth, { ...query, ...w })
        status = payment ? 'paid' : 'timeout'
      } else {
        payment = await client.findPayment(auth, query)
        status = payment ? 'paid' : 'pending'
      }
    } catch (e) {
      status = 'error'
      error = e instanceof Error ? e.message : String(e)
    }

    const vars: StatusVars = {
      amount: rupiah(options.amount), rawAmount: options.amount, orderId, status, error,
      time: payment?.time ? client.formatTime(payment.time) : '',
    }
    const defaults: Record<PaymentStatus, string> = {
      paid: '✅ *PEMBAYARAN DITERIMA*\n\nNominal: *{amount}*\nOrder: {orderId}\nWaktu: {time}',
      pending: '⏳ Pembayaran *{amount}* belum terdeteksi.\nOrder: {orderId}\nSilakan selesaikan pembayaran lalu cek lagi.',
      timeout: '⌛ Waktu tunggu habis. Pembayaran *{amount}* belum diterima.\nOrder: {orderId}',
      error: '⚠️ Gagal memeriksa pembayaran: {error}',
    }
    const pick = (tpl: typeof options.text): GobizTemplate<StatusVars> | undefined =>
      tpl && typeof tpl === 'object' ? (tpl as Partial<Record<PaymentStatus, GobizTemplate<StatusVars>>>)[status] : (tpl as GobizTemplate<StatusVars> | undefined)
    const image = options.image?.[status]

    let message
    if (status !== 'error' || options.notifyOnError !== false) {
      message = await deliver(jid, { image, caption: fill(pick(options.caption), vars, defaults[status]), text: fill(pick(options.text), vars, defaults[status]) }, options)
    }
    return { status, ...(payment && { payment }), ...(error && { error }), ...(message && { message }) }
  }

  // ------------------------------------------------------------------ login
  const pendingOtp = new Map<string, string>() // nomor ternormalisasi → otpToken

  async function sendLoginGobiz(
    jid: string,
    options: GobizSendOptions & {
      /** `{ email, password }` untuk login password, atau `{ phone }` untuk meminta OTP. */
      auth: GoBizAuth
      image?: SockMediaSource
      caption?: GobizTemplate<LoginVars>
      text?: GobizTemplate<LoginVars>
    },
  ) {
    const client = new GoBizClient(options.gobiz)
    const { auth } = options
    const send = (vars: LoginVars, fallback: string) =>
      deliver(jid, { image: options.image, caption: fill(options.caption, vars, fallback), text: fill(options.text, vars, fallback) }, options)
    try {
      if (auth.email && auth.password) {
        const tokens = await client.loginWithPassword(auth.email, auth.password)
        client.storeToken(auth, tokens.accessToken)
        const session = await client.ensureSession({ ...auth, token: tokens.accessToken })
        const message = await send({ method: 'password', account: maskEmail(auth.email), merchant: session.merchantName ?? session.merchantId, error: '' }, '✅ *Login GoBiz berhasil*\n\nAkun: {account}\nMerchant: {merchant}')
        return { ok: true as const, method: 'password' as const, merchantId: session.merchantId, ...(session.merchantName && { merchantName: session.merchantName }), message }
      }
      if (auth.phone) {
        const { phone, otpToken } = await client.requestOtp(auth.phone)
        if (otpToken) pendingOtp.set(phone, otpToken)
        const message = await send({ method: 'otp', account: maskPhone(phone), merchant: '', error: '' }, '📲 *Kode OTP GoBiz dikirim*\n\nKe nomor: {account}\nLanjutkan dengan sock.sendOtpGobiz(...) memakai kode tersebut.')
        return { ok: true as const, method: 'otp' as const, ...(otpToken && { otpToken }), message }
      }
      throw new GoBizError('auth harus berisi { email, password } atau { phone }', 'GOBIZ_INVALID_AUTH')
    } catch (e) {
      const errorText = e instanceof Error ? e.message : String(e)
      const message = await send({ method: auth.phone && !auth.email ? 'otp' : 'password', account: '', merchant: '', error: errorText }, '❌ *Login GoBiz gagal*\n{error}')
      return { ok: false as const, error: errorText, message }
    }
  }

  // ------------------------------------------------------------------ verifikasi OTP
  async function sendOtpGobiz(
    jid: string,
    options: GobizSendOptions & {
      /** `{ phone }` yang sama dengan saat meminta OTP. */
      auth: GoBizAuth
      /** Kode OTP dari SMS/WhatsApp. */
      otp: string
      /** Opsional; default memakai token OTP yang disimpan oleh sendLoginGobiz. */
      otpToken?: string
      image?: SockMediaSource
      caption?: GobizTemplate<LoginVars>
      text?: GobizTemplate<LoginVars>
    },
  ) {
    const client = new GoBizClient(options.gobiz)
    const { auth } = options
    const send = (vars: LoginVars, fallback: string) =>
      deliver(jid, { image: options.image, caption: fill(options.caption, vars, fallback), text: fill(options.text, vars, fallback) }, options)
    try {
      if (!auth.phone) throw new GoBizError('auth.phone wajib untuk verifikasi OTP', 'GOBIZ_INVALID_AUTH')
      const phone = normalizePhone(auth.phone)
      const otpToken = options.otpToken ?? pendingOtp.get(phone)
      const tokens = await client.verifyOtp({ phone, otp: options.otp, ...(otpToken && { otpToken }) })
      pendingOtp.delete(phone)
      client.storeToken(auth, tokens.accessToken)
      const session = await client.ensureSession({ ...auth, token: tokens.accessToken })
      const message = await send({ method: 'otp', account: maskPhone(phone), merchant: session.merchantName ?? session.merchantId, error: '' }, '✅ *Login OTP GoBiz berhasil*\n\nAkun: {account}\nMerchant: {merchant}')
      return { ok: true as const, merchantId: session.merchantId, ...(session.merchantName && { merchantName: session.merchantName }), message }
    } catch (e) {
      const errorText = e instanceof Error ? e.message : String(e)
      const message = await send({ method: 'otp', account: auth.phone ? maskPhone(auth.phone) : '', merchant: '', error: errorText }, '❌ *Verifikasi OTP gagal*\n{error}')
      return { ok: false as const, error: errorText, message }
    }
  }

  return { sendCreatePaymentGobiz, sendStatusPaymentGobiz, sendLoginGobiz, sendOtpGobiz }
}

export type GobizApi = ReturnType<typeof createGobizApi>
