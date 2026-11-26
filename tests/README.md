# Tests

Skrip smoke test berbasis `node:assert` (bukan framework). Jalankan dengan `tsx`:

```bash
npx tsx tests/utils/utils-and-internal.smoke.mts
npx tsx tests/integration/make-socket.smoke.mts   # butuh devDependency `ws`
```

`make-socket.smoke.mts` menjalankan server WebSocket tiruan (handshake Noise sebagai responder,
node terenkripsi) dan seorang lawan bicara dengan kripto asli, lalu menguji alur utuh: login,
pesan masuk/keluar, ack/receipt, grup, panggilan, presence, pairing QR, reconnect, dan logout.

Catatan: server tiruan berbicara format yang diasumsikan library ini, jadi tes ini membuktikan
konsistensi internal, bukan interoperabilitas dengan server WhatsApp sungguhan.
Mengasumsikan `package.json` memakai `"type": "module"`.
