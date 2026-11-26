/**
 * Tool bawaan agar AI bisa memakai fitur WhatsApp corvus-ws: tombol, list, carousel, media,
 * lokasi, kontak, reaksi, poll, dan pemberitahuan ke pemilik.
 */
import { fetchPublicBuffer, type SafeFetchOptions } from './safe-fetch.js'
import type { AiTool, AiToolContext } from './types.js'

const str = (v: unknown, max = 1000): string => String(v ?? '').trim().slice(0, max)
const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])

type ButtonArg = { type?: string; text?: string; id?: string; url?: string; phone?: string; code?: string }

function toInteractiveButtons(list: ButtonArg[]): Array<Record<string, unknown>> {
  return list.slice(0, 10).map((b) => {
    const text = str(b.text, 60)
    switch (b.type) {
      case 'url': return { type: 'url', text, url: str(b.url, 2000) }
      case 'call': return { type: 'call', text, phoneNumber: str(b.phone, 30) }
      case 'copy': return { type: 'copy', text, code: str(b.code, 200) }
      case 'location': return { type: 'location', text }
      default: return { type: 'reply', text, id: str(b.id, 256) || text }
    }
  })
}

const buttonItem = {
  type: 'object' as const,
  properties: {
    type: { type: 'string' as const, enum: ['reply', 'url', 'call', 'copy', 'location'], description: 'Jenis tombol (default reply)' },
    text: { type: 'string' as const, description: 'Teks tombol' },
    id: { type: 'string' as const, description: 'ID yang dikirim balik saat ditekan (reply)' },
    url: { type: 'string' as const, description: 'URL (type url)' },
    phone: { type: 'string' as const, description: 'Nomor telepon (type call)' },
    code: { type: 'string' as const, description: 'Teks yang disalin (type copy)' },
  },
  required: ['text'],
}

export interface WhatsAppToolsOptions {
  /** Nonaktifkan tool tertentu menurut nama. */
  disable?: string[]
  fetch?: SafeFetchOptions
  timezone?: string
  /** JID pemilik yang menerima `notify_owner`. */
  ownerJids?: string[]
}

export function createWhatsAppTools(options: WhatsAppToolsOptions = {}): AiTool[] {
  const media = async (ctx: AiToolContext, kind: 'image' | 'video' | 'audio' | 'document', url: unknown, extra: Record<string, unknown> = {}) => {
    const { buffer, mimeType } = await fetchPublicBuffer(str(url, 2000), options.fetch)
    await ctx.sock.sendMessage(ctx.jid, { [kind]: buffer, ...(kind !== 'audio' && { mimetype: mimeType }), ...extra } as never, { quoted: ctx.message })
    return { sent: kind, bytes: buffer.length }
  }

  const tools: AiTool[] = [
    {
      name: 'send_buttons',
      description: 'Kirim pesan dengan tombol balasan cepat (maksimal 3). Dipakai untuk memberi pilihan singkat ke pengguna.',
      parameters: { type: 'object', properties: {
        text: { type: 'string', description: 'Isi pesan' }, footer: { type: 'string' },
        buttons: { type: 'array', maxItems: 3, items: { type: 'object', properties: { id: { type: 'string', description: 'ID tombol' }, text: { type: 'string', description: 'Teks tombol' } }, required: ['id', 'text'] } },
      }, required: ['text', 'buttons'] },
      async run(a, ctx) {
        const buttons = arr<{ id?: string; text?: string }>(a.buttons).slice(0, 3).map((b) => ({ id: str(b.id, 256) || str(b.text, 60), text: str(b.text, 60) }))
        if (buttons.length === 0) throw new Error('buttons kosong')
        await ctx.sock.sendMessage(ctx.jid, { buttons: { text: str(a.text, 1000), ...(a.footer ? { footer: str(a.footer, 60) } : {}), buttons } } as never, { quoted: ctx.message })
        return { sent: 'buttons', count: buttons.length }
      },
    },
    {
      name: 'send_list',
      description: 'Kirim menu daftar pilihan (list) dengan beberapa bagian dan baris. Cocok untuk katalog atau menu panjang.',
      parameters: { type: 'object', properties: {
        title: { type: 'string' }, text: { type: 'string' }, buttonText: { type: 'string', description: 'Teks tombol pembuka daftar' },
        sections: { type: 'array', items: { type: 'object', properties: { title: { type: 'string' }, rows: { type: 'array', items: { type: 'object', properties: { id: { type: 'string' }, title: { type: 'string' }, description: { type: 'string' } }, required: ['id', 'title'] } } }, required: ['title', 'rows'] } },
      }, required: ['title', 'text', 'buttonText', 'sections'] },
      async run(a, ctx) {
        const sections = arr<{ title?: string; rows?: Array<{ id?: string; title?: string; description?: string }> }>(a.sections).slice(0, 10).map((s) => ({
          title: str(s.title, 24) || 'Menu',
          rows: arr<{ id?: string; title?: string; description?: string }>(s.rows).slice(0, 10).map((r) => ({ id: str(r.id, 200), title: str(r.title, 24), ...(r.description ? { description: str(r.description, 72) } : {}) })),
        }))
        await ctx.sock.sendMessage(ctx.jid, { list: { title: str(a.title, 60), text: str(a.text, 1000), buttonText: str(a.buttonText, 20), sections } } as never, { quoted: ctx.message })
        return { sent: 'list', sections: sections.length }
      },
    },
    {
      name: 'send_interactive',
      description: 'Kirim pesan interaktif (native flow) dengan tombol: balasan, buka URL, telepon, salin teks, atau minta lokasi. Boleh menyertakan gambar header dari URL.',
      parameters: { type: 'object', properties: {
        body: { type: 'string' }, title: { type: 'string' }, footer: { type: 'string' }, imageUrl: { type: 'string', description: 'URL gambar header (opsional)' },
        buttons: { type: 'array', maxItems: 5, items: buttonItem },
      }, required: ['body', 'buttons'] },
      async run(a, ctx) {
        const header: Record<string, unknown> = { ...(a.title ? { title: str(a.title, 60) } : {}) }
        if (a.imageUrl) header.image = (await fetchPublicBuffer(str(a.imageUrl, 2000), options.fetch)).buffer
        await ctx.sock.sendMessage(ctx.jid, { interactive: { body: str(a.body, 1000), ...(a.footer ? { footer: str(a.footer, 60) } : {}), ...(Object.keys(header).length ? { header } : {}), buttons: toInteractiveButtons(arr<ButtonArg>(a.buttons)) } } as never, { quoted: ctx.message })
        return { sent: 'interactive' }
      },
    },
    {
      name: 'send_carousel',
      description: 'Kirim carousel kartu geser (maksimal 10). Tiap kartu boleh punya gambar dari URL dan tombol. Cocok untuk menampilkan beberapa produk.',
      parameters: { type: 'object', properties: {
        body: { type: 'string' },
        cards: { type: 'array', maxItems: 10, items: { type: 'object', properties: { title: { type: 'string' }, body: { type: 'string' }, imageUrl: { type: 'string' }, buttons: { type: 'array', maxItems: 3, items: buttonItem } }, required: ['body'] } },
      }, required: ['cards'] },
      async run(a, ctx) {
        const cards = await Promise.all(arr<{ title?: string; body?: string; imageUrl?: string; buttons?: ButtonArg[] }>(a.cards).slice(0, 10).map(async (c) => ({
          ...(c.title || c.imageUrl ? { header: { ...(c.title ? { title: str(c.title, 60) } : {}), ...(c.imageUrl ? { image: (await fetchPublicBuffer(str(c.imageUrl, 2000), options.fetch)).buffer } : {}) } } : {}),
          body: str(c.body, 300) || '-', buttons: toInteractiveButtons(arr<ButtonArg>(c.buttons)),
        })))
        await ctx.sock.sendMessage(ctx.jid, { carousel: { ...(a.body ? { body: str(a.body, 500) } : {}), cards } } as never, { quoted: ctx.message })
        return { sent: 'carousel', cards: cards.length }
      },
    },
    { name: 'send_image', description: 'Kirim gambar dari URL publik.', parameters: { type: 'object', properties: { url: { type: 'string' }, caption: { type: 'string' } }, required: ['url'] },
      run: (a, ctx) => media(ctx, 'image', a.url, a.caption ? { caption: str(a.caption, 1000) } : {}) },
    { name: 'send_video', description: 'Kirim video dari URL publik.', parameters: { type: 'object', properties: { url: { type: 'string' }, caption: { type: 'string' } }, required: ['url'] },
      run: (a, ctx) => media(ctx, 'video', a.url, a.caption ? { caption: str(a.caption, 1000) } : {}) },
    { name: 'send_audio', description: 'Kirim audio dari URL publik; voice=true untuk voice note.', parameters: { type: 'object', properties: { url: { type: 'string' }, voice: { type: 'boolean' } }, required: ['url'] },
      run: (a, ctx) => media(ctx, 'audio', a.url, a.voice ? { ptt: true } : {}) },
    { name: 'send_document', description: 'Kirim dokumen/berkas dari URL publik.', parameters: { type: 'object', properties: { url: { type: 'string' }, fileName: { type: 'string' }, caption: { type: 'string' } }, required: ['url'] },
      run: (a, ctx) => media(ctx, 'document', a.url, { fileName: str(a.fileName, 120) || 'berkas', ...(a.caption ? { caption: str(a.caption, 1000) } : {}) }) },
    {
      name: 'send_location', description: 'Kirim lokasi (titik peta).',
      parameters: { type: 'object', properties: { latitude: { type: 'number', minimum: -90, maximum: 90 }, longitude: { type: 'number', minimum: -180, maximum: 180 }, name: { type: 'string' }, address: { type: 'string' } }, required: ['latitude', 'longitude'] },
      async run(a, ctx) {
        const lat = Number(a.latitude), lon = Number(a.longitude)
        if (!(Math.abs(lat) <= 90) || !(Math.abs(lon) <= 180)) throw new Error('koordinat tidak valid')
        await ctx.sock.sendMessage(ctx.jid, { location: { degreesLatitude: lat, degreesLongitude: lon, ...(a.name ? { name: str(a.name, 100) } : {}), ...(a.address ? { address: str(a.address, 200) } : {}) } } as never, { quoted: ctx.message })
        return { sent: 'location' }
      },
    },
    {
      name: 'send_contact', description: 'Kirim kartu kontak.',
      parameters: { type: 'object', properties: { name: { type: 'string' }, phone: { type: 'string', description: 'Nomor internasional tanpa +, mis. 62812...' } }, required: ['name', 'phone'] },
      async run(a, ctx) {
        const phone = str(a.phone, 20).replace(/\D/g, ''), name = str(a.name, 80).replace(/[\r\n]/g, ' ')
        if (phone.length < 8) throw new Error('nomor tidak valid')
        const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL;type=CELL;type=VOICE;waid=${phone}:+${phone}\nEND:VCARD`
        await ctx.sock.sendMessage(ctx.jid, { contacts: [{ displayName: name, vcard }] } as never, { quoted: ctx.message })
        return { sent: 'contact' }
      },
    },
    {
      name: 'send_poll', description: 'Buat poll/jajak pendapat.',
      parameters: { type: 'object', properties: { question: { type: 'string' }, options: { type: 'array', maxItems: 12, items: { type: 'string' } }, single: { type: 'boolean', description: 'Hanya boleh pilih satu' } }, required: ['question', 'options'] },
      async run(a, ctx) {
        const values = arr<string>(a.options).map((o) => str(o, 100)).filter(Boolean).slice(0, 12)
        if (values.length < 2) throw new Error('minimal 2 pilihan')
        await ctx.sock.sendMessage(ctx.jid, { poll: { name: str(a.question, 200), values, ...(a.single === true ? { selectableCount: 1 } : {}) } } as never)
        return { sent: 'poll' }
      },
    },
    {
      name: 'react', description: 'Beri reaksi emoji pada pesan pengguna.',
      parameters: { type: 'object', properties: { emoji: { type: 'string' } }, required: ['emoji'] },
      async run(a, ctx) {
        if (!ctx.message) throw new Error('tidak ada pesan untuk direaksi')
        await ctx.sock.sendMessage(ctx.jid, { react: { key: ctx.message.key, text: str(a.emoji, 8) } } as never)
        return { reacted: true }
      },
    },
    {
      name: 'notify_owner', description: 'Teruskan pesan penting ke pemilik bot (mis. pelanggan butuh bantuan manusia atau komplain).',
      parameters: { type: 'object', properties: { message: { type: 'string' } }, required: ['message'] },
      async run(a, ctx) {
        const owners = options.ownerJids ?? []
        if (owners.length === 0) return { delivered: false, reason: 'pemilik belum dikonfigurasi' }
        const who = ctx.pushName ? `${ctx.pushName} (${ctx.sender})` : ctx.sender
        for (const o of owners) await ctx.sock.sendMessage(o, { text: `📨 *Dari AI bot*\nPengguna: ${who}\nChat: ${ctx.jid}\n\n${str(a.message, 1500)}` } as never)
        return { delivered: true }
      },
    },
    {
      name: 'get_time', description: 'Waktu dan tanggal saat ini.',
      run: () => ({ now: new Intl.DateTimeFormat('id-ID', { timeZone: options.timezone ?? 'Asia/Jakarta', dateStyle: 'full', timeStyle: 'long' }).format(new Date()) }),
    },
  ]
  const off = new Set(options.disable ?? [])
  return tools.filter((t) => !off.has(t.name))
}
