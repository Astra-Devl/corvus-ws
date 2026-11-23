import assert from 'node:assert/strict'
import { ButtonBuilder } from '../../src/index.ts'
import { getBizNodes, getButtonNodes, getMediaType } from '../../src/messages/relay-message.ts'
import { MessageSender } from '../../src/messages/send-message.ts'
import { generateMessageContent } from '../../src/messages/generate-message.ts'
import type { BinaryNode } from '../../src/protocol/protocol-types.ts'
const ok = (n: string) => console.log(n, 'ok')
const DM = '6281234567890@s.whatsapp.net'
const native = { tag: 'biz', attrs: {}, content: [{ tag: 'interactive', attrs: { type: 'native_flow', v: '1' }, content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }] }] }

// 1. node <biz> per jenis pesan
const interactive = generateMessageContent({ interactive: new ButtonBuilder().body('Pilih').reply('Mulai', 'start').url('Web', 'https://x.y').build() })
assert.deepEqual(getBizNodes(interactive), [native])
assert.deepEqual(getBizNodes(generateMessageContent({ buttons: { text: 'Pilih', buttons: [{ id: '1', text: 'Satu' }] } })), [native])
assert.deepEqual(getBizNodes(generateMessageContent({ list: { title: 'T', text: 'x', buttonText: 'Buka', sections: [{ title: 'S', rows: [{ id: 'r1', title: 'R1' }] }] } })),
  [{ tag: 'biz', attrs: {}, content: [{ tag: 'list', attrs: { v: '2', type: 'product_list' } }] }])
assert.deepEqual(getBizNodes({ conversation: 'teks biasa' }), [])
assert.deepEqual(getBizNodes({ interactiveMessage: { nativeFlowMessage: { buttons: [{ name: 'review_and_pay', buttonParamsJson: '{}' }] } } } as never),
  [{ tag: 'biz', attrs: { native_flow_name: 'order_details' } }])
assert.deepEqual(getBizNodes({ interactiveMessage: { nativeFlowMessage: { buttons: [{ name: 'send_location', buttonParamsJson: '{}' }] } } } as never)[0]!.content,
  [{ tag: 'interactive', attrs: { type: 'native_flow', v: '1' }, content: [{ tag: 'native_flow', attrs: { v: '2', name: 'send_location' } }] }])
ok('1. node <biz> sesuai jenis pesan')

// 2. <bot biz_bot="1"/> opsional dan hanya untuk chat 1:1
assert.deepEqual(getButtonNodes(interactive, DM).map((n) => n.tag), ['biz'])
assert.deepEqual(getButtonNodes(interactive, DM, { bizBot: true }).map((n) => n.tag), ['biz', 'bot'])
assert.deepEqual(getButtonNodes(interactive, '120363000000@g.us', { bizBot: true }).map((n) => n.tag), ['biz'])
assert.deepEqual(getButtonNodes({ conversation: 'x' }, DM, { bizBot: true }), [])
ok('2. node bot opsional, hanya chat 1:1')

// 3. mediatype enc untuk list/respons seperti Baileys
assert.equal(getMediaType({ listMessage: {} } as never), 'list'); assert.equal(getMediaType({ listResponseMessage: {} } as never), 'list_response')
assert.equal(getMediaType({ buttonsResponseMessage: {} } as never), 'buttons_response'); assert.equal(getMediaType({ interactiveResponseMessage: {} } as never), 'native_flow_response')
ok('3. mediatype list/respons')

// 4. MessageSender menyertakan <biz>/<bot> otomatis; bisa dimatikan dan tidak digandakan
const sent: BinaryNode[] = []
const deps: any = {
  crypto: { sessions: { hasSession: async () => true, encrypt: async () => ({ type: 'msg', ciphertext: Buffer.from('c') }) }, senderKeys: {} },
  keys: {}, engine: { sendNode: async (n: BinaryNode) => { sent.push(n) }, query: async () => ({}) },
  codec: { encode: () => Buffer.from('x'), decode: () => ({}) }, ownJid: '6281997715124:7@s.whatsapp.net',
  resolveDevices: async () => [`${DM.split('@')[0]}:0@s.whatsapp.net`],
}
const sender = new MessageSender({ deps, emitOwnEvents: false })
const childTags = () => (sent.at(-1)!.content as BinaryNode[]).map((c) => c.tag)
await sender.send(DM, { interactive: new ButtonBuilder().body('x').reply('a', 'a').build() })
assert.deepEqual(childTags(), ['participants', 'biz'])
await sender.send(DM, { interactive: new ButtonBuilder().body('x').reply('a', 'a').build() }, { bizBot: true })
assert.deepEqual(childTags(), ['participants', 'biz', 'bot'])
await sender.send(DM, { interactive: new ButtonBuilder().body('x').reply('a', 'a').build() }, { bizNodes: false })
assert.deepEqual(childTags(), ['participants'])
await sender.send(DM, { interactive: new ButtonBuilder().body('x').reply('a', 'a').build() }, { additionalNodes: [{ tag: 'biz', attrs: { custom: '1' } }] })
assert.deepEqual(childTags(), ['participants', 'biz']); assert.equal((sent.at(-1)!.content as BinaryNode[]).find((c) => c.tag === 'biz')!.attrs.custom, '1')
await sender.send(DM, { text: 'biasa' }); assert.deepEqual(childTags(), ['participants'])
// type/mediatype: dengan <biz> → type=text tanpa mediatype (479 bila tidak); tanpa <biz> → perilaku Baileys
const stanza = () => sent.at(-1)!
const encAttrs = () => ((stanza().content as BinaryNode[])[0]!.content as BinaryNode[]).map((to) => ((to.content as BinaryNode[])[0]!.attrs))
await sender.send(DM, { list: { title: 'T', text: 'x', buttonText: 'Buka', sections: [{ title: 'S', rows: [{ id: 'r1', title: 'R1' }] }] } })
assert.equal(stanza().attrs.type, 'text'); assert.ok(encAttrs().every((a) => a.mediatype === undefined))
await sender.send(DM, { list: { title: 'T', text: 'x', buttonText: 'Buka', sections: [{ title: 'S', rows: [{ id: 'r1', title: 'R1' }] }] } }, { bizNodes: false })
assert.equal(encAttrs()[0]!.mediatype, 'list')
ok('4. biz otomatis, bisa dimatikan, type/mediatype benar')
// 5. list ke grup: type=media + mediatype=list hanya pada <enc> skmsg; button biasa ke grup: type=text
{
  const sentG: BinaryNode[] = []
  const gdeps: any = {
    crypto: { sessions: { hasSession: async () => true, encrypt: async () => ({ type: 'msg', ciphertext: Buffer.from('c') }) },
      senderKeys: { createDistributionMessage: async () => Buffer.from('d'), encrypt: async () => Buffer.from('sk') } },
    keys: { get: async () => ({}), set: async () => {} }, engine: { sendNode: async (n: BinaryNode) => { sentG.push(n) }, query: async () => ({}) },
    codec: { encode: () => Buffer.from('x'), decode: () => ({}) }, ownJid: '6281997715124:7@s.whatsapp.net',
    resolveDevices: async () => ['6281234567890:0@s.whatsapp.net'], getGroupParticipants: async () => ['6281234567890@s.whatsapp.net'],
  }
  const gs = new MessageSender({ deps: gdeps, emitOwnEvents: false })
  const GROUP = '120363000000000000@g.us'
  await gs.send(GROUP, { list: { title: 'T', text: 'x', buttonText: 'Buka', sections: [{ title: 'S', rows: [{ id: 'r1', title: 'R1' }] }] } })
  const enc = (sentG.at(-1)!.content as BinaryNode[]).find((c) => c.tag === 'enc')!
  assert.equal(sentG.at(-1)!.attrs.type, 'media'); assert.equal(enc.attrs.mediatype, 'list')
  const skdm = ((sentG.at(-1)!.content as BinaryNode[])[0]!.content as BinaryNode[]).map((to) => (to.content as BinaryNode[])[0]!.attrs)
  assert.ok(skdm.every((a) => a.mediatype === undefined)) // SKDM tanpa mediatype
  await gs.send(GROUP, { interactive: new ButtonBuilder().body('x').reply('a', 'a').build() })
  assert.equal(sentG.at(-1)!.attrs.type, 'text'); assert.equal(((sentG.at(-1)!.content as BinaryNode[]).find((c) => c.tag === 'enc')!.attrs).mediatype, undefined)
  ok('5. grup: list media/list di skmsg, button text')
}

// 6. builder: interactive langsung (tanpa viewOnce) kecuali wrap: true; header lokasi pada buttonsMessage
{
  const direct = generateMessageContent({ interactive: new ButtonBuilder().body('x').reply('a', 'a').build() }) as any
  assert.ok(direct.interactiveMessage && !direct.viewOnceMessage)
  const wrapped = generateMessageContent({ interactive: new ButtonBuilder().body('x').reply('a', 'a').wrap(true).build() }) as any
  assert.ok(wrapped.viewOnceMessage?.message?.interactiveMessage && wrapped.viewOnceMessage.message.messageContextInfo)
  const loc = generateMessageContent({ buttons: { text: 'Pilih', locationMessage: { name: 'Bot', address: 'v1' }, buttons: [{ id: '1', text: 'Satu' }] } }) as any
  assert.equal(loc.buttonsMessage.headerType, 6); assert.equal(loc.buttonsMessage.locationMessage.name, 'Bot')
  assert.equal((generateMessageContent({ buttons: { text: 'Pilih', buttons: [{ id: '1', text: 'Satu' }] } }) as any).buttonsMessage.headerType, 1)
  ok('6. interactive langsung (wrap opsional) + header lokasi')
}
console.log('ALL OK')
