import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import {
  makeSocket, createMemoryAuthState, createNodeCodec, NoiseHandler, ProtoWriter, readProto, protoBytes, sharedKey, generateKeyPair,
  initAuthCreds, MemoryKeyStore, createTransactionalKeyStore, CryptoEngine, padRandomMax16, unpadRandomMax16, authJsonReplacer, authJsonReviver,
  MessageStatus, extractText, jidToSignalAddress, getChildren, getChild, getContentBytes, createLogger, MessageError,
  type MessageCodec, type BinaryNode,
} from '../../src/index.ts'
const { WebSocketServer } = createRequire(import.meta.url)('ws')
const ok = (n: string) => console.log(n, 'ok')
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
async function until(pred: () => boolean, ms = 3000, what = 'kondisi') { const t = Date.now(); while (!pred()) { if (Date.now() - t > ms) throw new Error(`timeout menunggu ${what}`); await wait(10) } }

const codec: MessageCodec = { encode: (c) => Buffer.from(JSON.stringify(c, authJsonReplacer)), decode: (b) => JSON.parse(Buffer.from(b).toString(), authJsonReviver) }
const nodeCodec = createNodeCodec()

// ---------- server WhatsApp tiruan (Noise responder + node terenkripsi) ----------
interface Conn { id: number; ws: any; got: BinaryNode[]; send(n: BinaryNode): void; payload?: string; clientStatic?: Buffer }
function startServer(onNode: (node: BinaryNode, c: Conn) => void | Promise<void>, opts: { autoSuccess?: boolean } = {}) {
  const wss = new WebSocketServer({ port: 0 }); const conns: Conn[] = []
  const serverStatic = generateKeyPair(); const frame = (p: Uint8Array) => { const h = Buffer.alloc(3); h.writeUIntBE(p.length, 0, 3); return Buffer.concat([h, p]) }
  wss.on('connection', (ws: any) => {
    let buf = Buffer.alloc(0), intro = false, step = 0, noise: NoiseHandler
    const conn: Conn = { id: conns.length + 1, ws, got: [], send: (n) => ws.send(frame(noise.encrypt(nodeCodec.encode(n)))) }; conns.push(conn)
    ws.on('message', (d: Buffer) => {
      buf = Buffer.concat([buf, d]); if (!intro) { if (buf.length < 4) return; buf = buf.subarray(4); intro = true }
      while (buf.length >= 3) {
        const len = buf.readUIntBE(0, 3); if (buf.length < 3 + len) return
        const payload = buf.subarray(3, 3 + len); buf = buf.subarray(3 + len)
        if (step === 0) {
          const eph = generateKeyPair(); const hello = protoBytes(readProto(protoBytes(readProto(payload), 2)!), 1)!
          noise = new NoiseHandler(eph, { role: 'responder', remoteEphemeral: hello }); noise.authenticate(eph.public); noise.mixIntoKey(sharedKey(eph.private, hello))
          const encStatic = noise.encrypt(serverStatic.public); noise.mixIntoKey(sharedKey(serverStatic.private, hello)); const cert = noise.encrypt(Buffer.from('cert'))
          ws.send(frame(new ProtoWriter().bytes(3, new ProtoWriter().bytes(1, eph.public).bytes(2, encStatic).bytes(3, cert).toBuffer()).toBuffer())); (conn as any).eph = eph; step = 1
        } else if (step === 1) {
          const fin = readProto(protoBytes(readProto(payload), 4)!); conn.clientStatic = noise.decrypt(protoBytes(fin, 1)!)
          noise.mixIntoKey(sharedKey((conn as any).eph.private, conn.clientStatic)); conn.payload = noise.decrypt(protoBytes(fin, 2)!).toString(); noise.finishInit(); step = 2
          if (opts.autoSuccess !== false) conn.send({ tag: 'success', attrs: { t: '1700000000' } })
        } else { const node = nodeCodec.decode(noise.decrypt(payload)); conn.got.push(node); void onNode(node, conn) }
      }
    })
  })
  return new Promise<{ url: string; conns: Conn[]; close(): void }>((r) => wss.on('listening', () => r({ url: `ws://127.0.0.1:${wss.address().port}`, conns, close: () => wss.close() })))
}

// ---------- pihak lawan bicara (Bob) dengan kripto asli ----------
function party() { const creds = initAuthCreds(), store = new MemoryKeyStore(), keys = createTransactionalKeyStore(store); return { creds, store, keys, crypto: new CryptoEngine({ keys, getCreds: () => creds }) } }
const bob = party()
const ME = 'me:7@s.whatsapp.net', BOB = 'bob@s.whatsapp.net'   // klien = device companion 7; Bob = device 0 (tanpa ':0' di wire)
const inbox: BinaryNode[] = []
const devices: Record<string, string[]> = { 'me@s.whatsapp.net': ['7'], 'bob@s.whatsapp.net': ['0'] }
let removedDevice = false
const usyncReply = (node: any) => ({ tag: 'iq', attrs: { type: 'result', id: node.attrs.id }, content: [{ tag: 'usync', attrs: {}, content: [{ tag: 'list', attrs: {}, content: node.content[0].content[1].content.map((u: any) => ({ tag: 'user', attrs: { jid: u.attrs.jid }, content: [{ tag: 'devices', attrs: {}, content: [{ tag: 'device-list', attrs: {}, content: (devices[u.attrs.jid] ?? ['0']).map((id) => ({ tag: 'device', attrs: { id } })) }] }] })) }] }] })
const server = await startServer((node, c) => {
  if (node.tag === 'iq' && node.attrs.xmlns === 'usync') c.send(usyncReply(node) as BinaryNode)
  else if (node.tag === 'iq' && node.attrs.xmlns === 'md') { removedDevice = true; c.send({ tag: 'iq', attrs: { type: 'result', id: node.attrs.id! } }) }
  else inbox.push(node)
})

// ---------- klien ----------
const authProvider = createMemoryAuthState()
const logs: any[] = []
const client = makeSocket({
  url: server.url, auth: authProvider, codec, clientPayload: () => Buffer.from('payload-login'), markOnlineOnConnect: false, keepAliveIntervalMs: 60_000, connectTimeoutMs: 3000,
  reconnect: { initialDelayMs: 20, jitter: 0 }, logger: createLogger({ level: 'warn', write: (l) => logs.push(JSON.parse(l)) }), callAutoReject: false,
})
const events: Array<[string, any]> = []; for (const e of ['messages.upsert', 'messages.update', 'message-receipt.update', 'groups.update', 'group-participants.update', 'call', 'presence.update', 'connection.update'] as const) client.ev.on(e, (p: any) => events.push([e, p]))
const take = (name: string) => events.filter(([n]) => n === name).map(([, p]) => p)

// 1. koneksi + handshake Noise
await client.connect(); await client.waitForOpen(3000)
assert.equal(client.state.status, 'open'); assert.equal(server.conns[0]!.payload, 'payload-login'); assert.deepEqual(server.conns[0]!.clientStatic, Buffer.from(authProvider.state.creds.noiseKey.public))
assert.deepEqual(client.socket.modules.map((m) => m.name), ['auth', 'pairing', 'reconnect', 'group-events', 'call-events', 'message-receiver', 'connection'])
assert.match(client.diagnostics().modules.join(), /connection/); assert.equal(client.diagnostics().store!.chats, 0)
await assert.rejects(client.messages.send('bob@s.whatsapp.net', { text: 'x' }), (e: any) => e instanceof MessageError && e.code === 'ERR_NOT_LOGGED_IN')       // belum login
client.socket.ev.emit('creds.update', { me: { id: ME, name: 'Aku' } } as any); await wait(20)
assert.equal(client.auth.creds.me!.id, ME); assert.equal(client.store!.session.me!.id, ME); assert.equal(client.auth.isRegistered, true)
ok('1. koneksi + Noise + login')

// 2. pesan masuk dari Bob (pkmsg) -> dekripsi, upsert, ack, receipt
await client.auth.keys.set({ 'pre-key': { '11': generateKeyPair() } })
const preKey = (await client.auth.keys.get('pre-key', ['11']))['11']!
const c = client.auth.creds
await bob.crypto.sessions.injectBundle('me.7', { registrationId: c.registrationId, identityKey: c.signedIdentityKey.public, signedPreKey: { keyId: c.signedPreKey.keyId, publicKey: c.signedPreKey.keyPair.public, signature: c.signedPreKey.signature }, preKey: { keyId: 11, publicKey: preKey.public } })
const enc1 = await bob.crypto.sessions.encrypt('me.7', padRandomMax16(codec.encode({ conversation: 'halo klien' })))
const incoming = (id: string, e: typeof enc1, extra: Record<string, string> = {}): BinaryNode => ({ tag: 'message', attrs: { id, from: BOB, t: '1700000100', notify: 'Bobby', type: 'text', ...extra }, content: [{ tag: 'enc', attrs: { v: '2', type: e.type }, content: e.ciphertext }] })
server.conns[0]!.send(incoming('IN1', enc1)); await until(() => take('messages.upsert').length === 1, 3000, 'messages.upsert')
const up = take('messages.upsert')[0]; assert.deepEqual([extractText(up.messages[0].message), up.type, up.messages[0].key], ['halo klien', 'notify', { remoteJid: BOB, fromMe: false, id: 'IN1' }])
assert.deepEqual([client.store!.chats.get(BOB)!.unreadCount, client.store!.contacts.getName(BOB)], [1, 'Bobby'])
await until(() => inbox.some((n) => n.tag === 'receipt'), 3000, 'receipt'); const ack1 = inbox.find((n) => n.tag === 'ack')!, rc1 = inbox.find((n) => n.tag === 'receipt')!
assert.deepEqual([ack1.attrs.class, ack1.attrs.id, ack1.attrs.to], ['message', 'IN1', BOB]); assert.deepEqual([rc1.attrs.id, rc1.attrs.to, rc1.attrs.type], ['IN1', BOB, undefined])
assert.equal((await client.auth.keys.get('pre-key', ['11']))['11'], undefined)                                                                              // pre-key terpakai
server.conns[0]!.send(incoming('IN1', enc1)); await wait(60); assert.equal(take('messages.upsert').length, 1); assert.equal(inbox.filter((n) => n.tag === 'ack').length, 2)   // duplikat: hanya di-ack
ok('2. pesan masuk + ack + receipt + dedupe')

// 3. pesan rusak -> nack, tanpa upsert
const bad = await bob.crypto.sessions.encrypt('me.7', padRandomMax16(codec.encode({ conversation: 'akan rusak' }))); bad.ciphertext[bad.type === 'msg' ? bad.ciphertext.length - 1 : bad.ciphertext.length - 9]! ^= 1   // pkmsg: MAC SignalMessage dalam ada sebelum field 5 & 6
const before = inbox.length; server.conns[0]!.send(incoming('BAD1', bad)); await until(() => inbox.length > before, 3000, 'nack')
assert.deepEqual([inbox.at(-1)!.tag, inbox.at(-1)!.attrs.id, inbox.at(-1)!.attrs.error], ['ack', 'BAD1', '487']); assert.equal(take('messages.upsert').length, 1); assert.ok(logs.some((l) => /failed to decrypt/.test(l.msg)))
ok('3. gagal dekripsi -> nack')

// 4. kirim balasan: sesi sudah ada -> tanpa query bundle; Bob mendekripsi
const sent = await client.messages.send('bob@s.whatsapp.net', { text: 'balasan dari klien' }, { quotedKey: up.messages[0].key })
await until(() => inbox.some((n) => n.tag === 'message'), 3000, 'message keluar'); const out = inbox.find((n) => n.tag === 'message')!
assert.deepEqual([out.attrs.to, out.attrs.type, out.attrs.id], ['bob@s.whatsapp.net', 'text', sent.message.key.id]); assert.deepEqual(sent.relay.recipients, ['bob@s.whatsapp.net'])
const toNode = getChildren(getChild(out, 'participants')!, 'to')[0]!; const encOut = getChild(toNode, 'enc')!
const plain = codec.decode(unpadRandomMax16(await bob.crypto.sessions.decrypt('me.7', encOut.attrs.type as any, getContentBytes(encOut)!)))
assert.deepEqual([plain.extendedTextMessage.text, plain.extendedTextMessage.contextInfo.stanzaId], ['balasan dari klien', 'IN1']); assert.equal(client.store!.loadMessage(sent.message.key)!.status, MessageStatus.PENDING)
ok('4. kirim balasan ber-quote')

// 5. ack server + receipt baca dari Bob -> status naik di store
server.conns[0]!.send({ tag: 'ack', attrs: { class: 'message', id: sent.message.key.id, from: 'bob@s.whatsapp.net' } }); await until(() => client.store!.loadMessage(sent.message.key)?.status === MessageStatus.SERVER_ACK, 3000, 'SERVER_ACK')
server.conns[0]!.send({ tag: 'receipt', attrs: { id: sent.message.key.id, from: BOB, type: 'read', t: '1700000200' } }); await until(() => client.store!.loadMessage(sent.message.key)?.status === MessageStatus.READ, 3000, 'READ')
server.conns[0]!.send({ tag: 'receipt', attrs: { id: sent.message.key.id, from: BOB, t: '1700000300' } }); await wait(60); assert.equal(client.store!.loadMessage(sent.message.key)!.status, MessageStatus.READ)   // status tidak turun
assert.equal(inbox.filter((n) => n.tag === 'ack' && n.attrs.class === 'receipt').length, 2); assert.ok(take('message-receipt.update').length >= 2)
ok('5. ack + receipt -> status pesan')

// 6. notifikasi grup, panggilan, presence
server.conns[0]!.send({ tag: 'notification', attrs: { type: 'w:gp2', id: 'NG1', from: '1-2@g.us', participant: BOB }, content: [{ tag: 'subject', attrs: { subject: 'Nama Baru' } }] })
await until(() => take('groups.update').length === 1, 3000, 'groups.update'); assert.equal(take('groups.update')[0][0].subject, 'Nama Baru'); await until(() => inbox.some((n) => n.attrs.id === 'NG1'), 3000, 'ack grup')
server.conns[0]!.send({ tag: 'call', attrs: { from: BOB, id: 'NC1', t: '1700000400' }, content: [{ tag: 'offer', attrs: { 'call-id': 'CALL1', 'call-creator': BOB }, content: [{ tag: 'video', attrs: {} }] }] })
await until(() => take('call').length === 1, 3000, 'call'); assert.deepEqual([take('call')[0][0].status, take('call')[0][0].isVideo, client.calls.active.length], ['offer', true, 1]); await until(() => inbox.some((n) => n.attrs.id === 'NC1' && n.attrs.class === 'call'), 3000, 'ack call')
server.conns[0]!.send({ tag: 'chatstate', attrs: { from: BOB }, content: [{ tag: 'composing', attrs: {} }] }); server.conns[0]!.send({ tag: 'presence', attrs: { from: BOB, type: 'unavailable', last: '1700000000' } })
await until(() => take('presence.update').length === 2, 3000, 'presence'); assert.equal(client.store!.session.getPresences(BOB)![BOB]!.lastKnownPresence, 'unavailable')
server.conns[0]!.send({ tag: 'notification', attrs: { type: 'picture', id: 'NP1', from: BOB }, content: [] }); await until(() => inbox.some((n) => n.attrs.id === 'NP1' && n.attrs.type === 'picture'), 3000, 'ack notifikasi umum')
await client.sendPresenceUpdate('composing', BOB); await until(() => inbox.some((n) => n.tag === 'chatstate'), 3000, 'chatstate'); assert.deepEqual([inbox.find((n) => n.tag === 'chatstate')!.attrs, (inbox.find((n) => n.tag === 'chatstate')!.content as any)[0].tag], [{ from: ME, to: BOB }, 'composing'])
await client.sendPresenceUpdate('available'); await until(() => inbox.some((n) => n.tag === 'presence' && n.attrs.type === 'available'), 3000, 'presence available'); assert.equal(inbox.find((n) => n.tag === 'presence')!.attrs.name, 'Aku')
ok('6. grup + panggilan + presence + notifikasi')

// 7. stream:error 515 -> reconnect otomatis (handshake ulang)
server.conns[0]!.send({ tag: 'stream:error', attrs: { code: '515' } }); await until(() => server.conns.length === 2 && client.state.status === 'open', 4000, 'reconnect')
assert.equal(server.conns[1]!.payload, 'payload-login'); assert.ok(take('connection.update').filter((u: any) => u.connection === 'open').length >= 2)
const enc2 = await bob.crypto.sessions.encrypt('me.7', padRandomMax16(codec.encode({ conversation: 'setelah reconnect' })))
const notifies = () => take('messages.upsert').filter((u: any) => u.type === 'notify')   // pesan keluar sendiri bertipe 'append'
server.conns[1]!.send(incoming('IN2', enc2)); await until(() => notifies().length === 2, 3000, 'upsert setelah reconnect'); assert.equal(extractText(notifies()[1].messages[0].message), 'setelah reconnect')
assert.equal(take('messages.upsert').find((u: any) => u.type === 'append').messages[0].key.fromMe, true)
ok('7. reconnect otomatis, sesi tetap jalan')

// 8. keluar (logout): kirim remove-companion-device, kredensial dihapus, tidak reconnect
const oldNoise = Buffer.from(client.auth.creds.noiseKey.public); const nConns = server.conns.length
await client.logout(); assert.ok(removedDevice); assert.equal(client.state.status, 'closed'); await wait(150); assert.equal(server.conns.length, nConns)
assert.notDeepEqual(Buffer.from(client.auth.creds.noiseKey.public), oldNoise); assert.equal(client.auth.creds.me, undefined); assert.equal(client.auth.isRegistered, false)
ok('8. logout')
client.dispose(); server.close()

// ---------- pairing via QR ----------
{
  const got: BinaryNode[] = []
  const srv = await startServer((n) => { got.push(n) })
  const fresh = createMemoryAuthState()
  const cl = makeSocket({ url: srv.url, auth: fresh, codec, clientPayload: () => Buffer.from('reg'), markOnlineOnConnect: false, reconnect: false, store: false, qrFirstTtlMs: 40 } as any)
  const qrs: string[] = []; cl.ev.on('connection.update', (u) => { if (u.qr) qrs.push(u.qr) })
  await cl.connect(); await cl.waitForOpen(3000)   // server baru boleh mengirim setelah handshake selesai
  srv.conns[0]!.send({ tag: 'iq', attrs: { id: 'P1', type: 'set', from: 's.whatsapp.net' }, content: [{ tag: 'pair-device', attrs: {}, content: [{ tag: 'ref', attrs: {}, content: Buffer.from('REF-AAA') }, { tag: 'ref', attrs: {}, content: Buffer.from('REF-BBB') }] }] })
  await until(() => qrs.length >= 1, 3000, 'qr'); const parts = qrs[0]!.split(',')
  assert.equal(parts.length, 4); assert.equal(parts[0], 'REF-AAA'); assert.equal(parts[1], Buffer.from(fresh.state.creds.noiseKey.public).toString('base64')); assert.equal(parts[2], Buffer.from(fresh.state.creds.signedIdentityKey.public).toString('base64')); assert.equal(parts[3], fresh.state.creds.advSecretKey)
  await until(() => got.some((n) => n.tag === 'iq' && n.attrs.id === 'P1'), 3000, 'jawaban pair-device'); assert.deepEqual([got.find((n) => n.attrs.id === 'P1')!.attrs.type, got.find((n) => n.attrs.id === 'P1')!.attrs.to], ['result', 's.whatsapp.net'])
  assert.equal(cl.pairing.state.status, 'pending'); await assert.rejects(cl.requestPairingCode('6281234567890'), /no backend/)
  const warns: string[] = []; const cl2 = makeSocket({ url: srv.url, auth: createMemoryAuthState(), codec, clientPayload: () => Buffer.from('x'), reconnect: false, logger: createLogger({ level: 'warn', write: (l) => warns.push(JSON.parse(l).msg) }) })
  await cl2.connect(); await cl2.waitForOpen(3000); srv.conns[1]!.send({ tag: 'iq', attrs: { id: 'PS1', type: 'set' }, content: [{ tag: 'pair-success', attrs: {} }] }); await until(() => warns.some((w) => /pair-success/.test(w)), 3000, 'warn pair-success')
  await cl.end(); await cl2.end(); cl.dispose(); cl2.dispose(); srv.close(); ok('9. pairing QR + pair-success tanpa handler')
}
console.log('ALL OK'); setTimeout(() => process.exit(0), 50)
