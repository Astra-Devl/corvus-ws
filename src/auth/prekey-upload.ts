import { generateKeyPair } from '../crypto/key-utils.js'
import { S_WHATSAPP_NET } from '../protocol/stanza-builder.js'
import type { BinaryNode } from '../protocol/protocol-types.js'
import type { AuthCreds, CredsUpdate } from './credentials.js'
import { bigEndian } from './pairing-handshake.js'

export const MIN_PREKEY_COUNT = 5
export const INITIAL_PREKEY_COUNT = 812
const KEY_BUNDLE_TYPE = Buffer.from([5])

/** Subset `KeyStore` yang dibutuhkan untuk menyimpan pre-key. */
export interface PreKeyStorage {
  set(data: { 'pre-key': Record<string, { public: Uint8Array; private: Uint8Array } | null> }): Promise<void> | void
}

export interface PreKeyUpload {
  update: CredsUpdate
  node: BinaryNode
}

/** Buat `count` pre-key baru, simpan ke `keys`, dan susun stanza unggahannya. */
export async function buildPreKeyUpload(
  creds: Pick<AuthCreds, 'registrationId' | 'signedIdentityKey' | 'signedPreKey' | 'nextPreKeyId' | 'firstUnuploadedPreKeyId'>,
  keys: PreKeyStorage,
  count: number,
): Promise<PreKeyUpload> {
  const first = creds.nextPreKeyId
  const last = first + count - 1
  const fresh: Record<string, { public: Uint8Array; private: Uint8Array }> = {}
  for (let id = first; id <= last; id++) fresh[String(id)] = generateKeyPair()
  await keys.set({ 'pre-key': fresh })

  const keyNodes: BinaryNode[] = Object.entries(fresh).map(([id, pair]) => ({
    tag: 'key',
    attrs: {},
    content: [
      { tag: 'id', attrs: {}, content: bigEndian(Number(id), 3) },
      { tag: 'value', attrs: {}, content: pair.public },
    ],
  }))
  const skey = creds.signedPreKey
  return {
    update: { nextPreKeyId: Math.max(last + 1, creds.nextPreKeyId), firstUnuploadedPreKeyId: Math.max(creds.firstUnuploadedPreKeyId, last + 1) },
    node: {
      tag: 'iq',
      attrs: { xmlns: 'encrypt', type: 'set', to: S_WHATSAPP_NET },
      content: [
        { tag: 'registration', attrs: {}, content: bigEndian(creds.registrationId) },
        { tag: 'type', attrs: {}, content: KEY_BUNDLE_TYPE },
        { tag: 'identity', attrs: {}, content: creds.signedIdentityKey.public },
        { tag: 'list', attrs: {}, content: keyNodes },
        {
          tag: 'skey',
          attrs: {},
          content: [
            { tag: 'id', attrs: {}, content: bigEndian(skey.keyId, 3) },
            { tag: 'value', attrs: {}, content: skey.keyPair.public },
            { tag: 'signature', attrs: {}, content: skey.signature },
          ],
        },
      ],
    },
  }
}

/** Stanza untuk menanyakan jumlah pre-key yang tersisa di server. */
export const preKeyCountQuery = (): BinaryNode => ({
  tag: 'iq',
  attrs: { xmlns: 'encrypt', type: 'get', to: S_WHATSAPP_NET },
  content: [{ tag: 'count', attrs: {} }],
})

/** Stanza `passive` → `active` yang dikirim Baileys setelah login. */
export const activeIq = (): BinaryNode => ({
  tag: 'iq',
  attrs: { to: S_WHATSAPP_NET, xmlns: 'passive', type: 'set' },
  content: [{ tag: 'active', attrs: {} }],
})
