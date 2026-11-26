/**
 * Sistem jual-beli untuk AI: katalog, keranjang, pesanan, pembayaran QRIS (GoBiz) dan pengiriman
 * produk otomatis. Semua angka penting (harga, total, status bayar) dihitung/diverifikasi di kode,
 * BUKAN oleh model AI, sehingga tidak bisa dimanipulasi lewat percakapan.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { buildDynamicQris, GoBizClient, type GoBizAuth, type GoBizOptions, type GoBizPayment } from '../gobiz/gobiz.js'
import type { AiTool, AiToolContext } from './types.js'

export interface ShopProduct {
  id: string
  name: string
  /** Harga Rupiah (bilangan bulat). */
  price: number
  description?: string
  category?: string
  /** URL atau path gambar produk. */
  image?: string
  /** Stok; `null`/kosong = tak terbatas. Berkurang otomatis saat terbayar. */
  stock?: number | null
  /** Isi yang dikirim ke pembeli setelah terbayar (akun, kode voucher, tautan unduh, dll.). */
  deliver?: string | ((order: ShopOrder, item: { product: ShopProduct; qty: number }) => string | Promise<string>)
}

export interface ShopPaymentConfig {
  /** String QRIS statis milik merchant. */
  qris: string
  /** Berkas cache token (mis. `./gopay_cache.json`). */
  cacheFile?: string
  /** Atau akun GoBiz langsung. */
  auth?: GoBizAuth
  merchantName?: string
  /** Masa berlaku pesanan (ms, default 10 menit). */
  expiresInMs?: number
  /** Tambahkan kode unik 1..N Rupiah agar nominal tiap pesanan berbeda (default aktif, N=99). */
  uniqueCode?: boolean | { max: number }
  gobiz?: GoBizOptions
}

export interface ShopOrderItem { productId: string; name: string; price: number; qty: number }

export interface ShopOrder {
  id: string
  jid: string
  buyer: string
  items: ShopOrderItem[]
  subtotal: number
  uniqueCode: number
  total: number
  status: 'pending' | 'paid' | 'expired' | 'cancelled'
  createdAt: number
  expiresAt: number
  paidAt?: number
  paymentId?: string
  delivered?: boolean
}

export interface ShopConfig {
  name?: string
  products: ShopProduct[] | (() => ShopProduct[] | Promise<ShopProduct[]>)
  payment: ShopPaymentConfig
  /** Simpan keranjang & pesanan ke berkas JSON (disarankan agar pesanan tidak hilang saat restart). */
  storeFile?: string
  /** JID pemilik yang diberi tahu saat ada pembayaran / stok kurang. */
  ownerJids?: string[]
  maxQtyPerItem?: number
  maxPendingOrders?: number
  /** Cek pembayaran otomatis di latar belakang (default true). */
  autoVerify?: boolean
  verifyIntervalMs?: number
  /** Dipanggil setelah pembayaran terverifikasi dan produk terkirim. */
  onPaid?: (order: ShopOrder, ctx: { sock: AiToolContext['sock'] }) => void | Promise<void>
  texts?: Partial<ShopTexts>
}

export interface ShopTexts {
  menuTitle: string
  menuBody: (shop: string) => string
  empty: string
  added: (name: string, qty: number) => string
  cartHeader: string
  checkoutNeedsItems: string
  paid: (o: ShopOrder) => string
  pending: (o: ShopOrder) => string
  expired: (o: ShopOrder) => string
  cancelled: (o: ShopOrder) => string
  outOfStock: (name: string) => string
}

const limited = (p: { stock?: number | null }): boolean => p.stock !== null && p.stock !== undefined

export const rupiah = (n: number): string => `Rp ${n.toLocaleString('id-ID')}`

const DEFAULT_TEXTS: ShopTexts = {
  menuTitle: 'Katalog',
  menuBody: (shop) => `Selamat datang di *${shop}*! Pilih produk dari daftar di bawah.`,
  empty: '🛒 Keranjang masih kosong.',
  added: (name, qty) => `✅ *${name}* ×${qty} masuk keranjang.`,
  cartHeader: '🛒 *Keranjang Anda*',
  checkoutNeedsItems: 'Keranjang kosong, tambahkan produk dulu ya.',
  paid: (o) => `✅ *Pembayaran diterima!*\nPesanan *${o.id}* — ${rupiah(o.total)}\nTerima kasih sudah berbelanja.`,
  pending: (o) => `⏳ Pembayaran pesanan *${o.id}* (${rupiah(o.total)}) belum terdeteksi. Selesaikan pembayaran lalu cek lagi.`,
  expired: (o) => `⌛ Pesanan *${o.id}* kedaluwarsa karena belum dibayar.`,
  cancelled: (o) => `❌ Pesanan *${o.id}* dibatalkan.`,
  outOfStock: (name) => `Maaf, stok *${name}* tidak mencukupi.`,
}

interface Store {
  carts: Record<string, Array<{ productId: string; qty: number }>>
  orders: Record<string, ShopOrder>
  usedPaymentIds: string[]
}

export class Shop {
  readonly #cfg: ShopConfig
  readonly texts: ShopTexts
  readonly #sock: AiToolContext['sock']
  #store: Store = { carts: {}, orders: {}, usedPaymentIds: [] }
  readonly #watching = new Map<string, NodeJS.Timeout>()
  readonly #verifying = new Set<string>()
  readonly #gobiz: GoBizClient
  #saveTimer?: NodeJS.Timeout
  #catalog?: ShopProduct[]

  constructor(sock: AiToolContext['sock'], config: ShopConfig) {
    if (!config.payment?.qris) throw new Error('shop.payment.qris wajib diisi (QRIS statis merchant)')
    buildDynamicQris(config.payment.qris, 1000) // validasi format QRIS sejak awal
    if (!config.payment.cacheFile && !config.payment.auth) throw new Error('shop.payment butuh cacheFile (mis. ./gopay_cache.json) atau auth GoBiz')
    this.#cfg = config
    this.#sock = sock
    this.texts = { ...DEFAULT_TEXTS, ...config.texts }
    this.#gobiz = new GoBizClient(config.payment.gobiz)
    if (config.storeFile) {
      try {
        this.#store = { ...this.#store, ...JSON.parse(readFileSync(config.storeFile, 'utf8')) }
      } catch {
        /* berkas belum ada */
      }
    }
  }

  get name(): string { return this.#cfg.name ?? 'Toko' }
  get owners(): string[] { return this.#cfg.ownerJids ?? [] }
  get #auth(): GoBizAuth { return { ...this.#cfg.payment.auth, ...(this.#cfg.payment.cacheFile && { cacheFile: this.#cfg.payment.cacheFile }) } }

  // ---------------------------------------------------------------- katalog
  async products(): Promise<ShopProduct[]> {
    const src = this.#cfg.products
    this.#catalog = typeof src === 'function' ? await src() : src
    return this.#catalog
  }
  async product(id: string): Promise<ShopProduct | undefined> {
    return (await this.products()).find((p) => p.id.toLowerCase() === id.trim().toLowerCase())
  }
  async search(query?: string, category?: string): Promise<ShopProduct[]> {
    const q = query?.toLowerCase().trim()
    return (await this.products()).filter((p) =>
      (!category || p.category?.toLowerCase() === category.toLowerCase()) &&
      (!q || `${p.id} ${p.name} ${p.description ?? ''} ${p.category ?? ''}`.toLowerCase().includes(q)))
  }
  /** Data produk yang aman diberikan ke model (tanpa isi `deliver`). */
  publicView(p: ShopProduct) {
    return { id: p.id, name: p.name, price: p.price, priceText: rupiah(p.price), description: p.description, category: p.category, inStock: !limited(p) || p.stock! > 0, ...(limited(p) && { stock: p.stock! }) }
  }

  // ---------------------------------------------------------------- keranjang
  async addToCart(jid: string, productId: string, qty = 1): Promise<{ ok: boolean; reason?: string; name?: string; qty?: number }> {
    const product = await this.product(productId)
    if (!product) return { ok: false, reason: 'Produk tidak ditemukan' }
    const q = Math.max(1, Math.min(Math.floor(qty) || 1, this.#cfg.maxQtyPerItem ?? 20))
    const cart = (this.#store.carts[jid] ??= [])
    const line = cart.find((l) => l.productId === product.id)
    const next = Math.min((line?.qty ?? 0) + q, this.#cfg.maxQtyPerItem ?? 20)
    if (limited(product) && next > product.stock!) return { ok: false, reason: this.texts.outOfStock(product.name), name: product.name }
    if (line) line.qty = next
    else cart.push({ productId: product.id, qty: next })
    this.#persist()
    return { ok: true, name: product.name, qty: next }
  }
  removeFromCart(jid: string, productId: string): boolean {
    const cart = this.#store.carts[jid] ?? []
    const i = cart.findIndex((l) => l.productId.toLowerCase() === productId.toLowerCase())
    if (i < 0) return false
    cart.splice(i, 1)
    this.#persist()
    return true
  }
  clearCart(jid: string): void {
    delete this.#store.carts[jid]
    this.#persist()
  }
  async cart(jid: string): Promise<{ items: ShopOrderItem[]; subtotal: number }> {
    const lines = this.#store.carts[jid] ?? []
    const items: ShopOrderItem[] = []
    for (const l of lines) {
      const p = await this.product(l.productId)
      if (p) items.push({ productId: p.id, name: p.name, price: p.price, qty: l.qty })
    }
    return { items, subtotal: items.reduce((s, i) => s + i.price * i.qty, 0) }
  }
  cartText(c: { items: ShopOrderItem[]; subtotal: number }): string {
    if (c.items.length === 0) return this.texts.empty
    return `${this.texts.cartHeader}\n\n${c.items.map((i) => `• ${i.name} ×${i.qty} — ${rupiah(i.price * i.qty)}`).join('\n')}\n\n*Subtotal: ${rupiah(c.subtotal)}*`
  }

  // ---------------------------------------------------------------- pesanan
  orders(jid: string): ShopOrder[] {
    return Object.values(this.#store.orders).filter((o) => o.jid === jid).sort((a, b) => b.createdAt - a.createdAt).slice(0, 5)
  }
  order(id: string): ShopOrder | undefined { return this.#store.orders[id.trim().toUpperCase()] }

  /** Buat pesanan dari keranjang. Harga dihitung dari katalog; total diberi kode unik. */
  async checkout(jid: string, buyer: string): Promise<{ ok: true; order: ShopOrder } | { ok: false; reason: string }> {
    const cart = await this.cart(jid)
    if (cart.items.length === 0) return { ok: false, reason: this.texts.checkoutNeedsItems }
    const pending = this.orders(jid).filter((o) => o.status === 'pending')
    if (pending.length >= (this.#cfg.maxPendingOrders ?? 3)) return { ok: false, reason: 'Masih ada pesanan yang belum dibayar. Bayar atau batalkan dulu.' }
    for (const i of cart.items) {
      const p = await this.product(i.productId)
      if (p && limited(p) && i.qty > p.stock!) return { ok: false, reason: this.texts.outOfStock(p.name) }
    }
    const unique = this.#cfg.payment.uniqueCode
    const max = unique === false ? 0 : typeof unique === 'object' ? unique.max : 99
    const taken = new Set(Object.values(this.#store.orders).filter((o) => o.status === 'pending').map((o) => o.total))
    let code = 0
    let total = cart.subtotal
    if (max > 0) {
      const tries = Array.from({ length: max }, (_, i) => i + 1).sort(() => Math.random() - 0.5)
      const free = tries.find((c) => !taken.has(cart.subtotal + c))
      if (free === undefined) return { ok: false, reason: 'Sistem sedang penuh, coba beberapa menit lagi.' }
      code = free
      total = cart.subtotal + code
    } else if (taken.has(total)) return { ok: false, reason: 'Ada pesanan lain dengan nominal sama, coba lagi sebentar.' }
    const now = Date.now()
    const order: ShopOrder = {
      id: `ORD-${now.toString(36).toUpperCase()}${Math.floor(Math.random() * 36).toString(36).toUpperCase()}`,
      jid, buyer, items: cart.items, subtotal: cart.subtotal, uniqueCode: code, total, status: 'pending',
      createdAt: now, expiresAt: now + (this.#cfg.payment.expiresInMs ?? 10 * 60_000),
    }
    this.#store.orders[order.id] = order
    this.clearCart(jid)
    this.#persist()
    return { ok: true, order }
  }

  /** Kirim tagihan QRIS (foto + caption, atau teks bila `qrcode` tak terpasang). */
  async sendInvoice(order: ShopOrder): Promise<void> {
    const lines = order.items.map((i) => `• ${i.name} ×${i.qty} — ${rupiah(i.price * i.qty)}`).join('\n')
    const code = order.uniqueCode ? `\nKode unik: ${order.uniqueCode}` : ''
    await this.#sock.sendCreatePaymentGobiz(order.jid, {
      qris: this.#cfg.payment.qris, amount: order.total, orderId: order.id,
      expiresInMs: Math.max(1000, order.expiresAt - Date.now()),
      ...(this.#cfg.payment.merchantName && { merchantName: this.#cfg.payment.merchantName }),
      caption: `🧾 *TAGIHAN ${order.id}*\n\n${lines}${code}\n\nTotal: *${rupiah(order.total)}*\nBerlaku sampai: {expires}\n\nScan QR di atas, bayar *tepat ${rupiah(order.total)}*.`,
      text: `🧾 *TAGIHAN ${order.id}*\n\n${lines}${code}\n\nTotal: *${rupiah(order.total)}*\nBerlaku sampai: {expires}\n\nBayar *tepat ${rupiah(order.total)}* via QRIS:\n{qris}`,
    })
  }

  /** Cek pembayaran ke GoBiz. Idempotent: pesanan hanya bisa menjadi `paid` sekali. */
  async verify(orderId: string): Promise<{ order: ShopOrder; changed: boolean }> {
    const order = this.order(orderId)
    if (!order) throw new Error('Pesanan tidak ditemukan')
    if (order.status !== 'pending' || this.#verifying.has(order.id)) return { order, changed: false }
    this.#verifying.add(order.id)
    try {
      const payment = await this.#gobiz.findPayment(this.#auth, { amount: order.total, since: order.createdAt - 60_000, exclude: new Set(this.#store.usedPaymentIds) })
      if (payment) {
        await this.#markPaid(order, payment)
        return { order, changed: true }
      }
      if (Date.now() > order.expiresAt) {
        order.status = 'expired'
        this.#persist()
        this.#unwatch(order.id)
        return { order, changed: true }
      }
      return { order, changed: false }
    } finally {
      this.#verifying.delete(order.id)
    }
  }

  cancel(orderId: string, jid: string): ShopOrder | undefined {
    const order = this.order(orderId)
    if (!order || order.jid !== jid || order.status !== 'pending') return undefined
    order.status = 'cancelled'
    this.#unwatch(order.id)
    this.#persist()
    return order
  }

  async #markPaid(order: ShopOrder, payment: GoBizPayment): Promise<void> {
    if (order.status !== 'pending') return
    order.status = 'paid'
    order.paidAt = Date.now()
    order.paymentId = payment.id
    this.#store.usedPaymentIds = [...this.#store.usedPaymentIds, payment.id].slice(-500)
    this.#unwatch(order.id)
    this.#persist()
    await this.#deliver(order)
  }

  async #deliver(order: ShopOrder): Promise<void> {
    const sock = this.#sock
    const problems: string[] = []
    const parts: string[] = []
    for (const item of order.items) {
      const product = await this.product(item.productId)
      if (!product) { problems.push(`${item.name}: produk sudah tidak ada`); continue }
      if (limited(product) && product.stock! < item.qty) { problems.push(`${item.name}: stok kurang (sisa ${product.stock!})`); continue }
      if (limited(product)) product.stock! -= item.qty
      if (product.deliver) {
        const out = typeof product.deliver === 'function' ? await product.deliver(order, { product, qty: item.qty }) : product.deliver
        parts.push(`📦 *${item.name}* ×${item.qty}\n${out}`)
      }
    }
    await sock.sendMessage(order.jid, { text: `${this.texts.paid(order)}${parts.length ? `\n\n${parts.join('\n\n')}` : ''}` } as never).catch(() => undefined)
    order.delivered = problems.length === 0
    this.#persist()
    for (const o of this.owners) {
      await sock.sendMessage(o, { text: `💰 *Pembayaran masuk*\nPesanan: ${order.id}\nPembeli: ${order.buyer}\nTotal: ${rupiah(order.total)}${problems.length ? `\n\n⚠️ *Perlu tindakan manual:*\n${problems.join('\n')}` : ''}` } as never).catch(() => undefined)
    }
    if (problems.length) await sock.sendMessage(order.jid, { text: 'Sebagian pesanan perlu diproses manual oleh admin. Mohon tunggu, kami segera menghubungi Anda.' } as never).catch(() => undefined)
    await this.#cfg.onPaid?.(order, { sock })
  }

  // ---------------------------------------------------------------- pemantauan otomatis
  /** Mulai cek otomatis untuk pesanan ini sampai terbayar/kedaluwarsa. */
  watch(order: ShopOrder): void {
    if (this.#cfg.autoVerify === false || this.#watching.has(order.id)) return
    const interval = this.#cfg.verifyIntervalMs ?? 8_000
    const tick = (): void => {
      this.#watching.delete(order.id)
      this.verify(order.id)
        .then(async ({ order: o, changed }) => {
          if (o.status === 'pending') this.#schedule(o, interval, tick)
          else if (changed && o.status === 'expired') await this.#sock.sendMessage(o.jid, { text: this.texts.expired(o) } as never).catch(() => undefined)
        })
        .catch(() => this.#schedule(order, interval * 3, tick)) // gangguan sementara: coba lagi lebih lambat
    }
    this.#schedule(order, interval, tick)
  }
  #schedule(order: ShopOrder, ms: number, fn: () => void): void {
    if (order.status !== 'pending') return
    const t = setTimeout(fn, ms)
    t.unref?.()
    this.#watching.set(order.id, t)
  }
  #unwatch(id: string): void {
    const t = this.#watching.get(id)
    if (t) clearTimeout(t)
    this.#watching.delete(id)
  }
  /** Lanjutkan pemantauan pesanan tertunda (panggil setelah bot terhubung). */
  resume(): void {
    for (const o of Object.values(this.#store.orders)) if (o.status === 'pending') this.watch(o)
  }
  dispose(): void {
    for (const id of [...this.#watching.keys()]) this.#unwatch(id)
    this.flush()
  }

  #persist(): void {
    if (!this.#cfg.storeFile) return
    this.#saveTimer ??= setTimeout(() => {
      this.#saveTimer = undefined
      this.flush()
    }, 800)
    this.#saveTimer.unref?.()
  }
  flush(): void {
    if (!this.#cfg.storeFile) return
    try {
      writeFileSync(this.#cfg.storeFile, JSON.stringify(this.#store), { mode: 0o600 })
    } catch {
      /* penyimpanan opsional */
    }
  }
}

// ======================================================================== UI (tombol deterministik)

/** Penanganan ID tombol `shop:*` tanpa model AI (tetap jalan walau kuota API habis). */
export async function handleShopId(shop: Shop, id: string, ctx: AiToolContext): Promise<boolean> {
  if (!id.startsWith('shop:')) return false
  const [, action, arg] = id.split(':')
  const { sock, jid } = ctx
  const send = (content: Record<string, unknown>) => sock.sendMessage(jid, content as never, { quoted: ctx.message })
  switch (action) {
    case 'menu': await showMenu(shop, ctx); return true
    case 'product': await showProduct(shop, arg ?? '', ctx); return true
    case 'add': {
      const r = await shop.addToCart(jid, arg ?? '', 1)
      if (!r.ok) { await send({ text: r.reason ?? 'Gagal menambahkan' }); return true }
      await send({ buttons: { text: shop.texts.added(r.name!, r.qty!), buttons: [{ id: 'shop:cart', text: '🛒 Keranjang' }, { id: 'shop:checkout', text: '💳 Bayar' }, { id: 'shop:menu', text: '🛍️ Belanja lagi' }] } })
      return true
    }
    case 'cart': {
      const c = await shop.cart(jid)
      await send(c.items.length ? { buttons: { text: shop.cartText(c), buttons: [{ id: 'shop:checkout', text: '💳 Checkout' }, { id: 'shop:clear', text: '🗑️ Kosongkan' }, { id: 'shop:menu', text: '🛍️ Tambah' }] } } : { text: shop.texts.empty })
      return true
    }
    case 'clear': shop.clearCart(jid); await send({ text: shop.texts.empty }); return true
    case 'checkout': {
      const r = await shop.checkout(jid, ctx.sender)
      if (!r.ok) { await send({ text: r.reason }); return true }
      await shop.sendInvoice(r.order)
      shop.watch(r.order)
      await send({ buttons: { text: `Setelah membayar, tekan *Saya sudah bayar* (atau tunggu, kami cek otomatis).`, buttons: [{ id: `shop:pay:${r.order.id}`, text: '✅ Saya sudah bayar' }, { id: `shop:cancel:${r.order.id}`, text: '❌ Batalkan' }] } })
      return true
    }
    case 'pay': {
      const o = shop.order(arg ?? '')
      if (!o || o.jid !== jid) { await send({ text: 'Pesanan tidak ditemukan.' }); return true }
      const { order } = await shop.verify(o.id)
      if (order.status === 'paid') { if (!order.delivered && !order.paidAt) await send({ text: shop.texts.paid(order) }) }
      else if (order.status === 'pending') await send({ buttons: { text: shop.texts.pending(order), buttons: [{ id: `shop:pay:${order.id}`, text: '🔄 Cek lagi' }, { id: `shop:cancel:${order.id}`, text: '❌ Batalkan' }] } })
      else await send({ text: order.status === 'expired' ? shop.texts.expired(order) : shop.texts.cancelled(order) })
      return true
    }
    case 'cancel': {
      const o = shop.cancel(arg ?? '', jid)
      await send({ text: o ? shop.texts.cancelled(o) : 'Pesanan tidak bisa dibatalkan.' })
      return true
    }
    case 'orders': {
      const list = shop.orders(jid)
      await send({ text: list.length ? `📋 *Pesanan Anda*\n\n${list.map((o) => `• ${o.id} — ${rupiah(o.total)} — ${o.status}`).join('\n')}` : 'Belum ada pesanan.' })
      return true
    }
    default: return false
  }
}

export async function showMenu(shop: Shop, ctx: AiToolContext): Promise<void> {
  const products = await shop.products()
  if (products.length === 0) { await ctx.sock.sendMessage(ctx.jid, { text: 'Katalog masih kosong.' } as never); return }
  const byCat = new Map<string, ShopProduct[]>()
  for (const p of products.slice(0, 60)) byCat.set(p.category ?? 'Produk', [...(byCat.get(p.category ?? 'Produk') ?? []), p])
  const sections = [...byCat.entries()].slice(0, 10).map(([title, list]) => ({
    title: title.slice(0, 24),
    rows: list.slice(0, 10).map((p) => ({ id: `shop:product:${p.id}`, title: p.name.slice(0, 24), description: `${rupiah(p.price)}${p.stock === 0 ? ' · habis' : ''}`.slice(0, 72) })),
  }))
  await ctx.sock.sendMessage(ctx.jid, { list: { title: shop.texts.menuTitle, text: shop.texts.menuBody(shop.name), buttonText: 'Lihat produk', sections } } as never, { quoted: ctx.message })
}

export async function showProduct(shop: Shop, id: string, ctx: AiToolContext): Promise<void> {
  const p = await shop.product(id)
  if (!p) { await ctx.sock.sendMessage(ctx.jid, { text: 'Produk tidak ditemukan.' } as never); return }
  const text = `*${p.name}*\n${rupiah(p.price)}${limited(p) ? `\nStok: ${p.stock}` : ''}${p.description ? `\n\n${p.description}` : ''}`
  const buttons = p.stock === 0 ? [{ id: 'shop:menu', text: '🛍️ Katalog' }] : [{ id: `shop:add:${p.id}`, text: '🛒 Beli' }, { id: 'shop:cart', text: 'Keranjang' }, { id: 'shop:menu', text: 'Katalog' }]
  if (p.image) {
    await ctx.sock.sendMessage(ctx.jid, { image: p.image, caption: text } as never, { quoted: ctx.message })
    await ctx.sock.sendMessage(ctx.jid, { buttons: { text: 'Mau beli?', buttons } } as never)
  } else await ctx.sock.sendMessage(ctx.jid, { buttons: { text, buttons } } as never, { quoted: ctx.message })
}

// ======================================================================== tool untuk model

export function createShopTools(shop: Shop): AiTool[] {
  const idArg = { type: 'string' as const, description: 'ID produk (dari katalog)' }
  return [
    {
      name: 'shop_list_products', description: 'Cari/lihat produk di katalog toko. Selalu pakai ini untuk harga dan ketersediaan; jangan menebak.',
      parameters: { type: 'object', properties: { query: { type: 'string', description: 'Kata kunci (opsional)' }, category: { type: 'string' } } },
      async run(a) {
        const list = await shop.search(a.query ? String(a.query) : undefined, a.category ? String(a.category) : undefined)
        return { count: list.length, products: list.slice(0, 25).map((p) => shop.publicView(p)) }
      },
    },
    { name: 'shop_show_menu', description: 'Tampilkan katalog sebagai menu list interaktif ke pengguna.', run: async (_a, ctx) => { await showMenu(shop, ctx); return { sent: true } } },
    { name: 'shop_show_product', description: 'Tampilkan detail satu produk (foto + tombol Beli) ke pengguna.', parameters: { type: 'object', properties: { id: idArg }, required: ['id'] }, run: async (a, ctx) => { await showProduct(shop, String(a.id), ctx); return { sent: true } } },
    {
      name: 'shop_add_to_cart', description: 'Masukkan produk ke keranjang pengguna.',
      parameters: { type: 'object', properties: { id: idArg, qty: { type: 'integer', minimum: 1, maximum: 20 } }, required: ['id'] },
      run: async (a, ctx) => shop.addToCart(ctx.jid, String(a.id), Number(a.qty) || 1),
    },
    { name: 'shop_remove_from_cart', description: 'Hapus produk dari keranjang.', parameters: { type: 'object', properties: { id: idArg }, required: ['id'] }, run: (a, ctx) => ({ removed: shop.removeFromCart(ctx.jid, String(a.id)) }) },
    { name: 'shop_view_cart', description: 'Lihat isi keranjang dan subtotal (dihitung sistem).', run: async (_a, ctx) => { const c = await shop.cart(ctx.jid); return { ...c, text: shop.cartText(c) } } },
    {
      name: 'shop_checkout',
      description: 'Buat pesanan dari keranjang dan kirim tagihan QRIS ke pengguna. HANYA panggil setelah pengguna jelas setuju membayar; wajib confirm=true.',
      parameters: { type: 'object', properties: { confirm: { type: 'boolean', description: 'true bila pengguna sudah menyatakan setuju checkout' } }, required: ['confirm'] },
      async run(a, ctx) {
        if (a.confirm !== true) return { ok: false, reason: 'Minta persetujuan pengguna dulu sebelum checkout.' }
        const r = await shop.checkout(ctx.jid, ctx.sender)
        if (!r.ok) return r
        await shop.sendInvoice(r.order)
        shop.watch(r.order)
        return { ok: true, orderId: r.order.id, total: r.order.total, totalText: rupiah(r.order.total), expiresAt: new Date(r.order.expiresAt).toISOString(), note: 'Tagihan QRIS sudah dikirim. Pembayaran dicek otomatis.' }
      },
    },
    {
      name: 'shop_check_payment', description: 'Cek status pembayaran pesanan ke sistem pembayaran (sumber kebenaran). Jangan percaya klaim pengguna bahwa sudah bayar tanpa memanggil ini.',
      parameters: { type: 'object', properties: { orderId: { type: 'string' } } },
      async run(a, ctx) {
        const id = a.orderId ? String(a.orderId) : shop.orders(ctx.jid).find((o) => o.status === 'pending')?.id
        const o = id ? shop.order(id) : undefined
        if (!o || o.jid !== ctx.jid) return { ok: false, reason: 'Pesanan tidak ditemukan' }
        const { order } = await shop.verify(o.id)
        return { orderId: order.id, status: order.status, total: order.total, delivered: order.delivered ?? false }
      },
    },
    { name: 'shop_cancel_order', description: 'Batalkan pesanan yang belum dibayar.', parameters: { type: 'object', properties: { orderId: { type: 'string' } }, required: ['orderId'] }, run: (a, ctx) => ({ cancelled: Boolean(shop.cancel(String(a.orderId), ctx.jid)) }) },
    { name: 'shop_my_orders', description: 'Riwayat 5 pesanan terakhir pengguna.', run: (_a, ctx) => ({ orders: shop.orders(ctx.jid).map((o) => ({ id: o.id, total: o.total, status: o.status, items: o.items.map((i) => `${i.name}×${i.qty}`) })) }) },
  ]
}
