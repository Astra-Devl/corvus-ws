<h1 align="center">🐦‍⬛ corvus-ws</h1>

<p align="center">Library WhatsApp Web (multi-device) berbasis TypeScript & WebSocket, dibuat sendiri tanpa browser.</p>

> corvus-ws adalah library independen, **bukan** fork Baileys dan **bukan** produk resmi WhatsApp. Gunakan dengan risiko sendiri.

## 📑 Daftar Isi

- [Fitur](#-fitur)
- [Status & Batasan](#️-status--batasan)
- [Instalasi](#-instalasi)
- [Koneksi](#-koneksi)
- [Event](#-event)
- [Message](#-message)
- [Media](#-media)
- [Interactive Button & Fitur Button Lainnya](#-interactive-button--fitur-button-lainnya)
- [Group Message](#-group-message)
- [Channel Message](#-channel-message)
- [Community Message](#-community-message)
- [Chat, Kontak, Panggilan, Privasi, Bisnis](#-chat-kontak-panggilan-privasi-bisnis)
- [Store](#-store)
- [Utilitas JID](#-utilitas-jid)
- [Contoh Bot Lengkap](#-contoh-bot-lengkap)

---

## ✨ Fitur

| Kategori | Yang tersedia |
| --- | --- |
| Koneksi | QR, pairing code, reconnect otomatis, keep-alive |
| Auth | Multi-file (folder JSON), memory, atau buat sendiri |
| Message | Teks, mention, quote, reaction, edit, hapus, forward, lokasi, kontak, read receipt, presence |
| Media | Image, video, GIF, audio, voice note, dokumen, stiker, view-once, unduh media |
| Button | Reply buttons, list, template, interactive (reply/url/call/copy/select), carousel, `ButtonBuilder` |
| Group | Buat, metadata, peserta, pengaturan, ephemeral, undangan, join request |
| Channel | Buat, follow, mute, kirim pesan, reaksi, ambil pesan |
| Community | Buat, sub-grup, link/unlink, buat grup di komunitas |
| Lainnya | Chat (archive/pin/mute), kontak, panggilan, bisnis, privasi, store, history |

---

## ⚠️ Status & Batasan

Versi **0.1.0**. Hasil pengecekan kode & test bawaan (semua lulus):

- Test berjalan melawan **server WhatsApp tiruan**, jadi belum terbukti dengan server asli.
- **Token dictionary bawaan kosong.** Isi `dictionary` dan `clientPayload` agar bisa bicara dengan server asli.
- **`onPairSuccess` belum disediakan library**, tulis sendiri handler setelah scan QR.
- Pairing code butuh `pairingBackend`; channel butuh `channelQueryIds`; fitur chat butuh `appStateSync`.
- Belum ada helper untuk poll, event/calendar message, dan status/story.
- Button/list/interactive belum diverifikasi di perangkat penerima asli.

---

## 📦 Instalasi

Syarat: **Node.js ≥ 20**. `ws` wajib; `sharp` opsional (thumbnail & stiker).

**Via terminal**

```bash
npm i corvus-ws@latest ws
# atau dari GitHub
npm i corvus-ws@github:Astra-Devl/corvus-ws ws
```

**Via package.json**

```json
{
  "dependencies": {
    "corvus-ws": "latest",
    "ws": "^8.18.0"
  }
}
```

```json
{
  "dependencies": {
    "corvus-ws": "github:Astra-Devl/corvus-ws",
    "ws": "^8.18.0"
  }
}
```

> Instal dari GitHub butuh script `"prepare": "npm run build"` di `package.json` repo, karena folder `dist` tidak ikut di-commit.

---

## 🔌 Koneksi

### Hubungkan

`makeSocket` mengembalikan `sock` yang sudah berisi `sock.sendMessage`, `sock.groupMetadata`, `sock.newsletterFollow`, dan seterusnya, jadi tidak perlu file tambahan. Semua contoh di bawah memakai `sock`.

```js
import { makeSocket, createMultiFileAuthState, createLogger, getDisconnectCode, DisconnectReason } from 'corvus-ws'

const auth = await createMultiFileAuthState('./session')

const sock = makeSocket({
  auth,
  logger: createLogger({ level: 'info' }),
  // untuk server asli: dictionary, clientPayload, onPairSuccess (lihat Status & Batasan)
})

sock.ev.on('creds.update', () => auth.saveCreds())

sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
  if (qr) console.log('QR:', qr)
  if (connection === 'open') console.log('✅ Terhubung sebagai', sock.user?.id)
  if (connection === 'close') {
    const code = getDisconnectCode(lastDisconnect?.error)
    if (code === DisconnectReason.loggedOut) console.log('Logout, hapus ./session lalu login ulang.')
  }
})

await sock.connect()
```

Folder sesi berisi kunci akun, masukkan ke `.gitignore`.

### Login via QR

```js
import qrcode from 'qrcode-terminal' // npm i qrcode-terminal

sock.ev.on('connection.update', ({ qr }) => {
  if (qr) qrcode.generate(qr, { small: true })
})
```

### Login via Pairing Code

Butuh `pairingBackend` di `makeSocket({...})`.

```js
if (!sock.auth.isRegistered) {
  const code = await sock.requestPairingCode('6281234567890')   // tanpa + dan tanpa 0 di depan
  console.log('Kode pairing:', code)
  // kode buatan sendiri (8 karakter [1-9A-HJ-NP-TV-Z]):
  // await sock.requestPairingCode('6281234567890', 'CORVUS12')
}
```

### Reconnect

Aktif otomatis dengan exponential backoff.

```js
const sock = makeSocket({
  auth,
  reconnect: { initialDelayMs: 1000, maxDelayMs: 30000, maxAttempts: 10 }, // atau reconnect: false
})
```

| DisconnectReason | Kode | Reconnect otomatis |
| --- | --- | --- |
| `loggedOut` | 401 | ❌ |
| `forbidden` | 403 | ❌ |
| `timedOut` | 408 | ✅ |
| `connectionClosed` | 428 | ✅ |
| `connectionReplaced` | 440 | ❌ |
| `badSession` | 500 | ❌ |
| `restartRequired` | 515 | ✅ |

### Opsi `makeSocket`

| Opsi | Keterangan |
| --- | --- |
| `auth` | **Wajib.** `createMultiFileAuthState(folder)` / `createMemoryAuthState()` |
| `logger` | `createLogger({ level })` |
| `browser` | `[platform, browser, version]` |
| `markOnlineOnConnect` | Online saat terhubung (default `true`) |
| `emitOwnEvents` | Pesan yang kamu kirim ikut masuk `messages.upsert` (default `true`) |
| `syncFullHistory` | Minta riwayat penuh |
| `callAutoReject` | `true` atau `(call) => boolean` |
| `mediaProcessor` | `'auto'` memakai sharp/ffmpeg bila terpasang |
| `store` | `false` untuk mematikan store |
| `channelQueryIds` | Doc-ID fitur channel |
| `appStateSync` | Backend fitur chat |
| `pairingBackend` | Backend pairing code |
| `reconnect` | Opsi reconnect atau `false` |

### Logout & tutup

```js
await sock.logout()   // keluarkan perangkat + hapus kredensial lokal
await sock.end()      // tutup koneksi
sock.dispose()        // lepas listener (setelah end)
```

---

## 📡 Event

| Event | Payload |
| --- | --- |
| `connection.update` | `{ connection, lastDisconnect, qr, isNewLogin, ... }` |
| `creds.update` | kredensial yang berubah |
| `messages.upsert` | `{ messages, type: 'notify' \| 'append' }` |
| `messages.update` | `[{ key, update }]` |
| `messages.delete` | `{ keys }` atau `{ jid, all: true }` |
| `messages.reaction` | `[{ key, reaction }]` |
| `message-receipt.update` | `[{ key, receipt }]` |
| `chats.upsert` / `chats.update` / `chats.delete` | data chat |
| `contacts.upsert` / `contacts.update` | data kontak |
| `groups.upsert` / `groups.update` | data grup |
| `group-participants.update` | `{ id, author, participants, action }` |
| `presence.update` | `{ id, presences }` |
| `call` | `CallInfo[]` |
| `history.set` | `{ chats, contacts, messages, isLatest }` |
| `error` | `Error` |

```js
const off = sock.ev.on('messages.upsert', handler) // off() untuk berhenti
sock.ev.once('connection.update', handler)
sock.ev.off('messages.upsert', handler)

sock.ev.on('group-participants.update', ({ id, action, participants }) => {
  if (action === 'add') sock.sendMessage(id, { text: 'Selamat datang! 👋', mentions: participants })
})

sock.ev.on('message-receipt.update', (list) => {
  for (const { key, receipt } of list) console.log(key.id, receipt.readTimestamp)
})
```

---

## 💬 Message

### Menerima pesan

```js
import { extractText, getContentType, normalizeMessageContent } from 'corvus-ws'

sock.ev.on('messages.upsert', async ({ messages, type }) => {
  if (type !== 'notify') return
  for (const msg of messages) {
    if (msg.key.fromMe) continue
    const jid = msg.key.remoteJid
    const text = extractText(msg.message)
    const kind = getContentType(normalizeMessageContent(msg.message)) // 'conversation', 'imageMessage', ...

    if (text === '!ping') await sock.sendMessage(jid, { text: 'pong 🏓' }, { quoted: msg })
  }
})
```

### Kirim teks, mention, quote

```js
await sock.sendMessage(jid, { text: 'Halo!' })

await sock.sendMessage(groupJid, {
  text: 'Halo @6281234567890',
  mentions: ['6281234567890@s.whatsapp.net'],
})

await sock.sendMessage(jid, { text: 'Membalas' }, { quoted: msg })
await sock.sendMessage(jid, { text: 'Balasan' }, { quotedKey: msg.key })       // lewat key (butuh store)
await sock.sendMessage(jid, { text: 'Hilang sendiri' }, { ephemeralExpiration: 86400 })
```

### Reaction, edit, hapus, forward

```js
await sock.sendMessage(jid, { react: { key: msg.key, text: '🔥' } })
await sock.sendMessage(jid, { react: { key: msg.key, text: '' } })     // hapus reaction

const sent = await sock.sendMessage(jid, { text: 'typo' })
await sock.sendMessage(jid, { edit: sent.key, text: 'teks benar' })
await sock.sendMessage(jid, { delete: sent.key })

await sock.sendMessage(otherJid, { forward: msg })
```

### Lokasi & kontak

```js
await sock.sendMessage(jid, {
  location: { degreesLatitude: -6.2, degreesLongitude: 106.8166, name: 'Jakarta', address: 'DKI Jakarta' },
})

const vcard = 'BEGIN:VCARD\nVERSION:3.0\nFN:Astra\nTEL;type=CELL;waid=6281234567890:+62 812-3456-7890\nEND:VCARD'
await sock.sendMessage(jid, { contacts: [{ displayName: 'Astra', vcard }] })
```

### Baca & presence

```js
await sock.readMessages([msg.key])

await sock.sendPresenceUpdate('available')       // online
await sock.sendPresenceUpdate('unavailable')
await sock.sendPresenceUpdate('composing', jid)  // mengetik
await sock.sendPresenceUpdate('recording', jid)  // merekam
await sock.sendPresenceUpdate('paused', jid)
await sock.presenceSubscribe(jid)
```

---

## 🖼️ Media

Sumber boleh berupa URL (`{ url }` atau string `https://...`), path file (`{ path }` atau string), `Buffer`, atau `{ stream }`.

```js
// gambar
await sock.sendMessage(jid, { image: { url: 'https://example.com/a.jpg' }, caption: 'Halo 👋' })

// video & GIF
await sock.sendMessage(jid, { video: { path: './video.mp4' }, caption: 'Tonton' })
await sock.sendMessage(jid, { video: { path: './loop.mp4' }, gifPlayback: true })

// audio & voice note
await sock.sendMessage(jid, { audio: { path: './lagu.mp3' } })
await sock.sendMessage(jid, { audio: { path: './suara.ogg' }, ptt: true })

// dokumen
await sock.sendMessage(jid, {
  document: { path: './laporan.pdf' },
  fileName: 'Laporan.pdf',
  mimetype: 'application/pdf',
  caption: 'Laporan bulan ini',
})

// stiker (butuh sharp bila bukan WebP)
await sock.sendMessage(jid, {
  sticker: { path: './stiker.png' },
  packName: 'Corvus Pack',
  publisher: 'Astra',
  emojis: ['🐦‍⬛'],
})

// view-once (gambar / video)
await sock.sendMessage(jid, { image: { path: './rahasia.jpg' }, viewOnce: true })
```

**Unduh media dari pesan masuk**

```js
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'

const buffer = await sock.media.downloadToBuffer(msg.message)         // ke memori

const stream = await sock.media.download(msg.message)                 // atau stream (file besar)
await pipeline(stream, createWriteStream('./unduhan.bin'))
```

Batas baca ke memori 64 MiB; untuk file besar gunakan `{ path }`.

---

## 🔘 Interactive Button & Fitur Button Lainnya

Batas sisi-klien: reply button 3, template button 4, baris list 10, native flow button 10, kartu carousel 10. Tampilan di perangkat penerima bergantung kebijakan WhatsApp dan belum diverifikasi di server asli.

### 1. Reply Buttons

```js
await sock.sendMessage(jid, {
  buttons: {
    header: 'Menu Utama',
    text: 'Pilih salah satu:',
    footer: 'corvus-ws',
    buttons: [
      { id: 'btn_info', text: 'ℹ️ Info' },
      { id: 'btn_help', text: '🆘 Bantuan' },
    ],
  },
})
```

### 2. List Message

```js
await sock.sendMessage(jid, {
  list: {
    title: 'Daftar Menu',
    text: 'Silakan pilih menu',
    buttonText: 'Buka Menu',
    footer: 'corvus-ws',
    sections: [
      { title: 'Umum', rows: [
        { id: 'row_ping', title: 'Ping', description: 'Cek respons' },
        { id: 'row_owner', title: 'Owner', description: 'Kontak pemilik' },
      ] },
      { title: 'Media', rows: [{ id: 'row_sticker', title: 'Stiker' }] },
    ],
  },
})
```

### 3. Template Buttons

Tipe: `reply`, `url`, `call`.

```js
await sock.sendMessage(jid, {
  template: {
    title: 'Promo',
    text: 'Diskon 50% hari ini!',
    footer: 'Syarat berlaku',
    buttons: [
      { type: 'reply', text: 'Ambil Promo', id: 'promo' },
      { type: 'url', text: 'Buka Website', url: 'https://example.com' },
      { type: 'call', text: 'Hubungi Kami', phoneNumber: '+6281234567890' },
    ],
  },
})
```

### 4. Interactive (Native Flow)

Tipe: `reply`, `url`, `call`, `copy`, `select`.

```js
await sock.sendMessage(jid, {
  interactive: {
    header: { title: 'Corvus Bot', subtitle: 'v0.1.0' },
    body: 'Pilih aksi di bawah ini',
    footer: 'Powered by corvus-ws',
    buttons: [
      { type: 'reply', text: 'Mulai', id: 'start' },
      { type: 'url', text: 'Dokumentasi', url: 'https://github.com/Astra-Devl/corvus-ws' },
      { type: 'call', text: 'Telepon', phoneNumber: '+6281234567890' },
      { type: 'copy', text: 'Salin Kode', code: 'CORVUS-2026' },
      { type: 'select', title: 'Pilih Bahasa', sections: [
        { title: 'Bahasa', rows: [{ id: 'lang_id', title: 'Indonesia' }, { id: 'lang_en', title: 'English' }] },
      ] },
    ],
  },
})

// dengan gambar di header
await sock.sendMessage(jid, {
  interactive: {
    header: { title: 'Banner', image: { path: './banner.jpg' } },
    body: 'Teks body',
    buttons: [{ type: 'reply', text: 'OK', id: 'ok' }],
  },
})
```

### 5. ButtonBuilder

```js
import { ButtonBuilder } from 'corvus-ws'

const interactive = new ButtonBuilder()
  .header('Corvus Bot')
  .body('Pilih aksi')
  .footer('corvus-ws')
  .reply('Mulai', 'start')
  .url('Website', 'https://example.com')
  .call('Telepon', '+6281234567890')
  .copy('Salin Kode', 'CORVUS-2026')
  .select('Menu', [{ title: 'Umum', rows: [{ id: 'ping', title: 'Ping' }] }])
  .build()

await sock.sendMessage(jid, { interactive })
```

### 6. Carousel

```js
const foto = await sock.media.prepare('image', { path: './produk-a.jpg' })

await sock.sendMessage(jid, {
  carousel: {
    body: 'Geser untuk melihat produk',
    footer: 'Toko Corvus',
    cards: [
      { header: { title: 'Produk A', media: foto }, body: 'Rp 50.000',
        buttons: [{ type: 'url', text: 'Beli', url: 'https://example.com/a' }] },
      { header: { title: 'Produk B' }, body: 'Rp 75.000',
        buttons: [{ type: 'reply', text: 'Pesan', id: 'order_b' }] },
    ],
  },
})
```

### 7. Membaca balasan tombol

`parseButtonResponse` mengenali reply button, list, template, dan native flow.

```js
import { parseButtonResponse } from 'corvus-ws'

sock.ev.on('messages.upsert', async ({ messages }) => {
  for (const msg of messages) {
    const res = parseButtonResponse(msg.message)
    if (!res) continue

    if (res.kind === 'native_flow') console.log('native flow:', res.name, res.params)
    else console.log(`${res.kind}: id=${res.id} teks=${res.text}`) // button | list | template
  }
})
```

---

## 👥 Group Message

Kirim pesan ke grup sama seperti chat biasa (JID `...@g.us`), semua jenis pesan di atas berlaku.

```js
const groupJid = '120363000000000000@g.us'

await sock.sendMessage(groupJid, { text: 'Halo semuanya!' })

// info
const meta = await sock.groupMetadata(groupJid)
const semua = await sock.groupFetchAllParticipating()          // { [jid]: metadata }

// buat & keluar
const grup = await sock.groupCreate('Grup Baru', ['6281234567890@s.whatsapp.net'])
await sock.groupLeave(groupJid)

// peserta: 'add' | 'remove' | 'promote' | 'demote'
const hasil = await sock.groupParticipantsUpdate(groupJid, ['6281234567890@s.whatsapp.net'], 'add')
// hasil[i].status === '200' berarti sukses

// info grup
await sock.groupUpdateSubject(groupJid, 'Nama Baru')
await sock.groupUpdateDescription(groupJid, 'Deskripsi baru')
await sock.groupUpdateDescription(groupJid)                    // hapus deskripsi

// pengaturan: 'announcement' | 'not_announcement' | 'locked' | 'unlocked'
await sock.groupSettingUpdate(groupJid, 'announcement')        // hanya admin boleh kirim pesan
await sock.groupSettingUpdate(groupJid, 'locked')              // hanya admin boleh ubah info grup

await sock.groupToggleEphemeral(groupJid, 604800)              // 0 | 86400 | 604800 | 7776000
await sock.groupMemberAddMode(groupJid, 'admin_add')           // atau 'all_member_add'
await sock.groupJoinApprovalMode(groupJid, 'on')               // atau 'off'

// permintaan bergabung
const reqs = await sock.groupRequestParticipantsList(groupJid)
await sock.groupRequestParticipantsUpdate(groupJid, ['6281234567890@s.whatsapp.net'], 'approve') // atau 'reject'

// undangan
const code = await sock.groupInviteCode(groupJid)              // https://chat.whatsapp.com/<code>
const baru = await sock.groupRevokeInvite(groupJid)
const info = await sock.groupGetInviteInfo('https://chat.whatsapp.com/XXXX')
const joined = await sock.groupAcceptInvite('https://chat.whatsapp.com/XXXX')
```

---

## 📢 Channel Message

Channel memakai query yang ID-nya berubah mengikuti versi WhatsApp Web, jadi isi `channelQueryIds` sendiri; operasi tanpa ID gagal dengan `ERR_NOT_CONFIGURED`.

```js
const sock = makeSocket({
  auth,
  channelQueryIds: { create: '...', metadata: '...', follow: '...', unfollow: '...',
                     mute: '...', unmute: '...', delete: '...', update: '...' },
})
```

JID channel berakhiran `@newsletter`.

```js
const channelJid = '120363000000000000@newsletter'

// buat (reaction: 'ALL' | 'BASIC' | 'NONE')
const ch = await sock.newsletterCreate('Info Corvus', 'Update terbaru corvus-ws', 'ALL')

// metadata: lewat JID atau kode undangan
const byJid = await sock.newsletterMetadata('jid', channelJid)
const byInvite = await sock.newsletterMetadata('invite', 'kodeUndangan')

// langganan
await sock.newsletterFollow(channelJid)
await sock.newsletterUnfollow(channelJid)
await sock.newsletterMute(channelJid)
await sock.newsletterUnmute(channelJid)

// kelola (admin / pemilik)
await sock.newsletterUpdateName(channelJid, 'Nama Baru')
await sock.newsletterUpdateDescription(channelJid, 'Deskripsi baru')
await sock.newsletterDelete(channelJid)

// kirim pesan (admin / pemilik), mengembalikan ID pesan
await sock.sendMessage(channelJid, { text: 'Halo subscriber!' })
await sock.sendMessage(channelJid, { image: { path: './poster.jpg' }, caption: 'Poster' })

// ambil pesan, lalu beri reaksi memakai serverId
const pesan = await sock.newsletterFetchMessages('jid', channelJid, 20)
// [{ serverId, id, timestamp, message, views, reactions }]
await sock.newsletterReactMessage(channelJid, pesan[0].serverId, '👍')

// pembaruan langsung (views & reaksi)
await sock.newsletterSubscribeUpdates(channelJid)
```

Channel hanya mendukung teks dan media lewat `sendMessage`.

---

## 🏘️ Community Message

```js
const communityJid = '120363000000000001@g.us'

const komunitas = await sock.communityCreate('Komunitas Corvus', {
  description: 'Wadah semua grup',
  approvalMode: 'request_required',        // atau 'off'
  allowNonAdminSubGroupCreation: true,
})

const meta = await sock.communityMetadata(communityJid)
const sub = await sock.communityFetchLinkedGroups(communityJid)   // [{ id, subject, creation, owner, size }]

await sock.communityLinkGroup(groupJid, communityJid)
await sock.communityUnlinkGroup(groupJid, communityJid)
await sock.communityCreateGroup('Grup Diskusi', ['6281234567890@s.whatsapp.net'], communityJid)
await sock.communityLeave(communityJid)

// pengumuman ke grup pengumuman komunitas
await sock.sendMessage(announceGroupJid, { text: 'Pengumuman komunitas 📣' })

// kelola peserta komunitas dengan fungsi grup
await sock.groupParticipantsUpdate(communityJid, ['6281234567890@s.whatsapp.net'], 'add')
```

---

## 🧰 Chat, Kontak, Panggilan, Privasi, Bisnis

### Chat

Butuh `appStateSync` di `makeSocket({...})`.

```js
await sock.chatModify({ archive: true }, jid)
await sock.chatModify({ pin: true }, jid)
await sock.chatModify({ mute: '8h' }, jid)         // '8h' | '1w' | 'always' | angka (ms) | null = unmute
await sock.chatModify({ markRead: true }, jid)
await sock.chatModify({ star: { key: msg.key, value: true } }, jid)
await sock.chatModify({ clear: true }, jid)
await sock.chatModify({ delete: true }, jid)
```

### Kontak

```js
const [cek] = await sock.onWhatsApp('6281234567890')   // { query, jid, exists }
const status = await sock.fetchStatus(jid)
const foto = await sock.profilePictureUrl(jid, 'image') // 'preview' | 'image'
const blokir = await sock.fetchBlocklist()
await sock.updateBlockStatus(jid, 'block')              // atau 'unblock'
```

### Panggilan

```js
const sock = makeSocket({ auth, callAutoReject: true })  // tolak semua otomatis

sock.ev.on('call', async (calls) => {
  for (const call of calls) {
    if (call.status === 'offer') {
      await sock.rejectCall(call.id, call.from)
      await sock.sendMessage(call.from, { text: 'Maaf, bot tidak menerima panggilan 🙏' })
    }
  }
})
```

### Privasi

```js
const pengaturan = await sock.fetchPrivacySettings()

await sock.updatePrivacy('last', 'contacts')          // terakhir dilihat
await sock.updatePrivacy('online', 'match_last_seen')
await sock.updatePrivacy('profile', 'contacts')
await sock.updatePrivacy('status', 'contacts')
await sock.updatePrivacy('readreceipts', 'none')
await sock.updatePrivacy('groupadd', 'contacts')
await sock.updatePrivacy('calladd', 'known')
await sock.updatePrivacy('messages', 'contacts')

await sock.updateDefaultDisappearingMode(604800)
```

| Kategori | Nilai |
| --- | --- |
| `last`, `profile`, `status` | `all`, `contacts`, `contact_blacklist`, `none` |
| `online` | `all`, `match_last_seen` |
| `readreceipts` | `all`, `none` |
| `groupadd` | `all`, `contacts`, `contact_blacklist` |
| `calladd` | `all`, `known` |
| `messages` | `all`, `contacts` |

### Bisnis

```js
const profil = await sock.getBusinessProfile(jid)
const katalog = await sock.getCatalog(jid)
const koleksi = await sock.getCollections(jid, 20)
```

---

## 🗄️ Store

Store in-memory aktif otomatis dan mengikuti event socket.

```js
const store = sock.store                         // undefined bila store: false

store.chats.list()
store.contacts.getName(jid)
store.contacts.search('astra')
store.groups.get(groupJid)
store.messages.list(jid, { limit: 20 })          // lama → baru
store.messages.last(jid)
store.loadMessage(msg.key)

// simpan & muat
import { writeFileSync, readFileSync } from 'node:fs'
writeFileSync('./store.json', JSON.stringify(store.toSnapshot()))
store.loadSnapshot(JSON.parse(readFileSync('./store.json', 'utf8')))
```

---

## 🪪 Utilitas JID

```js
import { phoneToJid, jidToPhone, jidNormalizedUser, isJidGroup, isJidNewsletter, isJidUser } from 'corvus-ws'

phoneToJid('6281234567890')                  // '6281234567890@s.whatsapp.net'
jidToPhone('6281234567890@s.whatsapp.net')   // '6281234567890'
jidNormalizedUser('6281234567890:7@s.whatsapp.net') // buang bagian device
isJidGroup('120363...@g.us')                 // true
isJidNewsletter('120363...@newsletter')      // true
```

Server JID: `@s.whatsapp.net` (pengguna), `@g.us` (grup), `@lid`, `@newsletter` (channel), `status@broadcast`.

---

## 🤖 Contoh Bot Lengkap

```js
import {
  makeSocket, createMultiFileAuthState, createLogger, extractText, parseButtonResponse,
  getDisconnectCode, DisconnectReason, ButtonBuilder,
} from 'corvus-ws'

const auth = await createMultiFileAuthState('./session')
const sock = makeSocket({ auth, logger: createLogger({ level: 'info' }), callAutoReject: true })

sock.ev.on('creds.update', () => auth.saveCreds())

sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
  if (connection === 'open') console.log('✅ Bot online')
  if (connection === 'close' && getDisconnectCode(lastDisconnect?.error) === DisconnectReason.loggedOut) {
    console.log('Sesi berakhir, hapus ./session lalu login ulang.')
  }
})

sock.ev.on('messages.upsert', async ({ messages, type }) => {
  if (type !== 'notify') return

  for (const msg of messages) {
    if (msg.key.fromMe) continue
    const jid = msg.key.remoteJid

    const tombol = parseButtonResponse(msg.message)
    if (tombol) {
      const id = tombol.kind === 'native_flow' ? tombol.name : tombol.id
      await sock.sendMessage(jid, { text: `Kamu memilih: ${id}` }, { quoted: msg })
      continue
    }

    const text = extractText(msg.message)?.trim()
    if (!text?.startsWith('!')) continue

    await sock.sendPresenceUpdate('composing', jid)

    switch (text.slice(1).split(' ')[0]) {
      case 'ping':
        await sock.sendMessage(jid, { text: 'pong 🏓' }, { quoted: msg })
        break
      case 'menu':
        await sock.sendMessage(jid, {
          interactive: new ButtonBuilder()
            .header('Corvus Bot').body('Pilih menu').footer('corvus-ws')
            .reply('Ping', 'ping')
            .url('GitHub', 'https://github.com/Astra-Devl/corvus-ws')
            .build(),
        })
        break
      case 'gambar':
        await sock.sendMessage(jid, { image: { url: 'https://example.com/a.jpg' }, caption: 'Ini gambarnya' })
        break
    }

    await sock.sendPresenceUpdate('paused', jid)
  }
})

sock.ev.on('group-participants.update', async ({ id, action, participants }) => {
  if (action === 'add') await sock.sendMessage(id, { text: 'Selamat datang! 👋', mentions: participants })
})

await sock.connect()

process.on('SIGINT', async () => {
  await sock.end()
  sock.dispose()
  process.exit(0)
})
```

---

## 📄 Lisensi

MIT © AstraCodeX. corvus-ws tidak berafiliasi dengan WhatsApp LLC atau Meta. Dilarang dipakai untuk spam, penipuan, atau aktivitas melanggar hukum.
