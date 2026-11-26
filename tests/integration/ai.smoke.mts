import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { makeSocket, createMemoryAuthState, createLogger, createGeminiProvider, createGroqProvider, createFailoverProvider, AiError, AiMemory, assertPublicUrl, fetchPublicBuffer, type AiProvider, type AiRequest, type AiResponse, type AiTool } from '../../src/index.ts'
import type { GoBizHttp } from '../../src/gobiz/gobiz.ts'
const ok = (n: string) => console.log(n, 'ok')
const tmp = mkdtempSync(join(tmpdir(), 'corvus-ai-'))

// ============================================================ 1. provider Gemini / Groq / failover
{
  const calls: any[] = []
  const fakeFetch = (reply: any, status = 200) => (async (url: string, init: any) => { calls.push({ url, init, body: JSON.parse(init.body) }); return new Response(JSON.stringify(reply), { status }) }) as unknown as typeof fetch
  const tools = [{ name: 'send_buttons', description: 'kirim tombol', parameters: { type: 'object' as const, properties: { text: { type: 'string' as const } }, required: ['text'] } }]

  const g = createGeminiProvider({ apiKey: 'GKEY', model: 'gemini-test', fetch: fakeFetch({ candidates: [{ content: { parts: [{ text: 'halo', thought: false }, { functionCall: { name: 'send_buttons', args: { text: 'x' } }, thoughtSignature: 'SIG' }] } }], usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 2 } }) })
  const r = await g.chat({ system: 'SYS', tools, messages: [
    { role: 'user', text: 'hai' },
    { role: 'assistant', text: '', toolCalls: [{ id: 'c1', name: 'send_buttons', args: { text: 'a' } }], raw: [{ functionCall: { name: 'send_buttons', args: { text: 'a' } }, thoughtSignature: 'PREV' }] },
    { role: 'tool', toolCallId: 'c1', name: 'send_buttons', result: { sent: true } },
    { role: 'tool', toolCallId: 'c2', name: 'lain', result: 'teks' },
    { role: 'user', parts: [{ type: 'text', text: 'lihat' }, { type: 'image', mimeType: 'image/jpeg', data: 'QUJD' }] },
  ] })
  const c = calls[0]
  assert.equal(c.url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-test:generateContent')
  assert.equal(c.init.headers['x-goog-api-key'], 'GKEY'); assert.ok(!c.url.includes('GKEY')) // kunci di header, bukan URL
  assert.equal(c.body.systemInstruction.parts[0].text, 'SYS')
  assert.equal(c.body.tools[0].functionDeclarations[0].parameters.type, 'OBJECT'); assert.equal(c.body.tools[0].functionDeclarations[0].parameters.properties.text.type, 'STRING')
  assert.deepEqual(c.body.contents.map((x: any) => x.role), ['user', 'model', 'user', 'user'])
  assert.equal(c.body.contents[1].parts[0].thoughtSignature, 'PREV') // bagian model diputar ulang persis
  assert.equal(c.body.contents[2].parts.length, 2); assert.deepEqual(c.body.contents[2].parts[0].functionResponse.response, { sent: true }); assert.deepEqual(c.body.contents[2].parts[1].functionResponse.response, { result: 'teks' })
  assert.equal(c.body.contents[3].parts[1].inlineData.data, 'QUJD')
  assert.equal(r.text, 'halo'); assert.deepEqual(r.toolCalls.map((t) => [t.name, t.args]), [['send_buttons', { text: 'x' }]]); assert.equal(r.usage?.inputTokens, 5)
  assert.throws(() => createGeminiProvider({ apiKey: '', model: 'm' }), /apiKey/); assert.throws(() => createGeminiProvider({ apiKey: 'k', model: '' }), /model/)

  calls.length = 0
  const q = createGroqProvider({ apiKey: 'QKEY', model: 'llama-test', fetch: fakeFetch({ choices: [{ message: { content: null, tool_calls: [{ id: 't1', type: 'function', function: { name: 'send_buttons', arguments: '{"text":"y"}' } }] } }], usage: { prompt_tokens: 7, completion_tokens: 3 } }) })
  const rq = await q.chat({ system: 'S', tools, messages: [{ role: 'user', text: 'hai' }, { role: 'assistant', text: '', toolCalls: [{ id: 't0', name: 'send_buttons', args: { text: 'a' } }] }, { role: 'tool', toolCallId: 't0', name: 'send_buttons', result: { ok: 1 } }] })
  assert.equal(calls[0].url, 'https://api.groq.com/openai/v1/chat/completions'); assert.equal(calls[0].init.headers.Authorization, 'Bearer QKEY')
  assert.deepEqual(calls[0].body.messages.map((m: any) => m.role), ['system', 'user', 'assistant', 'tool']); assert.equal(calls[0].body.messages[2].tool_calls[0].function.arguments, '{"text":"a"}'); assert.equal(calls[0].body.messages[3].tool_call_id, 't0')
  assert.equal(calls[0].body.tools[0].function.parameters.type, 'object'); assert.equal(calls[0].body.model, 'llama-test')
  assert.deepEqual(rq.toolCalls, [{ id: 't1', name: 'send_buttons', args: { y: undefined, text: 'y' } as any }].map((t) => ({ ...t, args: { text: 'y' } })))

  // error tidak membocorkan kunci; failover pindah provider
  const bad = createGroqProvider({ apiKey: 'SECRETKEY', model: 'm', fetch: fakeFetch({ error: { message: 'kuota habis' } }, 429) })
  await assert.rejects(bad.chat({ system: '', messages: [{ role: 'user', text: 'x' }], tools: [] }), (e: any) => e instanceof AiError && e.status === 429 && e.retryable && !e.message.includes('SECRETKEY') && e.message.includes('kuota habis'))
  const good: AiProvider = { name: 'good', chat: async () => ({ text: 'dari-cadangan', toolCalls: [] }) }
  const fell: string[] = []
  const fo = createFailoverProvider([bad, good], (from) => fell.push(from))
  assert.equal((await fo.chat({ system: '', messages: [{ role: 'user', text: 'x' }], tools: [] })).text, 'dari-cadangan'); assert.deepEqual(fell, ['groq'])
  const bad400 = createGroqProvider({ apiKey: 'k', model: 'm', fetch: fakeFetch({ error: { message: 'salah format' } }, 400) })
  await assert.rejects(createFailoverProvider([bad400, good]).chat({ system: '', messages: [{ role: 'user', text: 'x' }], tools: [] }), /salah format/) // 400: provider lain pasti sama
  ok('1. provider Gemini/Groq: format request, respons, kunci aman, failover')
}

// ============================================================ 2. SSRF + memori
{
  for (const bad of ['http://localhost/x', 'http://127.0.0.1/x', 'http://10.0.0.5/x', 'http://169.254.169.254/latest', 'http://192.168.1.1', 'file:///etc/passwd', 'ftp://8.8.8.8/x', 'http://[::1]/x', 'http://service.internal/x']) await assert.rejects(assertPublicUrl(bad), undefined, bad)
  assert.equal((await assertPublicUrl('https://8.8.8.8/a.png')).hostname, '8.8.8.8')
  const redirectToPrivate = (async () => new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/secret' } })) as unknown as typeof fetch
  await assert.rejects(fetchPublicBuffer('https://8.8.8.8/x', { fetch: redirectToPrivate }), /internal/)
  const big = (async () => new Response(Buffer.alloc(2000), { status: 200, headers: { 'content-type': 'image/png' } })) as unknown as typeof fetch
  await assert.rejects(fetchPublicBuffer('https://8.8.8.8/x', { fetch: big, maxBytes: 1000 }), /besar/)
  assert.equal((await fetchPublicBuffer('https://8.8.8.8/x', { fetch: big })).mimeType, 'image/png')

  let t = 0
  const file = join(tmp, 'mem.json')
  const mem = new AiMemory({ maxMessages: 3, ttlMs: 1000, file, now: () => t })
  for (const i of [1, 2, 3, 4]) mem.push('a@s.whatsapp.net', 'user', 'pesan' + i)
  assert.deepEqual(mem.history('a@s.whatsapp.net').map((m) => m.text), ['pesan2', 'pesan3', 'pesan4']) // dibatasi 3
  mem.setPersona('a@s.whatsapp.net', 'Kamu kasir'); mem.setDisabled('b@g.us', true); mem.flush()
  const again = new AiMemory({ file }); assert.equal(again.persona('a@s.whatsapp.net'), 'Kamu kasir'); assert.equal(again.isDisabled('b@g.us'), true)
  t = 5000; assert.deepEqual(mem.history('a@s.whatsapp.net'), []); assert.equal(mem.persona('a@s.whatsapp.net'), 'Kamu kasir') // percakapan lupa, persona tetap
  ok('2. SSRF diblokir (host internal, redirect, ukuran); memori + persona tersimpan')
}

// ============================================================ helper agen
class Scripted implements AiProvider {
  name = 'scripted'
  requests: AiRequest[] = []
  constructor(public script: Array<(req: AiRequest) => AiResponse | Promise<AiResponse>>) {}
  async chat(req: AiRequest): Promise<AiResponse> {
    this.requests.push(structuredClone({ ...req, signal: undefined }))
    const step = this.script.shift()
    if (!step) throw new Error('skrip habis')
    return step(req)
  }
}
const text = (t: string) => () => ({ text: t, toolCalls: [] })
const call = (name: string, args: Record<string, unknown> = {}) => () => ({ text: '', toolCalls: [{ id: 'c_' + name, name, args }] })
const BOT = '6280000:1@s.whatsapp.net', BOT_LID = '9999:1@lid', OWNER = '628111@s.whatsapp.net', USER = '628222@s.whatsapp.net'

function bench(aiConfig: any = {}) {
  const sock: any = makeSocket({ auth: createMemoryAuthState(), logger: createLogger({ level: 'silent' }), reconnect: false })
  const sent: Array<{ jid: string; content: any; options: any }> = []
  sock.sendMessage = async (jid: string, content: any, options: any) => { sent.push({ jid, content, options }); return { key: { id: 'S' + sent.length, remoteJid: jid, fromMe: true } } }
  sock.sendPresenceUpdate = async () => undefined
  sock.auth.creds.me = { id: BOT, lid: BOT_LID, name: 'Bot' }
  const provider = new Scripted(aiConfig.script ?? [])
  const agent = sock.enableAi({ providers: [provider], name: 'Corvi', ownerJids: [OWNER], autoReply: false, rateLimit: { messages: 50, windowMs: 60_000 }, ...aiConfig.config })
  const msg = (jid: string, body: any, extra: any = {}) => ({ key: { id: 'M' + Math.random(), remoteJid: jid, fromMe: false, ...(jid.endsWith('@g.us') && { participant: extra.from ?? USER }) }, message: body, pushName: 'Budi', participant: jid.endsWith('@g.us') ? extra.from ?? USER : undefined })
  return { sock, agent, provider, sent, msg }
}

// ============================================================ 3. alur percakapan, tool WhatsApp, pemicu
{
  const b = bench({ script: [text('Halo Budi!'), call('send_buttons', { text: 'Pilih', buttons: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] }), text('Sudah kukirim tombolnya')] })
  assert.equal(await b.agent.handle(b.msg(USER, { conversation: 'hai' }) as any), true)
  assert.equal(b.sent.at(-1)!.content.text, 'Halo Budi!'); assert.equal(b.sent.at(-1)!.options.quoted, undefined) // chat pribadi tanpa kutipan
  assert.ok(b.provider.requests[0]!.system.includes('Corvi') && b.provider.requests[0]!.system.includes('Budi'))
  assert.ok(b.provider.requests[0]!.tools.some((t) => t.name === 'send_buttons') && b.provider.requests[0]!.tools.some((t) => t.name === 'send_carousel'))
  await b.agent.handle(b.msg(USER, { conversation: 'kasih pilihan' }) as any)
  const btn = b.sent.find((s) => s.content.buttons)!; assert.deepEqual(btn.content.buttons.buttons.map((x: any) => x.id), ['a', 'b'])
  const second = b.provider.requests[2]!; assert.deepEqual(second.messages.map((m) => m.role), ['user', 'assistant', 'user', 'assistant', 'tool']) // riwayat + tool call + hasil
  assert.deepEqual(second.messages.at(-1)!.result, { sent: 'buttons', count: 2 })
  assert.equal(b.sent.at(-1)!.content.text, 'Sudah kukirim tombolnya')
  ok('3a. jawaban otomatis, memori, tool kirim tombol dengan hasil kembali ke model')

  // grup: hanya bila di-tag / membalas bot / menyebut nama; perintah berawalan titik diabaikan
  const g = bench({ script: [text('siap'), text('ok-reply'), text('ok-nama')] })
  const G = '120363@g.us'
  assert.equal(await g.agent.handle(g.msg(G, { conversation: 'ngobrol biasa' }) as any), false)
  assert.equal(await g.agent.handle(g.msg(G, { extendedTextMessage: { text: '@bot halo', contextInfo: { mentionedJid: [BOT_LID] } } }) as any), true)
  assert.ok(g.sent.at(-1)!.options.quoted) // grup: balasan mengutip pesan
  assert.equal(await g.agent.handle(g.msg(G, { extendedTextMessage: { text: 'iya', contextInfo: { quotedMessage: { conversation: 'x' }, participant: BOT } } }) as any), true)
  assert.equal(await g.agent.handle(g.msg(G, { conversation: 'corvi tolong dong' }) as any), true)
  assert.equal(await g.agent.handle(g.msg(USER, { conversation: '.ping' }) as any), false); assert.equal(g.sent.length, 3)
  assert.equal(await g.agent.handle({ ...g.msg(USER, { conversation: 'hai' }), key: { id: 'x', remoteJid: USER, fromMe: true } } as any), false) // pesan sendiri
  assert.equal(await g.agent.handle(g.msg('status@broadcast', { conversation: 'hai' }) as any), false)
  ok('3b. pemicu grup (tag / balas / nama), abaikan perintah & pesan sendiri')

  // kontrol: reset, on/off, persona (hanya pemilik)
  const c = bench({ script: [text('jawab-1'), text('jawab-2')] })
  await c.agent.handle(c.msg(USER, { conversation: '!ai off' }) as any); assert.ok(c.sent.at(-1)!.content.text.includes('hanya untuk pemilik')); assert.equal(c.agent.isEnabled(USER), true)
  await c.agent.handle(c.msg(OWNER, { conversation: '!ai persona Kamu kasir toko roti' }) as any)
  await c.agent.handle(c.msg(OWNER, { conversation: 'halo' }) as any); assert.ok(c.provider.requests[0]!.system.includes('Kamu kasir toko roti')); assert.ok(c.provider.requests[0]!.system.includes('pemilik bot'))
  await c.agent.handle(c.msg(OWNER, { conversation: '!ai off' }) as any); assert.equal(await c.agent.handle(c.msg(OWNER, { conversation: 'masih ada?' }) as any), false)
  await c.agent.handle(c.msg(OWNER, { conversation: '!ai on' }) as any); await c.agent.handle(c.msg(OWNER, { conversation: '!ai reset' }) as any); assert.deepEqual(c.agent.memory.history(OWNER), [])
  ok('3c. perintah !ai: reset (siapa saja), on/off/persona (pemilik)')

  // keamanan tool: ownerOnly, tool tak dikenal, tool buatan sendiri, SSRF lewat send_image
  const custom: AiTool = { name: 'admin_only', description: 'rahasia', ownerOnly: true, run: () => ({ secret: 1 }) }
  const echo: AiTool = { name: 'cek_stok', description: 'stok', parameters: { type: 'object', properties: { sku: { type: 'string' } }, required: ['sku'] }, run: (a) => ({ sku: a.sku, stok: 7 }) }
  const s = bench({ config: { tools: [custom, echo] }, script: [call('admin_only'), call('tidak_ada'), call('cek_stok', { sku: 'A1' }), call('send_image', { url: 'http://127.0.0.1:8080/x.png' }), text('selesai')] })
  const sec = s.provider.script
  // satu pesan = satu rangkaian; jalankan lima langkah berurutan dalam satu pertanyaan
  const reply = await s.agent.ask({ jid: USER, text: 'uji', sender: USER })
  assert.equal(reply, 'selesai')
  const results = s.provider.requests.at(-1)!.messages.filter((m) => m.role === 'tool').map((m) => m.result as any)
  assert.match(results[0].error, /pemilik/); assert.match(results[1].error, /tidak dikenal/); assert.deepEqual(results[2], { sku: 'A1', stok: 7 }); assert.match(results[3].error, /internal/)
  assert.ok(!s.provider.requests[0]!.tools.some((t) => t.name === 'admin_only')) // tool ownerOnly tidak ditawarkan ke non-pemilik
  void sec
  ok('3d. keamanan tool: ownerOnly, tak dikenal, tool kustom, SSRF diblokir')

  // rate limit, allow/block, provider gagal → fallback + onError, vision
  const r = bench({ config: { rateLimit: { messages: 2, windowMs: 60_000 } }, script: [text('1'), text('2')] })
  await r.agent.handle(r.msg(USER, { conversation: 'a' }) as any); await r.agent.handle(r.msg(USER, { conversation: 'b' }) as any); await r.agent.handle(r.msg(USER, { conversation: 'c' }) as any); await r.agent.handle(r.msg(USER, { conversation: 'd' }) as any)
  assert.equal(r.sent.filter((x) => x.content.text?.includes('Pelan-pelan')).length, 1) // peringatan sekali
  const bl = bench({ config: { block: ['628222'] }, script: [text('x')] }); assert.equal(await bl.agent.handle(bl.msg(USER, { conversation: 'hai' }) as any), false)
  const al = bench({ config: { allow: [OWNER] }, script: [text('x')] }); assert.equal(await al.agent.handle(al.msg(USER, { conversation: 'hai' }) as any), false)
  const errs: any[] = []
  const f = bench({ config: { onError: (e: any) => errs.push(e), fallbackReply: 'FALLBACK' }, script: [() => { throw new AiError('gemini: HTTP 500', { provider: 'gemini', status: 500 }) }] })
  await f.agent.handle(f.msg(USER, { conversation: 'hai' }) as any); assert.equal(f.sent.at(-1)!.content.text, 'FALLBACK'); assert.equal(errs.length, 1)
  const v = bench({ config: { vision: true }, script: [text('itu kucing')] }); v.sock.media.downloadToBuffer = async () => Buffer.from('JPEGDATA')
  await v.agent.handle(v.msg(USER, { imageMessage: { caption: 'ini apa?', mimetype: 'image/jpeg' } }) as any)
  const parts = v.provider.requests[0]!.messages.at(-1)!.parts!; assert.deepEqual(parts.map((p) => p.type), ['text', 'image']); assert.equal((parts[1] as any).data, Buffer.from('JPEGDATA').toString('base64'))
  ok('3e. rate limit, allow/block, fallback saat provider gagal, gambar masuk (vision)')

  // pemasangan otomatis lewat event + dispose
  const auto = bench({ config: { autoReply: true }, script: [text('otomatis!')] })
  await new Promise<void>((resolve) => { const orig = auto.sock.sendMessage; auto.sock.sendMessage = async (...a: any[]) => { const r = await orig(...a); if (a[1].text === 'otomatis!') resolve(); return r } ; auto.sock.socket.ev.emit('messages.upsert', { type: 'notify', messages: [auto.msg(USER, { conversation: 'halo' })] }) })
  assert.equal(auto.sent.at(-1)!.content.text, 'otomatis!'); auto.sock.dispose()
  ok('3f. pemasangan otomatis lewat messages.upsert')
}


// ============================================================ 4. toko: katalog, keranjang, pesanan, pembayaran, pengiriman
const STATIC_QRIS = '00020101021126260012ID.DANA.WWW0118936009153012345675204581253033605802ID5909TOKO TEST6007JAKARTA6105123406304ABCD'
function shopBench(cfg: { script?: any[]; payment?: any; shop?: any; agent?: any } = {}) {
  const gobizState = { id: Math.random().toString(36).slice(2), txs: [] as any[], fetchCalls: [] as Array<{ url: string; auth: string }> }
  const http: GoBizHttp = {
    post: async () => ({ errors: [{ message: 'login tidak dipakai' }] }),
    fetch: async (url, init) => {
      gobizState.fetchCalls.push({ url, auth: init.headers.Authorization! })
      const valid = init.headers.Authorization === 'Bearer CACHED'
      if (!valid) return { status: 401, ok: false, json: async () => ({}) }
      if (url.includes('/v1/merchants/search')) return { status: 200, ok: true, json: async () => ({ hits: { hits: [{ _source: { id: 'M-1', merchant_name: 'Toko Uji' } }] } }) }
      if (url.includes('merchant-analytics')) return { status: 200, ok: true, json: async () => ({ transactions: gobizState.txs }) }
      throw new Error('url tak dikenal ' + url)
    },
  }
  const cacheFile = join(tmp, 'gopay_cache_' + Math.random().toString(36).slice(2) + '.json')
  writeFileSync(cacheFile, JSON.stringify({ gopay_token: 'CACHED', gopay_merchant_id: 'M-1' }))
  const delivered: string[] = []
  const products = [
    { id: 'kopi', name: 'Kopi Arabika', price: 25000, category: 'Minuman', stock: 5, description: 'Biji pilihan', deliver: 'Kode voucher: ABC-123' },
    { id: 'ebook', name: 'Ebook Resep', price: 10000, category: 'Digital', image: 'https://example.com/e.jpg', deliver: (o: any, i: any) => `Unduh: https://dl.example/${o.id}/${i.qty}` },
  ]
  const paid: any[] = []
  const b = bench({ script: cfg.script ?? [], config: { shop: { name: 'Toko Uji', products, ownerJids: [OWNER], payment: { qris: STATIC_QRIS, cacheFile, gobiz: { http }, merchantName: 'Toko Uji', ...cfg.payment }, onPaid: (o: any) => { paid.push(o) }, ...cfg.shop }, ...cfg.agent } })
  const invoices: any[] = []
  b.sock.sendCreatePaymentGobiz = async (jid: string, opts: any) => { invoices.push({ jid, ...opts }); return { message: {}, ...opts } }
  const ctx = (jid = USER) => ({ sock: b.sock, jid, sender: jid, isGroup: false, isOwner: false, agent: b.agent })
  return { ...b, gobizState, cacheFile, invoices, paid, products, ctx, delivered }
}
async function toolRef(b: any, name: string) {
  const { createShopTools } = await import('../../src/ai/shop.ts')
  return createShopTools(b.agent.shop).find((t: any) => t.name === name)!
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const pay = (s: any, amount: number, ageMs = 0) => s.gobizState.txs.push({ transaction_id: `TX-${s.gobizState.id}-${s.gobizState.txs.length}`, gross_amount: amount * 100, transaction_time: new Date(Date.now() - ageMs).toISOString() })

{
  const s = shopBench({ shop: { autoVerify: false } })
  const shop = s.agent.shop!
  // katalog: model tidak pernah melihat isi `deliver`, dan tidak bisa menentukan harga
  const list: any = await (await toolRef(s, 'shop_list_products')).run({ query: 'kopi' }, s.ctx())
  assert.deepEqual(list.products.map((p: any) => [p.id, p.price, p.priceText]), [['kopi', 25000, 'Rp 25.000']]); assert.ok(!JSON.stringify(list).includes('ABC-123'))
  const addT = await toolRef(s, 'shop_add_to_cart')
  assert.ok(!('price' in (addT.parameters!.properties as any))) // skema tool tidak punya parameter harga
  assert.equal((await addT.run({ id: 'kopi', qty: 2 }, s.ctx()) as any).qty, 2)
  assert.equal((await addT.run({ id: 'kopi', qty: 99 }, s.ctx()) as any).ok, false) // melebihi stok (5)
  assert.equal((await addT.run({ id: 'tidak-ada' }, s.ctx()) as any).ok, false)
  const cart: any = await (await toolRef(s, 'shop_view_cart')).run({}, s.ctx()); assert.equal(cart.subtotal, 50000)
  // checkout butuh konfirmasi eksplisit
  const checkout = await toolRef(s, 'shop_checkout')
  assert.equal((await checkout.run({ confirm: false }, s.ctx()) as any).ok, false); assert.equal(s.invoices.length, 0)
  const co: any = await checkout.run({ confirm: true }, s.ctx())
  assert.equal(co.ok, true); assert.ok(co.total > 50000 && co.total <= 50099) // kode unik 1..99
  assert.equal(s.invoices[0].amount, co.total); assert.equal(s.invoices[0].orderId, co.orderId); assert.ok(s.invoices[0].caption.includes('Kopi Arabika ×2'))
  assert.equal((await shop.cart(USER)).items.length, 0) // keranjang dikosongkan
  // pembeli lain dengan isi sama → nominal berbeda
  await shop.addToCart('628999@s.whatsapp.net', 'kopi', 2); const r2 = await shop.checkout('628999@s.whatsapp.net', '628999'); assert.ok(r2.ok && r2.order.total !== co.total)
  // belum bayar → pending; bayar nominal LAIN / lebih lama dari pesanan → tidak dianggap lunas
  assert.equal((await shop.verify(co.orderId)).order.status, 'pending')
  pay(s, 50000); pay(s, co.total, 10 * 60_000)
  assert.equal((await shop.verify(co.orderId)).order.status, 'pending')
  // bayar tepat → lunas, produk terkirim, stok berkurang, pemilik diberi tahu, onPaid dipanggil
  const before = s.sent.length; pay(s, co.total)
  const v = await shop.verify(co.orderId); assert.equal(v.order.status, 'paid'); assert.equal(v.changed, true)
  const toBuyer = s.sent.filter((x) => x.jid === USER && x.content.text?.includes('Kode voucher: ABC-123')); assert.equal(toBuyer.length, 1)
  assert.ok(s.sent.some((x) => x.jid === OWNER && x.content.text.includes('Pembayaran masuk') && x.content.text.includes(co.orderId)))
  assert.equal((await shop.product('kopi'))!.stock, 3); assert.equal(s.paid.length, 1)
  const after = s.sent.length; await shop.verify(co.orderId); await shop.verify(co.orderId); assert.equal(s.sent.length, after) // idempotent: tidak kirim ulang
  assert.ok(before < after)
  // transaksi yang sama tidak bisa melunasi pesanan kedua walau nominal sama
  await shop.addToCart('628777@s.whatsapp.net', 'kopi', 2); const dup = (await shop.checkout('628777@s.whatsapp.net', 'x')) as any
  assert.ok(dup.ok); dup.order.total = co.total // paksa nominal sama dengan pesanan yang sudah lunas
  assert.equal((await shop.verify(dup.order.id)).order.status, 'pending')
  ok('4a. toko: katalog aman, harga dari sistem, checkout butuh konfirmasi, kode unik, verifikasi nyata, kirim sekali, stok')
}
{
  // cache gopay_cache.json dipakai (token + merchant), dan sendStatusPaymentGobiz hanya dengan cacheFile
  const s = shopBench({ shop: { autoVerify: false } })
  await s.agent.shop!.addToCart(USER, 'ebook', 1); const r: any = await s.agent.shop!.checkout(USER, 'u'); pay(s, r.order.total)
  assert.equal((await s.agent.shop!.verify(r.order.id)).order.status, 'paid')
  const used = s.gobizState.fetchCalls.filter((c) => c.url.includes('merchant-analytics')); assert.ok(used.length > 0 && used.every((c) => c.auth === 'Bearer CACHED' && c.url.includes('merchant_ids=M-1')))
  assert.ok(s.sent.some((x) => x.content.text?.includes('Unduh: https://dl.example/' + r.order.id + '/1'))) // deliver berupa fungsi
  const fresh: any = makeSocket({ auth: createMemoryAuthState(), logger: createLogger({ level: 'silent' }), reconnect: false }); const out: any[] = []
  fresh.messages.send = async (_j: string, input: any) => { out.push(input); return { message: { key: { id: 'k' } } } }
  const cacheHttp: GoBizHttp = { post: async () => ({}), fetch: async (url, init) => init.headers.Authorization !== 'Bearer CACHED' ? { status: 401, ok: false, json: async () => ({}) } : { status: 200, ok: true, json: async () => (url.includes('merchants/search') ? { hits: { hits: [{ _source: { id: 'M-1' } }] } } : { transactions: s.gobizState.txs }) } }
  const st = await fresh.sendStatusPaymentGobiz(USER, { cacheFile: s.cacheFile, amount: r.order.total, since: Date.now() - 60_000, gobiz: { http: cacheHttp } })
  assert.equal(st.status, 'paid'); assert.ok(out.at(-1).text.includes('PEMBAYARAN DITERIMA'))
  const noAuth = await fresh.sendStatusPaymentGobiz(USER, { amount: 1000, notifyOnError: false }); assert.equal(noAuth.status, 'error'); assert.match(noAuth.error, /cacheFile/)
  ok('4b. auth GoBiz diambil dari gopay_cache.json (gopay_token / gopay_merchant_id)')
}
{
  // nominal sama ditolak, kedaluwarsa, batal
  const s = shopBench({ payment: { uniqueCode: false, expiresInMs: 30 }, shop: { autoVerify: false } })
  const shop = s.agent.shop!
  await shop.addToCart(USER, 'ebook', 1); const a: any = await shop.checkout(USER, 'u'); assert.equal(a.order.total, 10000)
  await shop.addToCart('628999@s.whatsapp.net', 'ebook', 1); const dupe: any = await shop.checkout('628999@s.whatsapp.net', 'v'); assert.equal(dupe.ok, false) // nominal sama dengan pesanan tertunda
  await sleep(50); assert.equal((await shop.verify(a.order.id)).order.status, 'expired')
  await shop.addToCart(USER, 'ebook', 1); const c: any = await shop.checkout(USER, 'u'); assert.equal(shop.cancel(c.order.id, '628000@s.whatsapp.net'), undefined); assert.equal(shop.cancel(c.order.id, USER)!.status, 'cancelled') // hanya pemilik pesanan
  ok('4c. nominal kembar ditolak, kedaluwarsa, batal hanya oleh pemilik pesanan')
}
{
  // tombol toko tanpa model AI
  const s = shopBench({ shop: { autoVerify: false } })
  const press = async (id: string, jid = USER) => s.agent.handle(s.msg(jid, { buttonsResponseMessage: { selectedButtonId: id, selectedDisplayText: id } }) as any)
  assert.equal(await press('shop:menu'), true); const menu = s.sent.at(-1)!.content.list; assert.ok(menu.sections.flatMap((x: any) => x.rows).some((r: any) => r.id === 'shop:product:kopi'))
  await press('shop:product:ebook'); assert.ok(s.sent.some((x) => x.content.image === 'https://example.com/e.jpg')); assert.ok(s.sent.at(-1)!.content.buttons.buttons.some((b: any) => b.id === 'shop:add:ebook'))
  await press('shop:add:kopi'); await press('shop:add:kopi'); await press('shop:cart'); assert.ok(s.sent.at(-1)!.content.buttons.text.includes('Subtotal: Rp 50.000'))
  await press('shop:checkout'); assert.equal(s.invoices.length, 1); const orderId = s.invoices[0].orderId
  assert.ok(s.sent.at(-1)!.content.buttons.buttons.some((b: any) => b.id === `shop:pay:${orderId}`))
  await press(`shop:pay:${orderId}`); assert.ok(s.sent.at(-1)!.content.buttons.text.includes('belum terdeteksi'))
  pay(s, s.invoices[0].amount); await press(`shop:pay:${orderId}`); assert.ok(s.sent.some((x) => x.content.text?.includes('Kode voucher: ABC-123')))
  await press('shop:orders'); assert.ok(s.sent.at(-1)!.content.text.includes(orderId) && s.sent.at(-1)!.content.text.includes('paid'))
  await press('shop:clear'); assert.equal(await press('shop:tidak-dikenal'), false)
  assert.equal(s.provider.requests.length, 0) // semua alur tombol berjalan tanpa model AI
  ok('4d. tombol toko (menu, produk, keranjang, checkout, bayar, riwayat) tanpa memanggil AI')
}
{
  // pemantauan otomatis + pesanan bertahan setelah restart
  const storeFile = join(tmp, 'shop-store.json')
  const s = shopBench({ shop: { verifyIntervalMs: 15, storeFile } })
  await s.agent.shop!.addToCart(USER, 'kopi', 1); const r: any = await s.agent.shop!.checkout(USER, 'u'); await s.agent.shop!.sendInvoice(r.order); s.agent.shop!.watch(r.order)
  await sleep(60); assert.equal(s.agent.shop!.order(r.order.id)!.status, 'pending')
  pay(s, r.order.total); for (let i = 0; i < 40 && s.agent.shop!.order(r.order.id)!.status === 'pending'; i++) await sleep(20)
  assert.equal(s.agent.shop!.order(r.order.id)!.status, 'paid'); assert.ok(s.sent.some((x) => x.jid === USER && x.content.text?.includes('Kode voucher'))) // lunas otomatis tanpa pengguna menekan apa pun
  s.agent.dispose()
  // restart: pesanan tertunda dibaca dari berkas dan dilanjutkan
  const s2 = shopBench({ shop: { verifyIntervalMs: 15, storeFile } })
  await s2.agent.shop!.addToCart(USER, 'ebook', 1); const r2: any = await s2.agent.shop!.checkout(USER, 'u'); s2.agent.shop!.flush(); s2.agent.dispose()
  const s3 = shopBench({ shop: { verifyIntervalMs: 15, storeFile }, payment: { cacheFile: s2.cacheFile } })
  assert.equal(s3.agent.shop!.order(r2.order.id)!.status, 'pending'); assert.equal(s3.agent.shop!.order(r.order.id)!.status, 'paid')
  s3.agent.shop!.resume(); pay(s3, r2.order.total); for (let i = 0; i < 40 && s3.agent.shop!.order(r2.order.id)!.status === 'pending'; i++) await sleep(20)
  assert.equal(s3.agent.shop!.order(r2.order.id)!.status, 'paid'); s3.agent.dispose()
  ok('4e. pelunasan otomatis di latar belakang + pesanan tertunda dilanjutkan setelah restart')
}
{
  // dialog jual-beli lengkap lewat model (skrip) — model hanya memanggil tool, angka dari sistem
  const s = shopBench({ shop: { autoVerify: false }, script: [
    call('shop_list_products', { query: 'kopi' }), text('Ada Kopi Arabika Rp 25.000.'),
    call('shop_add_to_cart', { id: 'kopi', qty: 2 }), text('Sudah masuk keranjang. Lanjut bayar?'),
    call('shop_checkout', { confirm: true }), text('Tagihan sudah kukirim ya.'),
    call('shop_check_payment'), text('Pembayaran diterima, produk sudah dikirim!'),
  ] })
  const say = (t: string) => s.agent.handle(s.msg(USER, { conversation: t }) as any)
  await say('ada kopi?'); await say('beli 2'); await say('ya bayar'); assert.equal(s.invoices.length, 1)
  pay(s, s.invoices[0].amount); await say('sudah bayar')
  const toolResult = s.provider.requests.at(-1)!.messages.filter((m) => m.role === 'tool').at(-1)!.result as any
  assert.equal(toolResult.status, 'paid'); assert.ok(s.sent.some((x) => x.content.text?.includes('Kode voucher: ABC-123')))
  assert.ok(s.provider.requests[0]!.system.includes('shop_checkout') || s.provider.requests[0]!.system.includes('shop_*'))
  ok('4f. dialog jual-beli lengkap lewat AI: cari → keranjang → checkout → cek bayar → kirim produk')
}
console.log('ALL OK')
