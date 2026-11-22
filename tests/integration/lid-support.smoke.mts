import assert from 'node:assert/strict'
import { createMemoryAuthState } from '../../src/index.ts'
import { LidMappingStore } from '../../src/signal/lid-mapping.ts'
import { TcTokenStore, isTcTokenExpired, shouldSendNewTcToken } from '../../src/signal/tc-token.ts'
import { parseMessageNode } from '../../src/messages/message-parser.ts'
import { relayMessage } from '../../src/messages/relay-message.ts'
import type { BinaryNode } from '../../src/protocol/protocol-types.ts'
const ok = (n: string) => console.log(n, 'ok')
const keys = () => createMemoryAuthState().state.keys

// 1. pemetaan PN <-> LID
{
  const k = keys()
  const m = new LidMappingStore({ keys: k })
  await m.store([{ lid: '555@lid', pn: '6281234567890@s.whatsapp.net' }])
  await m.store([{ pn: '6289999@s.whatsapp.net', lid: '777@lid' }]) // urutan terbalik pun diterima
  assert.equal(await m.getLid('6281234567890:3@s.whatsapp.net'), '555:3@lid') // device dipertahankan
  assert.equal(await m.getPn('555:3@lid'), '6281234567890:3@s.whatsapp.net')
  assert.equal(await m.resolveSignalJid('6281234567890:2@s.whatsapp.net'), '555:2@lid')
  assert.equal(await m.resolveSignalJid('111:1@s.whatsapp.net'), '111:1@s.whatsapp.net') // belum dipetakan → apa adanya
  const again = new LidMappingStore({ keys: k }) // dibaca dari penyimpanan
  assert.equal(await again.getLid('6289999@s.whatsapp.net'), '777@lid')
  const fetching = new LidMappingStore({ keys: keys(), fetchLids: async (pns) => pns.map((pn) => ({ pn, lid: '888@lid' })) })
  assert.equal(await fetching.getLid('6285@s.whatsapp.net'), undefined)
  assert.equal(await fetching.getLid('6285@s.whatsapp.net', { fetch: true }), '888@lid')
  ok('1. pemetaan PN <-> LID')
}

// 2. parser: pesan LID dari perangkat sendiri + pasangan alamat
{
  const node: BinaryNode = { tag: 'message', attrs: { id: 'A1', from: '1234@lid', recipient: '1234@lid', participant_pn: '6281997715124@s.whatsapp.net', t: '1700000000', type: 'text' },
    content: [{ tag: 'enc', attrs: { v: '2', type: 'msg' }, content: Buffer.from([1]) }] }
  const p = parseMessageNode(node, '6281997715124:7@s.whatsapp.net', '1234:7@lid')
  assert.equal(p.isFromMe, true); assert.equal(p.senderAlt, '6281997715124@s.whatsapp.net')
  assert.equal(parseMessageNode(node, '6281997715124:7@s.whatsapp.net').isFromMe, false) // tanpa LID sendiri → tak dikenali
  const pn: BinaryNode = { tag: 'message', attrs: { id: 'A2', from: '6280000@s.whatsapp.net', sender_lid: '4321@lid', t: '1' }, content: [] }
  assert.equal(parseMessageNode(pn).senderAlt, '4321@lid')
  ok('2. parser mengenali LID sendiri + alamat pasangan')
}

// 3. relay chat LID (self-chat): perangkat pengirim dilewati, DSM untuk HP, tctoken, sesi lewat alamat LID
{
  const sent: BinaryNode[] = []; const injected: string[] = []; const encrypted: string[] = []; const fetched: string[][] = []; const direct: string[] = []
  const contents = new Map<string, unknown>()
  const deps: any = {
    crypto: { sessions: {
      hasSession: async () => false,
      injectBundle: async (addr: string) => { injected.push(addr) },
      encrypt: async (addr: string) => { encrypted.push(addr); return { type: 'pkmsg', ciphertext: Buffer.from('c') } },
    }, senderKeys: {} },
    keys: {}, engine: { sendNode: async (n: BinaryNode) => { sent.push(n) }, query: async () => ({}) },
    codec: { encode: (c: unknown) => { const b = Buffer.from(JSON.stringify(c)); contents.set(b.toString(), c); return b }, decode: () => ({}) },
    ownJid: '6281997715124:7@s.whatsapp.net', ownLid: '1234:7@lid',
    resolveDevices: async () => ['1234:7@lid', '1234:0@lid', '1234:3@lid', '555:0@lid'],
    resolveSignalJid: async (j: string) => (j === '555:0@lid' ? '555:0@lid' : j),
    fetchBundles: async (js: string[]) => { fetched.push(js); return Object.fromEntries(js.map((j) => [j, { registrationId: 1, identityKey: new Uint8Array(32), signedPreKey: { keyId: 1, publicKey: new Uint8Array(32), signature: new Uint8Array(64) } }])) },
    encodeDeviceIdentity: () => Buffer.from('devid'),
    getTcToken: async () => Buffer.from('tok'), onDirectSent: (j: string) => direct.push(j),
  }
  const r = await relayMessage(deps, '1234@lid', { conversation: 'hai' })
  assert.deepEqual(r.recipients.sort(), ['1234:0@lid', '1234:3@lid', '555:0@lid'].sort()) // 1234:7 (pengirim) tidak ikut
  assert.ok(!r.recipients.includes('1234:7@lid'))
  const toOwn = (sent[0]!.content as BinaryNode[]).find((c) => c.tag === 'participants')!.content as BinaryNode[]
  assert.equal(toOwn.length, 3)
  assert.ok(Object.keys(Object.fromEntries(contents)).some((k) => k.includes('deviceSentMessage'))) // HP sendiri menerima DSM
  const tags = (sent[0]!.content as BinaryNode[]).map((c) => c.tag); assert.deepEqual(tags, ['participants', 'device-identity', 'tctoken'])
  assert.deepEqual(direct, ['1234@lid']); assert.ok(fetched[0]!.every((j) => j.endsWith('@lid')))
  assert.ok(encrypted.every((a) => /_1\.\d+$/.test(a))) // alamat sesi LID: user_1.device
  ok('3. relay chat LID: pengirim dilewati, DSM, tctoken, alamat LID')
}

// 4. relay PN yang sudah dipetakan: sesi & pre-key lewat LID, <to> tetap PN
{
  const sent: BinaryNode[] = []; const fetched: string[][] = []; const encrypted: string[] = []
  const m = new LidMappingStore({ keys: keys() }); await m.store([{ lid: '555@lid', pn: '6281234567890@s.whatsapp.net' }])
  const deps: any = {
    crypto: { sessions: { hasSession: async () => false, injectBundle: async () => {}, encrypt: async (a: string) => { encrypted.push(a); return { type: 'msg', ciphertext: Buffer.from('c') } } }, senderKeys: {} },
    keys: {}, engine: { sendNode: async (n: BinaryNode) => { sent.push(n) }, query: async () => ({}) },
    codec: { encode: () => Buffer.from('x'), decode: () => ({}) }, ownJid: '6281997715124:7@s.whatsapp.net',
    resolveDevices: async () => ['6281234567890:0@s.whatsapp.net'], resolveSignalJid: (j: string) => m.resolveSignalJid(j),
    fetchBundles: async (js: string[]) => { fetched.push(js); return Object.fromEntries(js.map((j) => [j, { registrationId: 1, identityKey: new Uint8Array(32), signedPreKey: { keyId: 1, publicKey: new Uint8Array(32), signature: new Uint8Array(64) } }])) },
  }
  await relayMessage(deps, '6281234567890@s.whatsapp.net', { conversation: 'hi' })
  assert.deepEqual(fetched, [['555@lid']]); assert.deepEqual(encrypted, ['555_1.0'])
  const to = ((sent[0]!.content as BinaryNode[])[0]!.content as BinaryNode[])[0]!
  assert.equal(to.attrs.jid, '6281234567890:0@s.whatsapp.net')
  ok('4. PN terpetakan: sesi/pre-key via LID, <to> tetap PN')
}

// 5. token privasi
{
  const k = keys(); const queries: BinaryNode[] = []
  const nowSec = Math.floor(Date.now() / 1000)
  const t = new TcTokenStore({ keys: k, query: async (n) => { queries.push(n); return { tag: 'iq', attrs: { type: 'result' }, content: [{ tag: 'tokens', attrs: {}, content: [{ tag: 'token', attrs: { jid: 'x', t: String(nowSec), type: 'trusted_contact' }, content: Buffer.from('issued') }] }] } } })
  assert.equal(await t.get('6281@s.whatsapp.net'), undefined)
  await t.storeFromTokens({ tag: 'notification', attrs: {}, content: [{ tag: 'tokens', attrs: {}, content: [{ tag: 'token', attrs: { t: String(nowSec), type: 'trusted_contact' }, content: Buffer.from('abc') }] }] }, '6281@s.whatsapp.net')
  assert.equal(Buffer.from((await t.get('6281:5@s.whatsapp.net'))!).toString(), 'abc')
  await t.issueIfNeeded('6282@s.whatsapp.net') // belum pernah → terbitkan
  assert.equal(queries.length, 1); assert.equal(queries[0]!.attrs.xmlns, 'privacy')
  assert.equal(Buffer.from((await t.get('6282@s.whatsapp.net'))!).toString(), 'issued')
  await t.issueIfNeeded('6282@s.whatsapp.net'); assert.equal(queries.length, 1) // satu kali per bucket
  assert.equal(isTcTokenExpired(String(nowSec)), false); assert.equal(isTcTokenExpired(String(nowSec - 40 * 86400)), true)
  assert.equal(shouldSendNewTcToken(undefined), true); assert.equal(shouldSendNewTcToken(nowSec), false)
  ok('5. tctoken: simpan, ambil, terbitkan sekali per bucket')
}
console.log('ALL OK')
