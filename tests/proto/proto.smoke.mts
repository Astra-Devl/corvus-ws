import assert from 'node:assert/strict'
import {
  ProtoRegistry,
  createRegistry,
  decode,
  decodeMessage,
  deserialize,
  encode,
  encodeMessage,
  loadProtoSource,
  parseProto,
  proto,
  registry,
  serialize,
} from '../../proto/index.ts'
import { ProtoWriter, protoBytes, protoUint, readProto } from '../../src/crypto/proto-lite.ts'
import * as M from '../../src/messages/index.ts'
import {
  createProtoMessageCodec,
  decodeProto,
  encodeProto,
  tryDecodeProto,
  validateProto,
  assertValidProto,
  protoRegistry,
  registerProtoSchema,
} from '../../src/protocol/index.ts'

const ok = (n: string) => console.log(n, 'ok')
const hex = (b: Uint8Array) => Buffer.from(b).toString('hex')
const fromHex = (h: string) => Buffer.from(h.replace(/\s/g, ''), 'hex')

// ---------- parser ----------
const custom = new ProtoRegistry()
loadProtoSource(
  custom,
  `
  // komentar
  syntax = "proto2";
  package t;
  /* blok */
  message A {
    optional int32 a = 1;
    optional string s = 2 [default = "x"];
    repeated int32 packed = 4 [packed = true];
    repeated int32 loose = 5;
    optional sint32 z = 6;
    optional int64 big = 7;
    optional uint64 ubig = 8;
    optional bool flag = 9;
    optional double d = 10;
    optional bytes raw = 11;
    optional Kind kind = 12;
    optional A.Inner inner = 13;
    repeated Inner inners = 14;
    map<string, int32> counts = 15;
    map<int32, Inner> byId = 16;
    optional fixed32 f32 = 17;
    optional sfixed64 sf64 = 18;
    optional float fl = 19;
    oneof pick { string one = 20; int32 two = 21; }
    required string must = 22;
    message Inner { optional string name = 1; }
    enum Kind { UNKNOWN = 0; FIRST = 1; SECOND = 2; NEG = -1; }
  }
`,
  'a.proto',
)
custom.link()
const aDesc = custom.getMessage('t.A')
assert.equal(custom.getMessage('A.Inner').fullName, 't.A.Inner')
assert.deepEqual(custom.getEnum('t.A.Kind').values, { UNKNOWN: 0, FIRST: 1, SECOND: 2, NEG: -1 })
assert.equal(aDesc.fields.find((f) => f.name === 'packed')!.packed, true)
assert.equal(aDesc.fields.find((f) => f.name === 'loose')!.packed, false)
assert.deepEqual(aDesc.oneofs, ['pick'])
assert.equal(aDesc.fields.find((f) => f.name === 'kind')!.type, 'enum')
assert.equal(aDesc.fields.find((f) => f.name === 'counts')!.map!.key, 'string')
// proto3: repeated skalar otomatis packed, tanpa label
const p3 = parseProto('syntax = "proto3"; package q; message B { repeated int32 xs = 1; string s = 2; repeated string names = 3; }', 'b.proto')
const b = p3.messages[0]!
assert.deepEqual(b.fields.map((f) => f.packed), [true, false, false])
assert.throws(() => parseProto('message X { optional int32 = 1; }'), /Expected/)
assert.throws(() => parseProto('message X { optional int32 a = 0; }'), /out of range/)
assert.throws(() => { const r = new ProtoRegistry(); r.add(parseProto('message X { optional Missing m = 1; }', 'x.proto')); r.link() }, /Unresolved type "Missing"/)
assert.throws(() => parseProto('message X { optional string s = 1;'), /end of file/)
assert.throws(() => parseProto('service S {}'), /not supported/)
assert.throws(() => { const r = new ProtoRegistry(); r.add(parseProto('message X {}', 'a.proto')); r.add(parseProto('message X {}', 'b.proto')) }, /Duplicate definition/)
ok('parser')

// ---------- vektor wire resmi ----------
const wire = new ProtoRegistry()
loadProtoSource(
  wire,
  `syntax = "proto2"; message T { optional int32 a = 1; optional string b = 2; optional sint32 c = 3; repeated int32 d = 4 [packed = true];
   optional int64 e = 5; optional uint64 f = 6; optional bool g = 7; optional double h = 8; optional fixed32 i = 9; optional float j = 10; optional sfixed64 k = 11; optional sint64 l = 12; optional bytes m = 13; }`,
  't.proto',
)
const enc = (v: object) => hex(encodeMessage(wire, 'T', v))
assert.equal(enc({ a: 150 }), '089601') // contoh dokumentasi protobuf
assert.equal(enc({ b: 'testing' }), '120774657374696e67')
assert.equal(enc({ d: [3, 270, 86942] }), '2206038e029ea705')
assert.equal(enc({ a: -1 }), '08ffffffffffffffffff01')
assert.equal(enc({ c: -1 }), '1801')
assert.equal(enc({ c: 1 }), '1802')
assert.equal(enc({ e: -2 }), '28feffffffffffffffff01')
assert.equal(enc({ f: 18446744073709551615n }), '30ffffffffffffffffff01')
assert.equal(enc({ g: true, h: 1.5 }), '3801' + '41' + '000000000000f83f')
assert.equal(enc({ i: 7, j: 2 }), '4d07000000' + '5500000040')
assert.equal(enc({ k: -1 }), '59ffffffffffffffff')
assert.equal(enc({ l: -1 }), '6001')
assert.equal(enc({ m: Buffer.from([1, 2]) }), '6a020102')
const dec = (h: string) => decodeMessage<Record<string, unknown>>(wire, 'T', fromHex(h))
assert.deepEqual(dec('089601'), { a: 150 })
assert.deepEqual(dec('08ffffffffffffffffff01'), { a: -1 })
assert.deepEqual(dec('2206038e029ea705'), { d: [3, 270, 86942] })
assert.deepEqual(dec('180103'.slice(0, 4)), { c: -1 })
assert.deepEqual(dec('30ffffffffffffffffff01'), { f: 18446744073709551615n })
assert.deepEqual(dec('28feffffffffffffffff01'), { e: -2 })
assert.deepEqual(dec('59ffffffffffffffff'), { k: -1 })
assert.deepEqual(dec('6001'), { l: -1 })
// varint non-packed untuk field packed tetap diterima, dan sebaliknya
assert.deepEqual(dec('2003' + '2004'.replace('20', '20')), { d: [3, 4] })
// angka aman tetap number, di luar itu bigint
assert.deepEqual(dec('30' + '80808080808080808001'), { f: 9223372036854775808n })
assert.deepEqual(decodeMessage(wire, 'T', encodeMessage(wire, 'T', { e: 2 ** 40 })), { e: 2 ** 40 })
assert.deepEqual(decodeMessage(wire, 'T', encodeMessage(wire, 'T', { e: '9007199254740993' })), { e: 9007199254740993n })
assert.deepEqual(decodeMessage(wire, 'T', encodeMessage(wire, 'T', { e: { low: -1, high: -1, unsigned: false } })), { e: -1 })
ok('wire vectors')

// ---------- round trip + aturan ----------
const sample = {
  a: 5, s: 'héllo ✓', packed: [1, 2, 3], loose: [4, 5], z: -77, big: -5, ubig: 2n ** 63n, flag: false, d: Math.PI, raw: Buffer.from('xyz'),
  kind: 2, inner: { name: 'in' }, inners: [{ name: 'a' }, {}], counts: { x: 1, y: -2 }, byId: { 7: { name: 'seven' } }, f32: 4000000000, sf64: -9, fl: 0.5, two: 9, must: 'm',
}
const back = decodeMessage<typeof sample>(custom, 't.A', encodeMessage(custom, 't.A', sample))
assert.deepEqual({ ...back, raw: Buffer.from(back.raw) }, sample)
assert.ok(Buffer.isBuffer(back.raw) && back.raw instanceof Uint8Array)
assert.equal(decodeMessage(custom, 't.A', encodeMessage(custom, 't.A', { ...sample, kind: 'FIRST' })).kind, 1)
assert.throws(() => encodeMessage(custom, 't.A', { ...sample, kind: 'NOPE' }), /unknown enum name/)
assert.throws(() => encodeMessage(custom, 't.A', { ...sample, nope: 1 }), /unknown field/)
assert.deepEqual(decodeMessage(custom, 't.A', encodeMessage(custom, 't.A', { ...sample, nope: 1 }, { unknownFields: 'ignore' })).must, 'm')
assert.throws(() => encodeMessage(custom, 't.A', { ...sample, one: 'a', two: 2 }), /oneof "pick" already set/)
assert.doesNotThrow(() => encodeMessage(custom, 't.A', { ...sample, one: 'a', two: 2 }, { strictOneof: false }))
assert.throws(() => encodeMessage(custom, 't.A', { s: 'x' }), /required field is missing/)
assert.throws(() => encodeMessage(custom, 't.A', { ...sample, a: 2 ** 31 }), /out of range/)
assert.throws(() => encodeMessage(custom, 't.A', { ...sample, a: 1.5 }), /out of range/)
assert.throws(() => encodeMessage(custom, 't.A', { ...sample, s: 5 }), /expected a string/)
assert.throws(() => encodeMessage(custom, 't.A', { ...sample, raw: 'str' }), /expected a Uint8Array/)
assert.throws(() => encodeMessage(custom, 't.A', { ...sample, packed: 5 }), /expected an array/)
assert.throws(() => encodeMessage(custom, 't.A', { ...sample, ubig: -1n }), /out of range/)
assert.throws(() => encodeMessage(custom, 't.A', { ...sample, flag: 1 }), /expected a boolean/)
assert.throws(() => encodeMessage(custom, 't.A', { ...sample, inner: 'x' }), /expected an object/)
// oneof: anggota terakhir di wire menang
const two = encodeMessage(custom, 't.A', { must: 'm', two: 5 })
const both = Buffer.concat([Buffer.from([0xa2, 0x01, 0x01, 0x61]), two]) // one='a' lalu two=5
assert.deepEqual(decodeMessage(custom, 't.A', both), { must: 'm', two: 5 })
// field tak dikenal dilewati; wire type salah ditolak
assert.deepEqual(decodeMessage(custom, 't.A', Buffer.concat([Buffer.from([0xf8, 0x06, 0x01]), two])), { must: 'm', two: 5 })
assert.throws(() => decodeMessage(custom, 't.A', Buffer.from([0x0a, 0x01, 0x61])), /unexpected wire type/)
ok('round trip + rules')

// ---------- data rusak ----------
const good = encodeMessage(registry, 'corvus.Message', { extendedTextMessage: { text: 'halo dunia', contextInfo: { stanzaId: 'ID' } } })
for (let cut = 1; cut < good.length; cut++) {
  assert.throws(() => decodeMessage(registry, 'corvus.Message', good.subarray(0, cut)), undefined, `potongan ${cut}`)
}
assert.throws(() => decodeMessage(wire, 'T', fromHex('0880808080808080808080')), /too long/)
assert.throws(() => decodeMessage(wire, 'T', fromHex('0a'.repeat(1))), undefined)
// rekursi terlalu dalam (Message -> viewOnceMessage -> FutureProofMessage -> Message ...)
function encodeVarint(n: number): number[] { const out: number[] = []; while (n > 0x7f) { out.push((n & 0x7f) | 0x80); n = Math.floor(n / 128) } out.push(n); return out }
function nest(levels: number): Buffer {
  let m = Buffer.from([0x0a, 0x01, 0x78]) // conversation: "x"
  for (let i = 0; i < levels; i++) {
    const future = Buffer.concat([Buffer.from([0x0a, ...encodeVarint(m.length)]), m])
    m = Buffer.concat([Buffer.from([0xaa, 0x02, ...encodeVarint(future.length)]), future])
  }
  return m
}
assert.doesNotThrow(() => decodeMessage(registry, 'corvus.Message', nest(20)))
assert.throws(() => decodeMessage(registry, 'corvus.Message', nest(60)), /nesting is too deep/)
let deepValue: Record<string, unknown> = { conversation: 'x' }
for (let i = 0; i < 60; i++) deepValue = { viewOnceMessage: { message: deepValue } }
assert.throws(() => encodeMessage(registry, 'corvus.Message', deepValue), /nesting is too deep/)
// fuzz ringan: tidak boleh hang / melempar selain ProtocolError
for (let i = 0; i < 400; i++) {
  const junk = Buffer.from(Array.from({ length: 1 + (i % 40) }, (_, k) => (i * 31 + k * 17 + (k % 3) * 101) & 0xff))
  try { decodeMessage(registry, 'corvus.Message', junk) } catch (e) { assert.equal((e as Error).name, 'ProtocolError') }
}
ok('corrupt input')

// ---------- JSON ----------
const json = serialize(custom, 't.A', sample)
const parsed = JSON.parse(json)
assert.equal(parsed.ubig, '9223372036854775808'); assert.equal(parsed.kind, 'SECOND'); assert.equal(parsed.raw, Buffer.from('xyz').toString('base64'))
assert.deepEqual(parsed.byId, { 7: { name: 'seven' } })
const rt = deserialize<typeof sample>(custom, 't.A', json)
assert.deepEqual({ ...rt, raw: Buffer.from(rt.raw) }, sample)
assert.throws(() => deserialize(custom, 't.A', '{not json'), /Invalid JSON/)
assert.throws(() => deserialize(custom, 't.A', '{"kind":"WHAT"}'), /unknown enum name/)
ok('json')

// ---------- kompatibel dengan proto-lite (handshake + Signal) ----------
const eph = Buffer.alloc(32, 1)
const hello = new ProtoWriter().bytes(1, eph).toBuffer()
assert.equal(hex(new ProtoWriter().bytes(2, hello).toBuffer()), hex(encode('HandshakeMessage', { clientHello: { ephemeral: eph } })))
assert.equal(hex(new ProtoWriter().bytes(4, new ProtoWriter().bytes(1, Buffer.from('st')).bytes(2, Buffer.from('pl')).toBuffer()).toBuffer()),
  hex(encode('HandshakeMessage', { clientFinish: { static: Buffer.from('st'), payload: Buffer.from('pl') } })))
const sh = readProto(new ProtoWriter().bytes(3, new ProtoWriter().bytes(1, eph).bytes(2, Buffer.from('s')).bytes(3, Buffer.from('p')).toBuffer()).toBuffer())
const shDecoded = decode('HandshakeMessage', Buffer.from(new ProtoWriter().bytes(3, protoBytes(sh, 3)!).toBuffer()))
assert.deepEqual(shDecoded.serverHello, { ephemeral: eph, static: Buffer.from('s'), payload: Buffer.from('p') })
const sig = new ProtoWriter().bytes(1, Buffer.alloc(33, 5)).uint(2, 300).uint(3, 7).bytes(4, Buffer.from('cipher')).toBuffer()
assert.equal(hex(sig), hex(encode('SignalMessage', { ratchetKey: Buffer.alloc(33, 5), counter: 300, previousCounter: 7, ciphertext: Buffer.from('cipher') })))
const pk = new ProtoWriter().uint(1, 12).bytes(2, Buffer.alloc(33, 2)).bytes(3, Buffer.alloc(33, 3)).bytes(4, sig).uint(5, 4242).uint(6, 99).toBuffer()
assert.equal(hex(pk), hex(encode('PreKeySignalMessage', { preKeyId: 12, baseKey: Buffer.alloc(33, 2), identityKey: Buffer.alloc(33, 3), message: sig, registrationId: 4242, signedPreKeyId: 99 })))
const pkr = decode('PreKeySignalMessage', pk); const pkf = readProto(pk)
assert.deepEqual([pkr.preKeyId, pkr.registrationId, pkr.signedPreKeyId], [protoUint(pkf, 1), protoUint(pkf, 5), protoUint(pkf, 6)])
const sk = new ProtoWriter().uint(1, 3).uint(2, 10).bytes(3, Buffer.alloc(32, 8)).bytes(4, Buffer.alloc(33, 9)).toBuffer()
assert.equal(hex(sk), hex(encode('SignalSenderKeyDistributionMessage', { id: 3, iteration: 10, chainKey: Buffer.alloc(32, 8), signingKey: Buffer.alloc(33, 9) })))
assert.equal(hex(new ProtoWriter().uint(1, 3).uint(2, 4).bytes(3, Buffer.from('c')).toBuffer()), hex(encode('SenderKeyMessage', { id: 3, iteration: 4, ciphertext: Buffer.from('c') })))
ok('compatible with proto-lite')

// ---------- skema bawaan ----------
assert.equal(registry.files().length, 11)
assert.ok(registry.messageNames().length > 100)
assert.equal(proto.MessageKey.fullName, 'corvus.MessageKey')
const key = { remoteJid: '1@s.whatsapp.net', fromMe: true, id: 'ABC' }
assert.deepEqual(proto.MessageKey.decode(proto.MessageKey.encode(key)), key)
assert.equal(hex(proto.MessageKey.encode(key)), '0a1031' + Buffer.from('@s.whatsapp.net').toString('hex') + '1001' + '1a03414243')
assert.equal(hex(encode('Message', { conversation: 'hi' })), '0a026869')
// ClientPayload bertingkat (UserAgent -> AppVersion, enum nama)
const payload = {
  username: 628123456789n, passive: false, pull: true, device: 3,
  userAgent: { platform: 'WEB', appVersion: { primary: 2, secondary: 3000, tertiary: 1023223821 }, releaseChannel: 'RELEASE', osVersion: '0.1' },
  webInfo: { webSubPlatform: 'WEB_BROWSER' }, connectType: 'WIFI_UNKNOWN', connectReason: 'USER_ACTIVATED',
} as const
const payloadBytes = encode('ClientPayload', payload as never)
const payloadBack = decode('ClientPayload', payloadBytes)
assert.equal(payloadBack.username, 628123456789); assert.equal(payloadBack.userAgent!.platform, 14); assert.equal(payloadBack.userAgent!.appVersion!.tertiary, 1023223821)
assert.equal(payloadBack.connectType, 1); assert.equal(payloadBack.webInfo!.webSubPlatform, 0)
// ADV + sertifikat
const adv = { details: Buffer.from('d'), hmac: Buffer.from('h'), accountType: 1 }
assert.deepEqual(decode('ADVSignedDeviceIdentityHMAC', encode('ADVSignedDeviceIdentityHMAC', adv)), adv)
const chain = { leaf: { details: Buffer.from('l'), signature: Buffer.from('s') }, intermediate: { details: Buffer.from('i') } }
assert.deepEqual(decode('CertChain', encode('CertChain', chain)), chain)
assert.deepEqual(decode('CertChain_NoiseCertificate_Details', encode('CertChain_NoiseCertificate_Details', { serial: 1, notAfter: 2 ** 40 })), { serial: 1, notAfter: 2 ** 40 })
// riwayat + app state
const hist = { syncType: 3, chunkOrder: 2, progress: 50, pushnames: [{ id: '1@s.whatsapp.net', pushname: 'Ann' }],
  conversations: [{ id: '1@g.us', messages: [{ message: { key, message: { conversation: 'x' }, messageTimestamp: 1700000000, status: 4 }, msgOrderId: 1 }], participant: [{ userJid: 'a', rank: 2 }], archived: true }] }
assert.deepEqual(decode('HistorySync', encode('HistorySync', hist)), hist)
const patch = { version: { version: 5 }, mutations: [{ operation: 1, record: { index: { blob: Buffer.from('i') }, value: { blob: Buffer.from('v') }, keyId: { id: Buffer.from('k') } } }], patchMac: Buffer.from('m') }
assert.deepEqual(decode('SyncdPatch', encode('SyncdPatch', patch)), patch)
const hsn = { fileLength: 2n ** 40n, directPath: '/x', syncType: 3, oldestMsgInChunkTimestampSec: 1700000000 }
assert.deepEqual(decode('HistorySyncNotification', encode('HistorySyncNotification', hsn)), { ...hsn, fileLength: 2 ** 40 })
ok('bundled schemas')

// ---------- konten pesan buatan library ----------
const wa = createProtoMessageCodec()
const quoted = { key: { remoteJid: '62@s.whatsapp.net', fromMe: false, id: 'Q1' }, message: { conversation: 'asli' } }
const samples: Record<string, Record<string, unknown>> = {
  text: { conversation: 'halo' },
  ext: M.withQuote({ extendedTextMessage: { text: 'balas', contextInfo: { mentionedJid: ['1@s.whatsapp.net'], expiration: 86400, forwardingScore: 2, isForwarded: true } } }, quoted as never),
  buttons: M.buildButtonsMessage({ text: 'pilih', footer: 'f', header: 'h', buttons: [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }] }),
  list: M.buildListMessage({ title: 't', text: 'x', buttonText: 'lihat', footer: 'f', sections: [{ title: 's', rows: [{ id: 'r1', title: 'R1', description: 'd' }, { id: 'r2', title: 'R2' }] }] }),
  template: M.buildTemplateMessage({ text: 'isi', footer: 'ft', title: 'jd', templateId: 'tpl', buttons: [{ type: 'reply', text: 'ya', id: 'y' }, { type: 'url', text: 'web', url: 'https://example.com' }, { type: 'call', text: 'telp', phoneNumber: '+628123456789' }] }),
  interactive: M.buildInteractiveMessage({ body: 'b', footer: 'f', header: { title: 'h', subtitle: 's' }, buttons: [{ type: 'reply', text: 'A', id: 'a' }, { type: 'url', text: 'U', url: 'https://example.com' }, { type: 'copy', text: 'C', code: '123' }, { type: 'call', text: 'T', phoneNumber: '+628123456789' }, { type: 'select', title: 'S', sections: [{ title: 'x', rows: [{ id: '1', title: 'one' }] }] }] }),
  carousel: M.buildCarouselMessage({ body: 'b', cards: [{ body: 'c1', buttons: [{ type: 'reply', text: 'A', id: 'a' }] }, { body: 'c2', header: { title: 't' }, buttons: [{ type: 'url', text: 'U', url: 'https://example.com' }] }] }),
  react: M.buildReactionMessage({ remoteJid: '1@s.whatsapp.net', fromMe: true, id: 'R' }, '👍', 1700000000123),
  edit: M.buildEditMessage({ remoteJid: '1@s.whatsapp.net', fromMe: true, id: 'E' }, { conversation: 'baru' }, 1700000000456),
  revoke: M.buildDeleteMessage({ remoteJid: '1@s.whatsapp.net', fromMe: true, id: 'D' }),
  location: { locationMessage: { degreesLatitude: -6.2, degreesLongitude: 106.8, name: 'Jakarta', address: 'x' } },
  contacts: { contactsArrayMessage: { displayName: 'dua', contacts: [{ displayName: 'a', vcard: 'BEGIN:VCARD\nEND:VCARD' }] } },
  image: { imageMessage: { url: 'https://mmg.whatsapp.net/x', mimetype: 'image/jpeg', fileSha256: Buffer.alloc(32, 1), fileLength: 12345, height: 10, width: 20, mediaKey: Buffer.alloc(32, 2), fileEncSha256: Buffer.alloc(32, 3), directPath: '/v/x', mediaKeyTimestamp: 1700000000, jpegThumbnail: Buffer.from('t'), caption: 'c', viewOnce: true } },
  video: { videoMessage: { url: 'u', mimetype: 'video/mp4', seconds: 9, gifPlayback: true, gifAttribution: 2, fileLength: 2 ** 33 } },
  audio: { audioMessage: { url: 'u', mimetype: 'audio/ogg; codecs=opus', ptt: true, seconds: 3, waveform: Buffer.from([1, 2, 3]) } },
  document: { documentMessage: { url: 'u', mimetype: 'application/pdf', fileName: 'a.pdf', title: 'a', pageCount: 3, caption: 'c' } },
  sticker: { stickerMessage: { url: 'u', mimetype: 'image/webp', isAnimated: true, pngThumbnail: Buffer.from('p') } },
  poll: { pollCreationMessage: { name: 'q?', options: [{ optionName: 'a' }, { optionName: 'b' }], selectableOptionsCount: 1 } },
  responses: { buttonsResponseMessage: { selectedButtonId: 'a', selectedDisplayText: 'A', type: 1 } },
  history: { protocolMessage: { type: 5, historySyncNotification: { directPath: '/h', syncType: 3, fileLength: 99 } }, senderKeyDistributionMessage: { groupId: 'g@g.us', axolotlSenderKeyDistributionMessage: Buffer.from('k') } },
}
for (const [name, content] of Object.entries(samples)) {
  const bytes = wa.encode(content)
  const normalized = JSON.parse(JSON.stringify(content, (_k, v) => (v instanceof Uint8Array ? { $b: Buffer.from(v).toString('hex') } : v)))
  const decoded = JSON.parse(JSON.stringify(wa.decode(bytes), (_k, v) => (v instanceof Uint8Array ? { $b: Buffer.from(v).toString('hex') } : v)))
  assert.deepEqual(decoded, normalized, `konten "${name}" tidak sama setelah round trip`)
  assert.deepEqual(validateProto('Message', content), [], `konten "${name}" ditolak validator`)
}
assert.throws(() => wa.encode({ conversationn: 'typo' }), /unknown field/)
ok('library message content')

// ---------- wrapper src/protocol ----------
assert.equal(protoRegistry, registry)
assert.deepEqual(decodeProto('MessageKey', encodeProto('MessageKey', key)), key)
assert.equal(tryDecodeProto('MessageKey', Buffer.from([0x0a, 0x09, 1])), undefined)
assert.deepEqual(validateProto('MessageKey', { remoteJid: 5, fromMe: 'x', nope: 1 }).map((i) => i.path).sort(), ['MessageKey.fromMe', 'MessageKey.nope', 'MessageKey.remoteJid'])
assert.deepEqual(validateProto('ExtendedTextMessage', { text: 'x', contextInfo: { mentionedJid: ['a', 3] } }).map((i) => i.path), ['ExtendedTextMessage.contextInfo.mentionedJid[1]'])
assert.deepEqual(validateProto('ButtonsMessage', { text: 'a', imageMessage: {} }).map((i) => i.code), ['oneof'])
assert.throws(() => assertValidProto('MessageKey', { id: 1 }), /MessageKey\.id/)
const extra = registerProtoSchema('syntax = "proto2"; package corvus; message Extra { optional string note = 1; }', 'extra.proto')
assert.equal(extra.messages[0]!.fullName, 'corvus.Extra')
assert.deepEqual(decodeProto('corvus.Extra' as never, encodeProto('corvus.Extra' as never, { note: 'n' } as never)), { note: 'n' })
registry.add({ ...extra, messages: [], enums: [] }) // ganti dengan versi kosong supaya registry bawaan bersih untuk test lain
const fresh = createRegistry(); assert.equal(fresh.hasMessage('corvus.Message'), true); assert.equal(fresh.hasMessage('corvus.Extra'), false)
ok('wrappers')

console.log('ALL OK'); setTimeout(() => process.exit(0), 20)
