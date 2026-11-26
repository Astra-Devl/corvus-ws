import assert from 'node:assert/strict'
import { makeSocket, createMemoryAuthState, createLogger } from '../../src/index.ts'
import { generateMessageContent } from '../../src/messages/generate-message.ts'
import { createProtoMessageCodec } from '../../src/protocol/proto-message.ts'
import { toNativeFlowButton, buildPaymentParams } from '../../src/messages/button-utils.ts'
import { parseChannelCode } from '../../src/channels/channel-url.ts'
import { GoBizClient, buildDynamicQris, crc16ccitt, normalizePhone, type GoBizHttp } from '../../src/gobiz/gobiz.ts'
import { createGobizApi } from '../../src/gobiz/gobiz-api.ts'
const ok = (n: string) => console.log(n, 'ok')
const codec = createProtoMessageCodec()
const roundTrip = (c: any) => codec.decode(codec.encode(c)) as any

// ---------------------------------------------------------------- GoBiz: QRIS
{
  assert.equal(crc16ccitt('123456789'), '29B1') // vektor uji CRC-16/CCITT-FALSE
  const staticQris = '00020101021126260012ID.DANA.WWW0118936009153012345675204581253033605802ID5909TOKO TEST6007JAKARTA6105123406304ABCD'
  const dyn = buildDynamicQris(staticQris, 25000)
  assert.ok(dyn.includes('010212') && !dyn.includes('010211'))
  assert.ok(dyn.includes('540525000' + '5802ID'))
  assert.equal(dyn.slice(-4), crc16ccitt(dyn.slice(0, -4)))
  assert.throws(() => buildDynamicQris(staticQris, 0), /bulat/); assert.throws(() => buildDynamicQris('bukan qris', 1000), /QRIS/)
  assert.equal(normalizePhone('+62 812-3456-7890'), '81234567890'); assert.equal(normalizePhone('081234567890'), '81234567890')
  ok('1. GoBiz: CRC16 + QRIS dinamis + nomor')
}

// ---------------------------------------------------------------- GoBiz: klien dengan HTTP palsu
const now = Date.parse('2026-11-22T10:00:00Z')
const makeHttp = (state: { calls: string[]; tokenOk?: boolean; analytics?: any; journal?: any }): GoBizHttp => ({
  post: async (url, _h, body) => {
    state.calls.push('POST ' + url.split('.id')[1]); const b: any = body
    if (url.endsWith('/goid/login/request')) return b.login_type === 'otp' ? { data: { otp_token: 'OTPTOK' } } : {}
    if (url.endsWith('/goid/token')) {
      if (b.grant_type === 'password') return b.data.password === 'rahasia' ? { access_token: 'TOK-PW', refresh_token: 'R', expires_in: 3600 } : { errors: [{ message: 'Salah' }] }
      return b.data.otp === '123456' && b.data.otp_token === 'OTPTOK' ? { access_token: 'TOK-OTP' } : { errors: [{ message: 'OTP salah' }] }
    }
    throw new Error('url tak dikenal ' + url)
  },
  fetch: async (url, init) => {
    state.calls.push(init.method + ' ' + new URL(url).pathname)
    const json = async (d: any) => d
    if (url.includes('/v1/merchants/search')) {
      const auth = init.headers.Authorization
      if (state.tokenOk === false && auth === 'Bearer OLD') return { status: 401, ok: false, json: () => json({}) }
      return { status: 200, ok: true, json: () => json({ hits: { hits: [{ _source: { id: 'M-1', merchant_name: 'Toko Uji' } }] } }) }
    }
    if (url.includes('merchant-analytics')) return { status: 200, ok: true, json: () => json(state.analytics ?? { transactions: [] }) }
    if (url.includes('/journals/search')) return { status: 200, ok: true, json: () => json(state.journal ?? { data: [] }) }
    throw new Error('fetch tak dikenal ' + url)
  },
})
{
  const st = { calls: [] as string[], analytics: { transactions: [
    { transaction_id: 'T1', gross_amount: 2500000, transaction_time: '2026-11-22T09:59:00Z' },
    { transaction_id: 'T0', gross_amount: 2500000, transaction_time: '2026-11-21T20:00:00Z' }] } }
  const client = new GoBizClient({ http: makeHttp(st), now: () => now })
  const auth = { email: 'a@b.co', password: 'rahasia' }
  const s1 = await client.ensureSession(auth)
  assert.deepEqual([s1.token, s1.merchantId, s1.merchantName], ['TOK-PW', 'M-1', 'Toko Uji'])
  const before = st.calls.length; await client.ensureSession(auth)
  assert.ok(!st.calls.slice(before).some((c) => c.includes('/goid/'))) // token tersimpan dipakai ulang, tanpa login lagi
  const found = await client.findPayment(auth, { amount: 25000, since: now - 5 * 60_000 })
  assert.equal(found?.id, 'T1'); assert.equal(found?.amount, 25000)
  assert.equal(await client.findPayment(auth, { amount: 25000, since: now }), undefined) // sebelum `since` diabaikan
  await assert.rejects(client.loginWithPassword('a@b.co', 'salah'), /Login gagal/)
  // cadangan: journals bila analytics tidak punya `transactions`
  const st2 = { calls: [] as string[], analytics: {}, journal: { data: [{ metadata: { transaction: { transaction_id: 'J1', gross_amount: 1000000, transaction_time: '2026-11-22T09:58:00Z' } } }] } }
  const c2 = new GoBizClient({ http: makeHttp(st2), now: () => now })
  const j = await c2.getTransactions({ email: 'j@b.co', password: 'rahasia' })
  assert.deepEqual(j.map((p) => [p.id, p.amount]), [['J1', 10000]])
  // OTP: minta → verifikasi
  const otp = await client.requestOtp('081234567890'); assert.deepEqual([otp.phone, otp.otpToken], ['81234567890', 'OTPTOK'])
  assert.equal((await client.verifyOtp({ phone: otp.phone, otp: '123456', otpToken: otp.otpToken })).accessToken, 'TOK-OTP')
  await assert.rejects(client.verifyOtp({ phone: otp.phone, otp: '000000', otpToken: 'OTPTOK' }), /OTP/)
  await assert.rejects(new GoBizClient({ http: makeHttp({ calls: [] }) }).ensureSession({ phone: '0811111111' }), /Belum login/)
  ok('2. GoBiz: login password/OTP, merchant, riwayat (analytics + journals), filter since')
}

// ---------------------------------------------------------------- GoBiz: fungsi sock.*Gobiz
{
  const sent: any[] = []
  const api = createGobizApi((async (jid: string, content: any, options?: any) => { sent.push({ jid, content, options }); return { key: { id: 'K' } } }) as any)
  const staticQris = '00020101021126260012ID.DANA.WWW0118936009153012345675204581253033605802ID5909TOKO TEST6007JAKARTA6105123406304ABCD'

  // buat pembayaran: tanpa paket `qrcode` → fallback teks; gambar sendiri → foto + caption; image:false → teks
  const r1 = await api.sendCreatePaymentGobiz('628@s.whatsapp.net', { qris: staticQris, amount: 25000, orderId: 'INV-1', send: { ephemeralExpiration: 86400 }, extra: { mentionAll: true } })
  assert.equal(r1.imageSent, false); assert.ok(r1.reason?.includes('qrcode'))
  assert.ok(sent[0].content.text.includes('Rp 25.000') && sent[0].content.text.includes('INV-1') && sent[0].content.text.includes(r1.qris))
  assert.deepEqual(sent[0].options, { ephemeralExpiration: 86400 }); assert.equal(sent[0].content.mentionAll, true)
  const r2 = await api.sendCreatePaymentGobiz('628@s.whatsapp.net', { qris: staticQris, amount: 2000, image: Buffer.from('png'), caption: 'Bayar {amount} ({orderId})', orderId: 'X9' })
  assert.equal(r2.imageSent, true); assert.ok(Buffer.isBuffer(sent[1].content.image)); assert.equal(sent[1].content.caption, 'Bayar Rp 2.000 (X9)'); assert.equal(sent[1].content.text, undefined)
  await api.sendCreatePaymentGobiz('628@s.whatsapp.net', { qris: staticQris, amount: 2000, image: false, text: (v) => `T:${v.rawAmount}` })
  assert.equal(sent[2].content.text, 'T:2000'); assert.equal(sent[2].content.image, undefined)
  await assert.rejects(api.sendCreatePaymentGobiz('628@s.whatsapp.net', { qris: 'rusak', amount: 1000 }), /QRIS/)

  // status: pending / paid (teks) / paid dengan foto → caption / error
  const st = { calls: [] as string[], analytics: { transactions: [{ transaction_id: 'T1', gross_amount: 2500000, transaction_time: new Date().toISOString() }] } }
  const gobiz = { http: makeHttp(st) }
  const auth = { email: 'a@b.co', password: 'rahasia', merchantId: 'M-1' }
  const p1 = await api.sendStatusPaymentGobiz('628@s.whatsapp.net', { auth, amount: 99999, gobiz, orderId: 'O1' })
  assert.equal(p1.status, 'pending'); assert.ok(sent.at(-1).content.text.includes('belum terdeteksi'))
  const p2 = await api.sendStatusPaymentGobiz('628@s.whatsapp.net', { auth, amount: 25000, gobiz, orderId: 'O2', since: Date.now() - 60_000 })
  assert.equal(p2.status, 'paid'); assert.ok(sent.at(-1).content.text.includes('PEMBAYARAN DITERIMA'))
  await api.sendStatusPaymentGobiz('628@s.whatsapp.net', { auth, amount: 25000, gobiz, since: Date.now() - 60_000, image: { paid: 'https://x/lunas.jpg' }, caption: { paid: 'Lunas {amount}' } })
  assert.equal(sent.at(-1).content.image, 'https://x/lunas.jpg'); assert.equal(sent.at(-1).content.caption, 'Lunas Rp 25.000')
  const p3 = await api.sendStatusPaymentGobiz('628@s.whatsapp.net', { auth: { phone: '0811111111' }, amount: 1000, gobiz })
  assert.equal(p3.status, 'error'); assert.ok(sent.at(-1).content.text.includes('Gagal memeriksa'))
  const p4 = await api.sendStatusPaymentGobiz('628@s.whatsapp.net', { auth, amount: 99999, gobiz, wait: { timeoutMs: 10, intervalMs: 5 } })
  assert.equal(p4.status, 'timeout')

  // login password, login OTP → verifikasi OTP
  const l1 = await api.sendLoginGobiz('628@s.whatsapp.net', { auth: { email: 'toko@mail.com', password: 'rahasia' }, gobiz })
  assert.equal(l1.ok, true); assert.ok(sent.at(-1).content.text.includes('Toko Uji') && sent.at(-1).content.text.includes('to***@mail.com')); assert.ok(!JSON.stringify(sent.at(-1)).includes('rahasia'))
  const l2 = await api.sendLoginGobiz('628@s.whatsapp.net', { auth: { email: 'toko@mail.com', password: 'salah' }, gobiz })
  assert.equal(l2.ok, false); assert.ok(sent.at(-1).content.text.includes('Login GoBiz gagal'))
  const o1 = await api.sendLoginGobiz('628@s.whatsapp.net', { auth: { phone: '081234567890' }, gobiz })
  assert.deepEqual([o1.ok, (o1 as any).method], [true, 'otp']); assert.ok(sent.at(-1).content.text.includes('+62812****890'))
  const o2 = await api.sendOtpGobiz('628@s.whatsapp.net', { auth: { phone: '081234567890' }, otp: '123456', gobiz }) // otpToken diambil otomatis
  assert.equal(o2.ok, true)
  const o3 = await api.sendOtpGobiz('628@s.whatsapp.net', { auth: { phone: '081234567890' }, otp: '000000', otpToken: 'OTPTOK', gobiz })
  assert.equal(o3.ok, false)
  ok('3. sock.*Gobiz: buat pembayaran, status, login, OTP (foto→caption, tanpa foto→teks)')
}

// ---------------------------------------------------------------- contextInfo / externalAdReply
{
  const ad = { title: 'Toko', body: 'Promo', mediaType: 'image' as const, thumbnailUrl: 'https://t/x.jpg', sourceUrl: 'https://toko.id', renderLargerThumbnail: true, showAdAttribution: true }
  const ctxOf = (c: any) => c.extendedTextMessage?.contextInfo ?? Object.values(c).map((v: any) => v?.contextInfo).find(Boolean)
  const text = generateMessageContent({ text: 'Halo', mentions: ['1@s.whatsapp.net'] }, { contextInfo: { externalAdReply: ad, mentionAll: true, forwardedNewsletter: { jid: '1@newsletter', name: 'Saluran' } } }) as any
  assert.equal(text.extendedTextMessage.text, 'Halo')
  const ci = ctxOf(text)
  assert.equal(ci.externalAdReply.title, 'Toko'); assert.equal(ci.externalAdReply.mediaType, 1); assert.equal(ci.nonJidMentions, 1)
  assert.deepEqual(ci.mentionedJid, ['1@s.whatsapp.net']); assert.equal(ci.forwardedNewsletterMessageInfo.newsletterJid, '1@newsletter'); assert.equal(ci.isForwarded, true)
  // berlaku untuk semua jenis pesan yang membawa contextInfo
  const kinds: any[] = [
    { buttons: { text: 'x', buttons: [{ id: '1', text: 'a' }] } }, { list: { title: 'T', text: 'x', buttonText: 'B', sections: [{ title: 'S', rows: [{ id: 'r', title: 'R' }] }] } },
    { interactive: { body: 'x', buttons: [{ type: 'reply', text: 'a', id: 'a' }] } }, { location: { degreesLatitude: 1, degreesLongitude: 2 } },
    { contacts: [{ displayName: 'A', vcard: 'BEGIN:VCARD\nEND:VCARD' }] }, { poll: { name: 'Q', values: ['a', 'b'] } }, { event: { name: 'E', startDate: new Date() } },
    { order: { orderId: 'o', itemCount: 1, sellerJid: '1@s.whatsapp.net', total: 10 } }, { raw: { imageMessage: { url: 'https://x' } } },
  ]
  for (const k of kinds) {
    const c = generateMessageContent(k, { contextInfo: { externalAdReply: ad } }) as any
    const found = JSON.stringify(roundTrip(c)).includes('"externalAdReply"') || JSON.stringify(c).includes('externalAdReply')
    assert.ok(found, 'contextInfo hilang pada ' + Object.keys(k)[0])
  }
  // pesan pembayaran tidak membawa contextInfo → diabaikan tanpa error
  assert.doesNotThrow(() => generateMessageContent({ requestPayment: { amount: 1000, from: '1@s.whatsapp.net' } }, { contextInfo: { externalAdReply: ad } }))
  ok('4. contextInfo + externalAdReply di semua jenis pesan')
}

// ---------------------------------------------------------------- pesan langka (encode/decode protobuf)
{
  const key = { remoteJid: 'a@s.whatsapp.net', fromMe: true, id: 'K1' }
  const ev = roundTrip(generateMessageContent({ event: { name: 'Rapat', description: 'Zoom', startDate: new Date('2026-12-01T03:00:00Z'), endDate: new Date('2026-12-01T04:00:00Z'), location: { degreesLatitude: -6.2, degreesLongitude: 106.8, name: 'Jkt' } } }))
  assert.equal(ev.eventMessage.name, 'Rapat'); assert.equal(Number(ev.eventMessage.startTime), Date.parse('2026-12-01T03:00:00Z') / 1000); assert.equal(ev.messageContextInfo.messageSecret.length, 32)
  const k = (o: any) => Object.keys(o).find((x) => x.startsWith('pollCreation'))
  assert.equal(k(generateMessageContent({ poll: { name: 'Q', values: ['a', 'b'] } }) as any), 'pollCreationMessage')
  assert.equal(k(generateMessageContent({ poll: { name: 'Q', values: ['a', 'b'], selectableCount: 1 } }) as any), 'pollCreationMessageV3')
  assert.equal(k(generateMessageContent({ poll: { name: 'Q', values: ['a', 'b'], toAnnouncementGroup: true } }) as any), 'pollCreationMessageV2')
  assert.throws(() => generateMessageContent({ poll: { name: 'Q', values: ['a'] } }), /minimal 2/)
  const pin = roundTrip(generateMessageContent({ pin: { key, type: 'pin', duration: 604800 } })); assert.equal(pin.pinInChatMessage.type, 1); assert.equal(pin.messageContextInfo.messageAddOnDurationInSecs, 604800)
  assert.equal(roundTrip(generateMessageContent({ pin: { key, type: 'unpin' } })).pinInChatMessage.type, 2)
  assert.equal(roundTrip(generateMessageContent({ album: { images: 2, videos: 1 } })).albumMessage.expectedImageCount, 2)
  const rp = roundTrip(generateMessageContent({ requestPayment: { amount: 50000, from: '628@s.whatsapp.net', note: 'Bayar ya', expiresAt: 1900000000 } })).requestPaymentMessage
  assert.deepEqual([rp.currencyCodeIso4217, Number(rp.amount1000), rp.amount.offset, rp.noteMessage.extendedTextMessage.text], ['IDR', 50000000, 1000, 'Bayar ya'])
  assert.ok(roundTrip(generateMessageContent({ sendPayment: { requestKey: key, note: 'ok' } })).sendPaymentMessage.requestMessageKey)
  assert.ok(roundTrip(generateMessageContent({ cancelPaymentRequest: key })).cancelPaymentRequestMessage.key)
  assert.equal(roundTrip(generateMessageContent({ paymentInvite: { service: 'UPI' } })).paymentInviteMessage.serviceType, 3)
  const pr = roundTrip(generateMessageContent({ product: { productId: 'p1', title: 'Kopi', price: 25000, businessOwnerJid: '628@s.whatsapp.net', retailerId: 'r1' } })).productMessage
  assert.equal(Number(pr.product.priceAmount1000), 25000000)
  const od = roundTrip(generateMessageContent({ order: { orderId: 'o1', itemCount: 2, sellerJid: '628@s.whatsapp.net', total: 15000, status: 'accepted' } })).orderMessage
  assert.deepEqual([od.orderId, od.status, Number(od.totalAmount1000)], ['o1', 2, 15000000])
  assert.equal(roundTrip(generateMessageContent({ groupInvite: { groupJid: '1@g.us', inviteCode: 'CODE', groupName: 'Grup' } })).groupInviteMessage.inviteCode, 'CODE')
  const sc = roundTrip(generateMessageContent({ scheduledCall: { title: 'Sync', at: new Date('2026-12-01T03:00:00Z'), type: 'video' } })).scheduledCallCreationMessage; assert.equal(sc.callType, 2)
  assert.ok(roundTrip(generateMessageContent({ requestPhoneNumber: true })).requestPhoneNumberMessage)
  assert.ok(roundTrip(generateMessageContent({ ptv: { videoMessage: { url: 'https://x', mimetype: 'video/mp4' } } })).ptvMessage)
  assert.equal(roundTrip(generateMessageContent({ groupStatus: { conversation: 'halo grup' } as any })).groupStatusMessageV2.message.conversation, 'halo grup')
  ok('5. pesan langka: event, poll, pin, album, pembayaran, produk, order, undangan grup, panggilan, ptv, status grup')
}

// ---------------------------------------------------------------- tombol baru (payment, lokasi, dll) + legacy media
{
  const p = buildPaymentParams({ referenceId: 'ORD-1', total: 50000, items: [{ name: 'Kopi', price: 25000, quantity: 2, retailerId: 'r1' }], paymentSettings: [{ type: 'payment_link', payment_link: { uri: 'https://pay' } }] }) as any
  assert.deepEqual([p.currency, p.total_amount, p.reference_id, p.order.subtotal, p.order.items[0].amount, p.order.items[0].quantity], ['IDR', { value: 5000000, offset: 100 }, 'ORD-1', { value: 5000000, offset: 100 }, { value: 2500000, offset: 100 }, 2])
  assert.deepEqual(buildPaymentParams({ custom: 1 } as any), { custom: 1 })
  const j = (b: any) => JSON.parse(toNativeFlowButton(b).buttonParamsJson)
  assert.equal(toNativeFlowButton({ type: 'location' }).name, 'send_location'); assert.equal(j({ type: 'location' }).display_text, 'Kirim Lokasi')
  assert.equal(toNativeFlowButton({ type: 'reminder', text: 'Ingatkan', id: 'r1' }).name, 'cta_reminder')
  assert.equal(toNativeFlowButton({ type: 'cancel_reminder', text: 'Batal' }).name, 'cta_cancel_reminder')
  assert.equal(toNativeFlowButton({ type: 'catalog', businessPhoneNumber: '628' }).name, 'cta_catalog')
  assert.deepEqual(j({ type: 'webview', text: 'Buka', url: 'https://x.id' }).link, { in_app_webview: true, url: 'https://x.id' })
  assert.equal(toNativeFlowButton({ type: 'payment', payment: { referenceId: 'R', total: 1000 } }).name, 'review_and_pay')
  assert.equal(toNativeFlowButton({ type: 'payment', name: 'payment_info', payment: { referenceId: 'R', total: 1000 } }).name, 'payment_info')
  assert.equal(toNativeFlowButton({ type: 'raw', name: 'mpm', params: { a: 1 } }).buttonParamsJson, '{"a":1}')
  // semua tipe tombol baru bisa dipakai di kartu carousel & di-encode protobuf
  const car = generateMessageContent({ carousel: { cards: [
    { body: 'A', buttons: [{ type: 'location' }, { type: 'reminder', text: 'R' }, { type: 'webview', text: 'W', url: 'https://x.id' }, { type: 'payment', payment: { referenceId: 'R', total: 1000 } }] },
    { body: 'B', buttons: [{ type: 'select', title: 'Menu', sections: [{ title: 'S', rows: [{ id: 'r', title: 'R' }] }] }, { type: 'copy', text: 'Salin', code: 'K' }] }] } })
  assert.equal(roundTrip(car).interactiveMessage.carouselMessage.cards[0].nativeFlowMessage.buttons.length, 4)
  // legacy buttons/template dengan media & lokasi
  const bm = generateMessageContent({ buttons: { text: 'x', media: { imageMessage: { url: 'https://x', mimetype: 'image/jpeg' } }, buttons: [{ id: '1', text: 'A' }] } }) as any
  assert.equal(bm.buttonsMessage.headerType, 4); assert.ok(bm.buttonsMessage.imageMessage)
  assert.equal((generateMessageContent({ buttons: { text: 'x', media: { videoMessage: { url: 'https://x' } }, buttons: [{ id: '1', text: 'A' }] } }) as any).buttonsMessage.headerType, 5)
  assert.equal((generateMessageContent({ buttons: { text: 'x', media: { documentMessage: { url: 'https://x' } }, buttons: [{ id: '1', text: 'A' }] } }) as any).buttonsMessage.headerType, 3)
  const tm = generateMessageContent({ template: { text: 'x', media: { imageMessage: { url: 'https://x' } }, buttons: [{ type: 'url', text: 'Web', url: 'https://x.id' }] } }) as any
  assert.ok(JSON.stringify(roundTrip(tm)).includes('imageMessage'))
  ok('6. tombol payment/lokasi/reminder/webview/raw + header media buttons/template')
}

// ---------------------------------------------------------------- sock: sumber media, saluran, album, undangan grup
{
  const sock = makeSocket({ auth: createMemoryAuthState(), logger: createLogger({ level: 'silent' }), reconnect: false })
  const prepared: any[] = []; const given: any[] = []; const channelSent: any[] = []
  ;(sock.media as any).prepare = async (kind: string, source: any, opts: any) => { prepared.push([kind, source, opts]); return kind === 'image' ? { imageMessage: { url: 'https://mmg/x', mimetype: 'image/jpeg' } } : { [kind + 'Message']: { url: 'https://mmg/v', mimetype: 'x/y' } } }
  ;(sock.media as any).readSource = async () => Buffer.from('jpeg-bytes')
  ;(sock.messages as any).send = async (jid: string, input: any, options: any) => { given.push({ jid, input, options }); return { message: { key: { id: 'K' + given.length, remoteJid: jid, fromMe: true } } } }
  ;(sock.channels as any).send = async (jid: string, content: any) => { channelSent.push({ jid, content }); return 'CH1' }
  ;(sock.channels as any).metadata = async (_t: string, code: string) => ({ id: '120363999@newsletter', name: 'Saluran ' + code })
  ;(sock.groups as any).inviteCode = async () => 'INVCODE'
  ;(sock.groups as any).metadata = async () => ({ subject: 'Grup Uji' })
  const DM = '628@s.whatsapp.net'

  await sock.sendMessage(DM, { text: 'Halo', externalAdReply: { title: 'T', thumbnail: 'https://t/x.jpg', sourceUrl: 'https://s.id' }, mentionAll: true, forwardedNewsletter: { jid: '1@newsletter', name: 'N' } }, { quoted: { key: { id: 'Q' } } as any })
  const g0 = given.at(-1); assert.equal(g0.input.text, 'Halo'); assert.ok(Buffer.isBuffer(g0.options.contextInfo.externalAdReply.thumbnail)); assert.equal(g0.options.contextInfo.mentionAll, true); assert.deepEqual(g0.options.quoted, { key: { id: 'Q' } })
  assert.equal((g0.input as any).externalAdReply, undefined) // pintasan tidak bocor ke isi pesan
  await sock.sendMessage(DM, { image: './a.jpg', caption: 'c', contextInfo: { isForwarded: true, forwardingScore: 9 } }, { contextInfo: { forwardingScore: 99 } })
  assert.deepEqual([given.at(-1).options.contextInfo.isForwarded, given.at(-1).options.contextInfo.forwardingScore], [true, 99]) // opsi ketiga menang
  // buttons/template dengan sumber media langsung
  await sock.sendMessage(DM, { buttons: { text: 'Menu', image: 'https://x/menu.jpg', buttons: [{ id: '1', text: 'A' }] } })
  assert.equal(prepared.at(-1)[0], 'image'); assert.deepEqual(prepared.at(-1)[1], { url: 'https://x/menu.jpg' }); assert.ok((given.at(-1).input.buttons as any).media.imageMessage); assert.equal((given.at(-1).input.buttons as any).image, undefined)
  await sock.sendMessage(DM, { template: { text: 'T', video: './v.mp4', buttons: [{ type: 'url', text: 'W', url: 'https://x.id' }] } }); assert.equal(prepared.at(-1)[0], 'video')
  // carousel dengan kartu bertombol baru + media
  await sock.sendMessage(DM, { carousel: { cards: [{ header: { title: 'A', image: './a.jpg' }, body: 'x', buttons: [{ type: 'payment', payment: { referenceId: 'R', total: 1000 } }, { type: 'location' }] }] } })
  assert.ok(generateMessageContent(given.at(-1).input))
  // produk dengan gambar, order dengan thumbnail dari link, ptv, status grup
  await sock.sendMessage(DM, { product: { productId: 'p', title: 'Kopi', price: 1000, businessOwnerJid: DM, image: 'https://x/p.jpg' } })
  assert.ok((given.at(-1).input.product as any).image.url)
  await sock.sendMessage(DM, { order: { orderId: 'o', itemCount: 1, sellerJid: DM, total: 10, thumbnail: 'https://x/t.jpg' } }); assert.ok(Buffer.isBuffer((given.at(-1).input.order as any).thumbnail))
  await sock.sendMessage(DM, { ptv: './bulat.mp4' }); assert.ok((given.at(-1).input.ptv as any).videoMessage)
  await sock.sendMessage('120363@g.us', { groupStatus: { text: 'Status grup' } }); assert.equal(generateMessageContent(given.at(-1).input).groupStatusMessageV2?.message?.conversation ?? (generateMessageContent(given.at(-1).input).groupStatusMessageV2 as any).message.extendedTextMessage?.text, 'Status grup')
  await sock.sendMessage(DM, { poll: { name: 'Q', values: ['a', 'b'] } }); await sock.sendMessage(DM, { event: { name: 'E', startDate: new Date() } }); await sock.sendMessage(DM, { requestPayment: { amount: 5000, from: DM } })

  // saluran: media diunggah mentah (newsletter: true), pesan lewat channels.send, URL → JID
  prepared.length = 0
  const chId = await sock.sendMessage('120363999@newsletter', { image: 'https://x/poster.jpg', caption: 'Poster' })
  assert.equal(chId, 'CH1'); assert.equal(prepared.at(-1)[2].newsletter, true); assert.ok(channelSent.at(-1).content.imageMessage)
  await sock.sendMessage('120363999@newsletter', { video: './v.mp4', caption: 'Video' }); await sock.sendMessage('120363999@newsletter', { audio: './a.ogg', ptt: true }); await sock.sendMessage('120363999@newsletter', { document: './f.pdf', fileName: 'f.pdf', mimetype: 'application/pdf' })
  assert.deepEqual(prepared.map((p) => p[0]), ['image', 'video', 'ptt', 'document']); assert.ok(prepared.every((p) => p[2].newsletter === true))
  await sock.sendMessage('120363999@newsletter', { text: 'Halo subscriber', externalAdReply: { title: 'T' } }); assert.ok(channelSent.at(-1).content.extendedTextMessage.contextInfo.externalAdReply)
  assert.equal(parseChannelCode('https://whatsapp.com/channel/0029VaABCdefGHIjkl12?mode=r_c'), '0029VaABCdefGHIjkl12'); assert.equal(parseChannelCode('0029VaABCdefGHIjkl12'), '0029VaABCdefGHIjkl12'); assert.throws(() => parseChannelCode('http://bukan.saluran/x'), /tidak valid/)
  assert.equal(await sock.newsletterIdFromUrl('https://whatsapp.com/channel/0029VaABCdefGHIjkl12'), '120363999@newsletter'); assert.equal(await sock.newsletterUrlId('0029VaABCdefGHIjkl12'), '120363999@newsletter')

  // album + undangan grup
  given.length = 0
  const album = await sock.sendAlbumMessage(DM, [{ image: './1.jpg', caption: 'satu' }, { video: './2.mp4' }])
  assert.equal(album.length, 3); assert.ok('album' in given[0].input); assert.deepEqual((given[0].input as any).album, { images: 1, videos: 1 })
  const assoc = (given[1].input as any).raw.messageContextInfo.messageAssociation; assert.deepEqual([assoc.associationType, assoc.messageIndex, assoc.parentMessageKey.id], [1, 1, 'K1'])
  assert.equal(((given[2].input as any).raw.messageContextInfo.messageAssociation).messageIndex, 2)
  const inv = await sock.sendGroupInvite(DM, '120363@g.us', 'Gabung ya'); assert.equal((given.at(-1).input as any).groupInvite.inviteCode, 'INVCODE'); assert.equal((given.at(-1).input as any).groupInvite.groupName, 'Grup Uji'); assert.ok(inv)
  // API GoBiz terpasang di sock
  assert.deepEqual(['sendCreatePaymentGobiz', 'sendStatusPaymentGobiz', 'sendLoginGobiz', 'sendOtpGobiz'].map((n) => typeof (sock as any)[n]), ['function', 'function', 'function', 'function'])
  await sock.end()
  ok('7. sock: pintasan konteks, media langsung, saluran (URL→JID, media mentah), album, undangan grup, GoBiz')
}
// ---------------------------------------------------------------- upload media mentah untuk saluran (tanpa enkripsi)
{
  const { MediaManager } = await import('../../src/media/media-manager.ts')
  const { createHash } = await import('node:crypto')
  const uploads: Array<{ url: string; body: Buffer }> = []
  const fetchStub = (async (url: string, init: any) => {
    const chunks: Buffer[] = []
    for await (const c of init.body as AsyncIterable<Buffer>) chunks.push(Buffer.from(c))
    uploads.push({ url, body: Buffer.concat(chunks) })
    return new Response(JSON.stringify({ url: 'https://mmg.whatsapp.net/v/t62/file', direct_path: '/v/t62/file' }), { status: 200 })
  }) as unknown as typeof fetch
  const query = async () => ({ tag: 'iq', attrs: {}, content: [{ tag: 'media_conn', attrs: { auth: 'AUTHTOK', ttl: '300' }, content: [{ tag: 'host', attrs: { hostname: 'mmg.example.net', maxContentLengthBytes: '104857600' } }] }] })
  const mm = new MediaManager({ query, fetch: fetchStub } as any)
  const payload = Buffer.from('isi-dokumen-asli-untuk-saluran')
  const doc: any = await mm.prepare('document', { buffer: payload }, { newsletter: true, fileName: 'a.pdf', mimetype: 'application/pdf' })
  const sha = createHash('sha256').update(payload).digest()
  assert.ok(uploads[0]!.body.equals(payload)) // dikirim apa adanya, tanpa enkripsi
  assert.ok(uploads[0]!.url.includes(`/${sha.toString('base64url')}?auth=AUTHTOK&token=${sha.toString('base64url')}`))
  const m = doc.documentMessage
  assert.ok(Buffer.from(m.fileSha256).equals(sha)); assert.equal(Number(m.fileLength), payload.length); assert.equal(m.directPath, '/v/t62/file'); assert.equal(m.mediaKey, undefined); assert.equal(m.fileEncSha256, undefined)
  const enc: any = await mm.prepare('document', { buffer: payload }, { fileName: 'a.pdf', mimetype: 'application/pdf' }) // media biasa tetap terenkripsi
  assert.ok(enc.documentMessage.mediaKey && enc.documentMessage.fileEncSha256); assert.ok(!uploads[1]!.body.equals(payload))
  ok('8. upload media saluran: mentah (tanpa enkripsi/mediaKey); media biasa tetap terenkripsi')
}
console.log('ALL OK')
