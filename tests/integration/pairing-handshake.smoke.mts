import assert from 'node:assert/strict'
import {
  createNodeCodec, TokenDictionary, initAuthCreds, generateKeyPair, sharedKey, hkdf, hmacSha256,
} from '../../src/index.ts'
import {
  buildLoginPayload, buildRegistrationPayload, buildCompanionFinish, configureSuccessfulPairing, companionPlatformId, encodeDeviceIdentityFromCreds,
  WA_ADV_ACCOUNT_SIG_PREFIX, WA_ADV_DEVICE_SIG_PREFIX,
} from '../../src/auth/pairing-handshake.ts'
import { decode, encode } from '../../proto/index.ts'
import { sign, verify } from '../../src/crypto/key-utils.ts'
import { wrapEphemeralPublicKey } from '../../src/pairing/code-pairing.ts'
import { createDecipheriv } from 'node:crypto'
const ok = (n: string) => console.log(n, 'ok')

// 1. kamus token bawaan + byte-identik dengan keluaran Baileys (rc14)
const dict = TokenDictionary.builtin()
assert.equal(dict.single.length, 236); assert.deepEqual(dict.doubles.map((d) => d.length), [256, 256, 256, 256])
const codec = createNodeCodec()
const sample = { tag: 'iq', attrs: { to: 's.whatsapp.net', type: 'get', xmlns: 'w:p', id: 'abc.1-2' }, content: [{ tag: 'ping', attrs: {} }] }
assert.equal(Buffer.from(codec.encode(sample)).toString('hex'), '00f80a1911030429165708fc076162632e312d32f801f80156')
assert.deepEqual(codec.decode(codec.encode(sample)), sample)
ok('1. token dictionary bawaan sama dengan Baileys')

// 2. ClientPayload login & registrasi
const cfg = { version: [2, 3000, 1043857760] as const, browser: ['Ubuntu', 'Chrome', '20.0.04'] as const }
const creds = initAuthCreds()
const login = decode('ClientPayload', buildLoginPayload('6281234567890:5@s.whatsapp.net', cfg))
assert.deepEqual([Number(login.username), login.device, login.passive, login.pull], [6281234567890, 5, true, true])
assert.deepEqual([login.userAgent?.appVersion?.primary, login.userAgent?.appVersion?.tertiary, login.userAgent?.platform], [2, 1043857760, 14])
const reg = decode('ClientPayload', buildRegistrationPayload(creds, cfg))
assert.equal(reg.passive, false); assert.equal(Buffer.from(reg.devicePairingData!.eIdent!).toString('hex'), Buffer.from(creds.signedIdentityKey.public).toString('hex'))
assert.equal(reg.devicePairingData!.eRegid!.length, 4); assert.equal(reg.devicePairingData!.eSkeyId!.length, 3)
assert.equal(decode('DeviceProps', reg.devicePairingData!.deviceProps!).platformType, 1)
ok('2. client payload login + registrasi')

// 3. pair-success: verifikasi ADV, balasan bertanda tangan, tolak HMAC salah
const accountKey = generateKeyPair()
const deviceDetails = Buffer.from(encode('ADVDeviceIdentity', { rawId: 1, timestamp: 1700000000, keyIndex: 3 }))
const accountSignature = sign(accountKey.private, Buffer.concat([WA_ADV_ACCOUNT_SIG_PREFIX, deviceDetails, creds.signedIdentityKey.public]))
const details = Buffer.from(encode('ADVSignedDeviceIdentity', { details: deviceDetails, accountSignatureKey: accountKey.public, accountSignature }))
const box = (hmac: Uint8Array) => Buffer.from(encode('ADVSignedDeviceIdentityHMAC', { details, hmac }))
const stanza = (identity: Buffer) => ({ tag: 'iq', attrs: { id: 'PS1', type: 'set' }, content: [{ tag: 'pair-success', attrs: {}, content: [
  { tag: 'device-identity', attrs: {}, content: identity }, { tag: 'platform', attrs: { name: 'smba' } },
  { tag: 'device', attrs: { jid: '6281234567890:5@s.whatsapp.net', lid: '99887766@lid' } }, { tag: 'biz', attrs: { name: 'AstraBot' } }] }] })
const good = configureSuccessfulPairing(stanza(box(hmacSha256(Buffer.from(creds.advSecretKey, 'base64'), details))), creds)
assert.deepEqual(good.creds.me, { id: '6281234567890:5@s.whatsapp.net', lid: '99887766@lid', name: 'AstraBot' }); assert.equal(good.creds.platform, 'smba')
const rep = (good.reply.content as any)[0].content[0]; assert.equal(rep.attrs['key-index'], '3')
const accOut = decode('ADVSignedDeviceIdentity', rep.content)
assert.ok(verify(creds.signedIdentityKey.public, Buffer.concat([WA_ADV_DEVICE_SIG_PREFIX, deviceDetails, creds.signedIdentityKey.public, accountKey.public]), accOut.deviceSignature!))
assert.throws(() => configureSuccessfulPairing(stanza(box(Buffer.alloc(32))), creds), /HMAC/)
ok('3. pair-success terverifikasi + balasan bertanda tangan')

// 4. pairing code: companion_finish bisa dibuka & advSecretKey sama di kedua sisi
const code = 'ABCD2345'; const primaryEph = generateKeyPair(); const primaryId = generateKeyPair()
const c2 = initAuthCreds(); c2.pairingCode = code; c2.me = { id: '6281234567890@s.whatsapp.net', name: '~' }
const wrapped = await wrapEphemeralPublicKey(primaryEph.public, code)
const notif = { tag: 'notification', attrs: { type: 'link_code_companion_reg' }, content: [{ tag: 'link_code_companion_reg', attrs: {}, content: [
  { tag: 'link_code_pairing_ref', attrs: {}, content: Buffer.from('REF') }, { tag: 'primary_identity_pub', attrs: {}, content: primaryId.public },
  { tag: 'link_code_pairing_wrapped_primary_ephemeral_pub', attrs: {}, content: wrapped }] }] }
const fin = await buildCompanionFinish(notif as any, c2)
const regNode = (fin.node.content as any)[0]; assert.equal(regNode.attrs.stage, 'companion_finish'); assert.equal(regNode.attrs.jid, c2.me.id)
const bundle: Buffer = regNode.content.find((n: any) => n.tag === 'link_code_pairing_wrapped_key_bundle').content
const salt = bundle.subarray(0, 32), iv = bundle.subarray(32, 44), enc = bundle.subarray(44, bundle.length - 16), tag = bundle.subarray(bundle.length - 16)
const companionShared = sharedKey(primaryEph.private, c2.pairingEphemeralKeyPair.public)
const dec = createDecipheriv('aes-256-gcm', hkdf(companionShared, 32, { salt, info: 'link_code_pairing_key_bundle_encryption_key' }), iv); dec.setAuthTag(tag)
const plain = Buffer.concat([dec.update(enc), dec.final()])
assert.equal(plain.subarray(0, 32).toString('hex'), Buffer.from(c2.signedIdentityKey.public).toString('hex')); assert.equal(plain.subarray(32, 64).toString('hex'), Buffer.from(primaryId.public).toString('hex'))
const advPrimary = hkdf(Buffer.concat([companionShared, sharedKey(primaryId.private, c2.signedIdentityKey.public), plain.subarray(64, 96)]), 32, { info: 'adv_secret' }).toString('base64')
assert.equal(fin.advSecretKey, advPrimary)
assert.deepEqual(['Chrome', 'Edge', 'Firefox', 'Safari', 'Desktop', 'Foo'].map((b) => companionPlatformId(['Ubuntu', b, '1'])), ['1', '2', '3', '6', '7', '9'])
ok('4. pairing code: companion_finish + advSecretKey konsisten')
// 5. device-identity untuk pesan pkmsg: hasil pairing → bytes yang bisa didekode server
assert.equal(encodeDeviceIdentityFromCreds({}), undefined)
const credsPaired = { ...creds, account: good.creds.account }
const encId = encodeDeviceIdentityFromCreds(credsPaired)!
const decId = decode('ADVSignedDeviceIdentity', encId)
assert.equal(Buffer.from(decId.accountSignatureKey!).toString('hex'), Buffer.from(accountKey.public).toString('hex'))
assert.ok(decId.deviceSignature && decId.deviceSignature.length === 64)
ok('5. device-identity untuk pkmsg tersedia dari hasil pairing')
console.log('ALL OK')
