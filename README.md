<h1 align="center">corvus-ws</h1>

<p align="center">Library WhatsApp Web (multi-device) berbasis TypeScript & WebSocket, dibuat secara independen tanpa browser.</p>

> corvus-ws adalah library independen dan **bukan** produk resmi WhatsApp. Gunakan dengan risiko sendiri.

## 📑 Daftar Isi

- [Fitur](#-fitur)
- [Instalasi](#-instalasi)
- [Koneksi](#-koneksi)
- [Event](#-event)
- [Message](#-message)
- [Media](#-media)
- [Interactive Button & Fitur Button Lainnya](#-interactive-button--fitur-button-lainnya)
- [Context Info & External Ad Reply](#-context-info--external-ad-reply)
- [Pesan Langka](#-pesan-langka)
- [Pembayaran WhatsApp](#-pembayaran-whatsapp)
- [Group Message](#-group-message)
- [Channel Message](#-channel-message)
- [Community Message](#-community-message)
- [GoBiz (pembayaran QRIS)](#-gobiz-pembayaran-qris)
- [AI (Gemini & Groq) + Toko Otomatis](#-ai-gemini--groq--toko-otomatis)
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
| AI | Balas otomatis dengan Gemini / Groq (kunci milik Anda), memori per chat, tool WhatsApp (tombol, list, carousel, media), toko jual-beli dengan QRIS GoBiz |
| Lainnya | Chat (archive/pin/mute), kontak, panggilan, bisnis, privasi, store, history |

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

---

## 🔌 Koneksi

### Hubungkan

`makeSocket` mengembalikan `sock` yang sudah berisi `sock.sendMessage`, `sock.groupMetadata`, `sock.newsletterFollow`, dan seterusnya. Semua contoh di bawah memakai `sock`.

```js
import { makeSocket, createMultiFileAuthState, createLogger, getDisconnectCode, DisconnectReason } from 'corvus-ws'

const auth = await createMultiFileAuthState('./session')

const sock = makeSocket({
  auth,
  logger: createLogger({ level: 'info' }),
})

sock.ev.on('creds.update', () => auth.saveCreds())

sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
  if (qr) console.log('QR:', qr)
  if (connection === 'open') console.log('✅ Terhubung sebagai', sock.user?.id)
  if (connection === 'close') {
    const code = getDisconnectCode(lastDisconnect?.error)
    if (code === DisconnectReason.loggedOut) console.log('Logout, hapus sesi lalu login ulang.')
  }
})

await sock.connect()
```

### Login via QR

```js
import qrcode from 'qrcode-terminal' // npm i qrcode-terminal

sock.ev.on('connection.update', ({ qr }) => {
  if (qr) qrcode.generate(qr, { small: true })
})
```

### Login via Pairing Code

Bisa dipanggil langsung di bawah `sock`, tanpa `connect()` manual. Koneksi dimulai otomatis.

```js
const sock = makeSocket({ auth })
sock.ev.on('creds.update', () => auth.saveCreds())

if (!sock.auth.isRegistered) {
  const code = await sock.requestPairingCode('6281234567890')   // tanpa + dan tanpa 0 di depan
  console.log('Kode pairing:', code)
  // kode buatan sendiri (8 karakter [1-9A-HJ-NP-TV-Z]):
  // await sock.requestPairingCode('6281234567890', 'CORVUS12')
}
```

Opsi `pairingBackend` bersifat opsional, hanya untuk mengganti pengiriman stanza bawaan.

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
| `pairingBackend` | Opsional: backend pairing code kustom (default bawaan) |
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

Batas sisi-klien: reply button 3, template button 4, baris list 10, native flow button 10, kartu carousel 10.

Node `<biz>` yang membuat button/list/interaktif dirender **ditambahkan otomatis** mengikuti stanza WhatsApp Web. Pesan ber-`<biz>` memakai `type="text"` tanpa `mediatype`.

| Opsi (argumen ketiga `sendMessage`) | Fungsi |
| --- | --- |
| `bizNodes: false` | Matikan penambahan `<biz>` otomatis |
| `bizBot: true` | Tambahkan `<bot biz_bot="1"/>` di chat 1:1 (default mati) |
| `additionalNodes: [...]` | Node sendiri; bila memuat `<biz>`, node otomatis dilewati |

Pesan `interactive` dikirim **langsung** (tanpa `viewOnceMessage`). Kalau perlu pembungkus, pakai `.wrap(true)` pada `ButtonBuilder` atau `wrap: true` pada input.

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

Dengan header lokasi + thumbnail (`headerType` 6):

```js
await sock.sendMessage(jid, {
  buttons: {
    text: 'Halo, pilih opsi',
    footer: '© My Bot',
    locationMessage: { name: 'My Bot', address: 'v1.0', jpegThumbnail: fs.readFileSync('./thumb.jpg') },
    buttons: [{ id: '.owner', text: 'Owner' }, { id: '.menu', text: 'Menu' }],
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

### Tipe tombol native flow lainnya

Dipakai di `interactive`, `ButtonBuilder`, dan kartu `carousel`:

| `type` | Fungsi | Contoh |
| --- | --- | --- |
| `location` | Minta pengguna kirim lokasi | `{ type: 'location', text: 'Kirim Lokasi' }` |
| `reminder` / `cancel_reminder` | Pengingat | `{ type: 'reminder', text: 'Ingatkan saya', id: 'r1' }` |
| `address` | Form alamat | `{ type: 'address', text: 'Isi Alamat' }` |
| `catalog` | Katalog bisnis | `{ type: 'catalog', businessPhoneNumber: '628...' }` |
| `webview` | Buka web di dalam WhatsApp | `{ type: 'webview', text: 'Buka', url: 'https://...' }` |
| `payment` | Tombol pembayaran (`review_and_pay`, `payment_info`) | lihat [Pembayaran WhatsApp](#-pembayaran-whatsapp) |
| `raw` | Nama + parameter JSON apa adanya | `{ type: 'raw', name: 'mpm', params: {} }` |

```js
await sock.sendMessage(jid, {
  interactive: {
    body: 'Pilih aksi',
    buttons: [
      { type: 'location', text: 'Kirim Lokasi' },
      { type: 'webview', text: 'Buka Toko', url: 'https://toko.id' },
      { type: 'reminder', text: 'Ingatkan', id: 'promo' },
    ],
  },
})
```

**Reply buttons dan template klasik dengan media:** isi `image`, `video`, atau `document` (link, path, Buffer, atau stream; diunggah otomatis).

```js
await sock.sendMessage(jid, {
  buttons: { text: 'Menu', footer: '© Bot', image: 'https://example.com/menu.jpg', buttons: [{ id: '.owner', text: 'Owner' }] },
})
await sock.sendMessage(jid, {
  template: { text: 'Promo', video: './promo.mp4', buttons: [{ type: 'url', text: 'Beli', url: 'https://toko.id' }] },
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

Setiap kartu boleh punya media: isi `image`, `video`, atau `document` dengan **link, path file, Buffer, atau stream**. Library mengunggahnya otomatis ke WhatsApp.

```js
await sock.sendMessage(jid, {
  carousel: {
    body: 'Geser untuk melihat produk',
    footer: 'Toko Corvus',
    cards: [
      {
        header: { title: 'Produk A', image: 'https://example.com/a.jpg' },       // link
        body: 'Rp 50.000',
        buttons: [{ type: 'url', text: 'Beli', url: 'https://example.com/a' }],
      },
      {
        header: { title: 'Produk B', image: './produk-b.png' },                   // path file
        body: 'Rp 75.000',
        buttons: [{ type: 'reply', text: 'Pesan', id: 'order_b' }],
      },
      {
        header: { title: 'Video', video: 'https://example.com/promo.mp4' },       // video
        body: 'Lihat promo',
        buttons: [{ type: 'copy', text: 'Salin kode', code: 'PROMO10' }],
      },
      {
        header: { title: 'Katalog', document: './katalog.pdf', fileName: 'Katalog.pdf', mimetype: 'application/pdf' },
        body: 'Unduh katalog',
        buttons: [{ type: 'reply', text: 'Terima kasih', id: 'ok' }],
      },
      { body: 'Kartu tanpa media', buttons: [{ type: 'reply', text: 'Ok', id: 'x' }] },
    ],
  },
})
```

- Maksimal 10 kartu. `video` dengan `gif: true` diputar berulang. `cardType: 'album'` untuk album gambar (default `'hscroll'`, kartu geser).
- `header.image/video/document` juga berlaku untuk `header` pesan `interactive` dan header utama carousel.
- Kalau sudah punya hasil `sock.media.prepare(...)`, pakai `header: { title, media }`.

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

## 🧩 Context Info & External Ad Reply

Berlaku untuk **semua jenis pesan** (teks, media, button, list, interactive, carousel, lokasi, kontak, poll, event, ...). Taruh di isi pesan, atau di opsi ketiga `sendMessage` (opsi ketiga menang bila bentrok).

```js
// Kartu pratinjau link (external ad reply)
await sock.sendMessage(jid, {
  text: 'Cek toko kami!',
  externalAdReply: {
    title: 'Toko Corvus',
    body: 'Diskon 50% hari ini',
    thumbnail: 'https://example.com/thumb.jpg',   // link, path, atau Buffer (dibaca otomatis)
    sourceUrl: 'https://toko.id',
    mediaType: 'image',                           // 'image' | 'video' | 'none'
    renderLargerThumbnail: true,
    showAdAttribution: true,
  },
})

// Tampil seolah diteruskan dari saluran WhatsApp
await sock.sendMessage(jid, { text: 'Kabar terbaru', forwardedNewsletter: { jid: '120363...@newsletter', name: 'Info Corvus' } })

// Mention semua anggota grup, tanda "diteruskan", dan pesan sementara
await sock.sendMessage(groupJid, { text: 'Halo semua!', mentionAll: true, isForwarded: true, forwardingScore: 5 })

// Lewat opsi ketiga (berlaku untuk jenis pesan apa pun)
await sock.sendMessage(jid, { image: './a.jpg', caption: 'Halo' }, { contextInfo: { externalAdReply: { title: 'Promo' } }, ephemeralExpiration: 86400 })
```

`contextInfo` juga menerima `groupMentions`, `entryPointConversionSource`, `alwaysShowAdAttribution`, dan `raw` (field `ContextInfo` mentah).

---

## 🎁 Pesan Langka

```js
// Event / acara (kalender)
await sock.sendMessage(groupJid, { event: { name: 'Rapat Bulanan', description: 'Via Zoom', startDate: new Date('2026-12-01T10:00:00+07:00'), endDate: new Date('2026-12-01T11:00:00+07:00'), location: { degreesLatitude: -6.2, degreesLongitude: 106.8, name: 'Jakarta' } } })

// Poll (selectableCount: 0 = bebas, 1 = pilih satu; toAnnouncementGroup untuk grup pengumuman komunitas)
await sock.sendMessage(jid, { poll: { name: 'Makan apa?', values: ['Nasi goreng', 'Mie ayam'], selectableCount: 1 } })

// Sematkan / lepas sematan pesan (duration detik: 86400, 604800, 2592000)
await sock.sendMessage(groupJid, { pin: { key: msg.key, type: 'pin', duration: 604800 } })
await sock.sendMessage(groupJid, { pin: { key: msg.key, type: 'unpin' } })

// Album (beberapa foto/video terkelompok)
await sock.sendAlbumMessage(jid, [{ image: './1.jpg', caption: 'Satu' }, { image: 'https://example.com/2.jpg' }, { video: './3.mp4' }])

// Kartu undangan grup (kode undangan diambil otomatis; Anda harus admin)
await sock.sendGroupInvite(jid, '120363...@g.us', 'Gabung grup kami ya')

// Panggilan terjadwal, video bulat (PTV), minta nomor telepon, status grup
await sock.sendMessage(jid, { scheduledCall: { title: 'Sync mingguan', at: new Date('2026-12-01T03:00:00Z'), type: 'video' } })
await sock.sendMessage(jid, { cancelScheduledCall: scheduledMsg.key })
await sock.sendMessage(jid, { ptv: './video-bulat.mp4' })
await sock.sendMessage(jid, { requestPhoneNumber: true })
await sock.sendMessage(groupJid, { groupStatus: { text: 'Status untuk grup' } })      // atau { image: ..., caption } / { video: ... }
```

---

## 💸 Pembayaran WhatsApp

Pesan pembayaran bawaan WhatsApp. Ketersediaannya berbeda per negara dan akun.

```js
// Minta pembayaran (nominal dalam satuan mata uang utama)
await sock.sendMessage(jid, { requestPayment: { amount: 50000, currency: 'IDR', from: jid, note: 'Pembayaran pesanan #12', expiresAt: Math.floor(Date.now() / 1000) + 3600 } })
await sock.sendMessage(jid, { sendPayment: { requestKey: requestMsg.key, note: 'Sudah dibayar' } })
await sock.sendMessage(jid, { cancelPaymentRequest: requestMsg.key })
await sock.sendMessage(jid, { declinePaymentRequest: requestMsg.key })
await sock.sendMessage(jid, { paymentInvite: { service: 'UPI' } })

// Produk dan pesanan (katalog bisnis)
await sock.sendMessage(jid, { product: { productId: 'p1', title: 'Kopi Arabika', price: 25000, businessOwnerJid: sock.user.id, image: 'https://example.com/kopi.jpg' } })
await sock.sendMessage(jid, { order: { orderId: 'ORD-1', itemCount: 2, title: 'Pesanan Kopi', sellerJid: sock.user.id, total: 50000, thumbnail: 'https://example.com/t.jpg', status: 'accepted' } })
```

**Tombol pembayaran** (native flow `review_and_pay`) bisa dipakai di `interactive` maupun kartu `carousel`:

```js
await sock.sendMessage(jid, {
  interactive: {
    body: 'Konfirmasi pesanan Anda',
    buttons: [{
      type: 'payment',                                  // name default: 'review_and_pay'; atau 'payment_info'
      payment: {
        referenceId: 'ORD-1',
        currency: 'IDR',
        total: 50000,
        items: [{ name: 'Kopi Arabika', price: 25000, quantity: 2 }],
        paymentSettings: [{ type: 'payment_link', payment_link: { uri: 'https://bayar.toko.id/ORD-1' } }],
      },
    }],
  },
})
```

Untuk pembayaran QRIS Indonesia yang terverifikasi otomatis, lihat [GoBiz](#-gobiz-pembayaran-qris).

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

**Fitur channel tambahan**

```js
// Ambil ID saluran dari URL (juga menerima kode undangan saja)
const channelJid = await sock.newsletterIdFromUrl('https://whatsapp.com/channel/0029VaABCdefGHIjkl12')   // alias: sock.newsletterUrlId(...)
const info = await sock.newsletterFromUrl('https://whatsapp.com/channel/0029VaABCdefGHIjkl12')

// Kirim teks / foto / video / audio / dokumen ke saluran
await sock.sendMessage(channelJid, { text: 'Halo subscriber!' })
await sock.sendMessage(channelJid, { image: 'https://example.com/poster.jpg', caption: 'Poster' })
await sock.sendMessage(channelJid, { video: './promo.mp4', caption: 'Promo' })
await sock.sendMessage(channelJid, { audio: './lagu.ogg', ptt: true })
await sock.sendMessage(channelJid, { document: './katalog.pdf', fileName: 'Katalog.pdf', mimetype: 'application/pdf' })

// Reaksi emoji pada pesan saluran (pakai serverId dari fetchMessages)
const [latest] = await sock.newsletterFetchMessages('jid', channelJid, 1)
await sock.newsletterReactMessage(channelJid, latest.serverId, '🔥')
await sock.newsletterReactMessage(channelJid, latest.serverId)          // hapus reaksi
```

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

## 🧾 GoBiz (pembayaran QRIS)

Pembayaran QRIS lewat GoBiz/GoPay Merchant. **Tidak ada pengaturan global**: QRIS, email, password, nomor HP, dan token diberikan pada pemanggilan masing-masing fungsi.

Aturan pesan: bila ada foto → dikirim sebagai foto dengan `caption`; bila tidak ada → teks (`text`). Template boleh string atau fungsi, dengan placeholder `{amount}`, `{orderId}`, `{expires}`, `{qris}`, `{merchant}`, `{time}`, `{error}` sesuai fungsi.

```js
// 1) Buat tagihan: QR QRIS dinamis dikirim sebagai foto + caption
const bill = await sock.sendCreatePaymentGobiz(m.chat, {
  qris: '000201010211...6304ABCD',          // string QRIS statis milik merchant
  amount: 25000,                            // Rupiah
  orderId: 'INV-001',
  expiresInMs: 10 * 60_000,
  caption: '💳 Bayar *{amount}* (order {orderId}) sebelum {expires}',
  // image: false → kirim teks saja | image: './qris.png' → pakai gambar sendiri
  send: { quoted: m },                      // opsi kirim biasa (quoted, contextInfo, ...)
})

// 2) Cek / tunggu pembayaran (cek sekali, atau tunggu sampai masuk / habis waktu)
const status = await sock.sendStatusPaymentGobiz(m.chat, {
  cacheFile: './gopay_cache.json',                            // token & merchant dibaca dari berkas cache
  // auth: { email: 'merchant@mail.com', password: '***' },   // atau auth langsung: { phone } setelah login OTP, atau { token }
  amount: 25000,
  since: bill.since,                                          // hanya hitung pembayaran setelah tagihan dibuat
  wait: { timeoutMs: 5 * 60_000, intervalMs: 6_000 },         // hilangkan untuk cek sekali
  text: { paid: '✅ Lunas {amount}', timeout: '⌛ Waktu habis' },
  image: { paid: 'https://example.com/lunas.jpg' },           // foto per status (opsional)
})
if (status.status === 'paid') { /* kirim produk */ }          // 'paid' | 'pending' | 'timeout' | 'error'

// 3) Login password (token disimpan di memori; opsi cacheFile untuk menyimpan ke berkas)
await sock.sendLoginGobiz(m.chat, { auth: { email: 'merchant@mail.com', password: '***', cacheFile: './gobiz-cache.json' } })

// 4) Login OTP: minta kode, lalu verifikasi
await sock.sendLoginGobiz(m.chat, { auth: { phone: '081234567890' } })
await sock.sendOtpGobiz(m.chat, { auth: { phone: '081234567890' }, otp: '123456' })
```

Catatan:
- Gambar QR dibuat dengan paket opsional `qrcode` (`npm i qrcode`). Tanpa paket itu, tagihan dikirim sebagai teks berisi kode QRIS (`imageSent: false` di hasil).
- Login memakai `curl` di server; pastikan `curl` terpasang. Kredensial dikirim lewat stdin, bukan argumen proses.
- Pesan tidak pernah memuat password atau token; email dan nomor ditampilkan tersamar.
- Gambar QR dikirim langsung sebagai media WhatsApp, tanpa mengunggah ke layanan pihak ketiga.
- Klien tanpa socket tersedia sebagai `GoBizClient`, `buildDynamicQris`, `crc16ccitt`.

---

## 🤖 AI (Gemini & Groq) + Toko Otomatis

AI adalah bagian dari library: aktifkan dengan opsi `ai` pada `makeSocket`. **Kunci API dan nama model harus milik Anda sendiri**; library tidak menyertakan kunci maupun model bawaan.

```js
import { makeSocket } from 'corvus-ws'

const sock = makeSocket({
  auth,
  ai: {
    gemini: { apiKey: process.env.GEMINI_API_KEY, model: 'gemini-3.6-flash' },     // model: sesuai dokumentasi Google saat ini
    groq: { apiKey: process.env.GROQ_API_KEY, model: process.env.GROQ_MODEL },      // cadangan bila Gemini gagal/kuota habis
    primary: 'gemini',                                                              // penyedia yang dicoba lebih dulu
    name: 'Corvi',
    persona: 'Kamu kasir toko roti yang ramah dan ringkas.',
    ownerJids: ['628111@s.whatsapp.net'],
  },
})
```

Selesai: bot membalas chat pribadi otomatis. Pakai penyedia lain yang kompatibel OpenAI lewat `providers: [{ provider: 'openai', name: 'x', baseUrl: '...', apiKey, model }]`, atau berikan objek `{ name, chat(req) }` sendiri.

### Kapan AI menjawab

| Opsi `triggers` | Arti |
| --- | --- |
| `private` (default `true`) | Balas chat pribadi |
| `group: 'mention'` (default) | Di grup hanya bila bot di-tag, pesannya dibalas, atau namanya disebut |
| `group: 'prefix'` + `prefixes: ['ai ']` | Di grup hanya pesan berawalan itu |
| `group: 'always'` / `'off'` | Semua pesan / tidak sama sekali |
| `ignorePrefixes` (default `. ! / #`) | Pesan berawalan ini dianggap perintah bot lain dan **tidak** dijawab AI |

Tersedia juga `allow` / `block` (daftar JID), `rateLimit: { messages, windowMs }` (default 8 pesan/menit per pengguna), `memory: { maxMessages, ttlMs, file }`, `vision: true` (teruskan gambar masuk ke model yang mendukung gambar), `maxSteps`, `typing`, `fallbackReply`, dan `onError`.

Perintah kontrol di chat (awalan `!ai`, ubah dengan `controlCommand`): `!ai reset` (siapa saja), serta khusus pemilik: `!ai on`, `!ai off`, `!ai persona <teks>`, `!ai persona reset`, `!ai status`.

### Bersama perintah bot Anda

```js
const sock = makeSocket({ auth, ai: { /* ... */ autoReply: false } })   // matikan pemasangan otomatis

sock.ev.on('messages.upsert', async ({ messages, type }) => {
  for (const m of messages) {
    if (await sock.ai.handle(m)) continue        // true = AI sudah menjawab
    // ... lanjut ke handler perintah Anda
  }
})

const jawaban = await sock.ai.ask({ jid, text: 'rekomendasikan produk', sender: jid })   // pemakaian programatik
sock.enableAi({ /* ... */ })                                                             // atau aktifkan belakangan
```

### Apa yang bisa dilakukan AI (tool)

AI memakai fitur corvus-ws lewat tool, jadi tombol dan media benar-benar terkirim:

| Tool | Fitur |
| --- | --- |
| `send_buttons`, `send_list`, `send_interactive`, `send_carousel` | Tombol, daftar, pesan interaktif (URL/telepon/salin/lokasi), carousel dengan gambar |
| `send_image`, `send_video`, `send_audio`, `send_document` | Media dari URL publik |
| `send_location`, `send_contact`, `send_poll`, `react` | Lokasi, kontak, poll, reaksi |
| `notify_owner`, `get_time` | Teruskan ke pemilik, waktu saat ini |
| `shop_*` | Toko (lihat di bawah) |

Tambah tool sendiri (juga `ownerOnly: true` untuk perintah khusus pemilik):

```js
ai: {
  // ...
  tools: [{
    name: 'cek_ongkir',
    description: 'Hitung ongkir ke kota tujuan',
    parameters: { type: 'object', properties: { kota: { type: 'string' } }, required: ['kota'] },
    async run({ kota }, ctx) { return { kota, ongkir: 15000 } },      // ctx: { sock, jid, sender, isGroup, isOwner, message }
  }],
  rules: ['Selalu tawarkan produk terlaris di akhir jawaban.'],       // aturan tambahan di prompt
}
```

### Toko jual-beli otomatis

```js
ai: {
  // ...
  shop: {
    name: 'Toko Roti',
    products: [
      { id: 'kopi', name: 'Kopi Arabika', price: 25000, category: 'Minuman', stock: 20, image: 'https://example.com/kopi.jpg',
        description: 'Biji pilihan 250g', deliver: 'Kode voucher: ABC-123' },                 // dikirim setelah terbayar
      { id: 'ebook', name: 'Ebook Resep', price: 10000, category: 'Digital',
        deliver: (order, { qty }) => `Unduh: https://dl.example/${order.id}` },              // atau fungsi
    ],                                                                                        // juga boleh: () => ambilDariDatabase()
    payment: { qris: '000201010211...6304ABCD', cacheFile: './gopay_cache.json', merchantName: 'Toko Roti', expiresInMs: 10 * 60_000 },
    storeFile: './shop.json',                        // keranjang & pesanan bertahan saat restart
    ownerJids: ['628111@s.whatsapp.net'],            // diberi tahu saat ada pembayaran
    onPaid: async (order) => { /* catat ke database, dll. */ },
  },
}
```

Alur: pelanggan bertanya/memilih → AI menampilkan menu, detail produk, atau carousel → keranjang → **checkout** (tagihan QRIS dikirim) → pembayaran dicek otomatis ke GoBiz → produk terkirim, stok berkurang, pemilik diberi tahu.

Jaminan di dalam kode:
- Harga, total, dan stok **selalu dari katalog**; AI hanya mengirim ID produk dan jumlah.
- `shop_checkout` wajib `confirm: true` setelah pengguna setuju.
- Status lunas hanya dari riwayat transaksi GoBiz asli; klaim "sudah bayar" dari pengguna tidak dipercaya.
- Tiap pesanan diberi **kode unik** 1–99 Rupiah (matikan dengan `payment.uniqueCode: false`) agar nominal berbeda; satu transaksi tidak bisa melunasi dua pesanan.
- Produk dikirim sekali (idempoten) dan pesanan kedaluwarsa otomatis.
- Alur tombol `shop:menu`, `shop:product:<id>`, `shop:add:<id>`, `shop:cart`, `shop:checkout`, `shop:pay:<order>`, `shop:cancel:<order>`, `shop:orders` berjalan **tanpa memanggil AI**, jadi toko tetap jalan walau kuota API habis.

### Keamanan & Privasi

- Isi pesan pengguna dikirim ke penyedia AI yang Anda pilih (Google / Groq) dan memakai kuota/biaya akun Anda.
- URL media dari AI hanya diunduh bila publik: alamat internal (localhost, jaringan privat, metadata cloud), redirect ke sana, dan berkas besar ditolak.
- Kunci API tidak pernah masuk ke URL, log, atau pesan error.
- Teks pengguna dan hasil tool diperlakukan sebagai data, bukan perintah; tool `ownerOnly` tidak ditawarkan ke selain pemilik.
- Deteksi tag bot di grup bergantung pada data `mentionedJid` dari WhatsApp (mendukung PN dan LID).

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

MIT © corvus-ws.

corvus-ws tidak berafiliasi dengan WhatsApp LLC atau Meta. Dilarang dipakai untuk spam, penipuan, atau aktivitas melanggar hukum.