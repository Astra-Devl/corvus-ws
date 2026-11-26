import assert from 'node:assert/strict'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import * as U from '../../src/utils/index.ts'
import { FeatureFlags, checkCompatibility, assertCompatible, collectDiagnostics, formatDiagnostics } from '../../src/index.ts'
import { createSocket, ValidationError, TimeoutError } from '../../src/core/index.ts'
import { VERSION, USER_AGENT } from '../../src/version.ts'
const ok = (n: string) => console.log(n, 'ok')

// ---------- jid ----------
assert.deepEqual(U.jidDecode('62812:5@s.whatsapp.net'), { user: '62812', server: 's.whatsapp.net', device: 5 }); assert.equal(U.jidDecode('tanpa-at'), undefined); assert.equal(U.jidDecode('a:x@s.whatsapp.net')!.device, undefined)
assert.deepEqual([U.jidEncode('62', 's.whatsapp.net', 0), U.jidEncode('62', 's.whatsapp.net', 3)], ['62@s.whatsapp.net', '62:3@s.whatsapp.net'])
assert.equal(U.jidNormalizedUser('62812_1:5@s.whatsapp.net'), '62812@s.whatsapp.net'); assert.equal(U.jidNormalizedUser('status@broadcast'), 'status@broadcast'); assert.equal(U.jidUser('62812:5@lid'), '62812')
assert.ok(U.isSameUser('a:1@s.whatsapp.net', 'a:9@s.whatsapp.net')); assert.ok(!U.isSameUser('a@s.whatsapp.net', 'a@lid'))
assert.deepEqual(['a@s.whatsapp.net', 'x@g.us', 'status@broadcast', '1@newsletter', 'a@lid', 'x@zzz'].map(U.jidKind), ['user', 'group', 'broadcast', 'newsletter', 'user', 'unknown'])
assert.ok(U.isJidStatusBroadcast('status@broadcast') && U.isLidUser('1@lid') && U.isJidGroup('1-2@g.us') && U.isJidNewsletter('1@newsletter') && U.isJidUser('1@s.whatsapp.net') && U.isJidBroadcast('x@broadcast'))
assert.equal(U.phoneToJid('+62 812-3456-7890'), '6281234567890@s.whatsapp.net'); assert.throws(() => U.phoneToJid('12'), RangeError); assert.equal(U.jidToPhone('6281@s.whatsapp.net'), '6281'); assert.equal(U.jidToPhone('1@lid'), undefined)
ok('jid')

// ---------- buffer / stream ----------
assert.equal(U.toBuffer('hai').toString(), 'hai'); assert.deepEqual(U.toBuffer(new Uint8Array([1, 2]).buffer), Buffer.from([1, 2])); assert.deepEqual(U.toBuffer(new Uint8Array([9, 8, 7]).subarray(1)), Buffer.from([8, 7]))
assert.ok(U.equalBytes(Buffer.from('ab'), Buffer.from('ab')) && !U.equalBytes(Buffer.from('ab'), Buffer.from('ac')) && !U.equalBytes(Buffer.from('a'), Buffer.from('ab')))
assert.equal(U.bytesToHex(Buffer.from([0xde, 0xad])), 'dead'); assert.deepEqual(U.hexToBytes('DEAD'), Buffer.from([0xde, 0xad])); assert.throws(() => U.hexToBytes('abc'), RangeError); assert.throws(() => U.hexToBytes('zz'), RangeError)
assert.deepEqual(U.fromBase64Url(U.toBase64Url(Buffer.from([251, 255, 254]))), Buffer.from([251, 255, 254])); assert.ok(!/[+/=]/.test(U.toBase64Url(Buffer.from([251, 255, 254]))))
assert.deepEqual(U.uintToBytes(258, 3), Buffer.from([0, 1, 2])); assert.equal(U.bytesToUint(Buffer.from([0, 1, 2])), 258); assert.throws(() => U.uintToBytes(256, 1), RangeError); assert.throws(() => U.uintToBytes(-1, 2), RangeError); assert.throws(() => U.bytesToUint(Buffer.alloc(7)), RangeError)
const big = Buffer.alloc(200_000, 7)
assert.deepEqual(await U.streamToBuffer(U.bufferToStream(big, 1000)), big); await assert.rejects(U.streamToBuffer(U.bufferToStream(big), 1000), U.StreamTooLargeError)
const hs = U.createHashingStream(); const out: Buffer[] = []; hs.on('data', (c) => out.push(c)); await pipeline(U.bufferToStream(big), hs)
assert.deepEqual(Buffer.concat(out), big); assert.equal(hs.length, big.length); assert.equal(hs.digest().toString('hex'), (await import('node:crypto')).createHash('sha256').update(big).digest('hex'))
await assert.rejects(pipeline(Readable.from([Buffer.alloc(10), Buffer.alloc(10)]), U.createLimitStream(15), new (await import('node:stream')).Writable({ write: (_c, _e, cb) => cb() })), U.StreamTooLargeError)
ok('buffer + stream')

// ---------- mutex / semaphore ----------
{
  const m = new U.Mutex(); const order: number[] = []
  await Promise.all([1, 2, 3].map((n) => m.runExclusive(async () => { order.push(n); await U.sleep(10 - n * 2); order.push(n * 10) })))
  assert.deepEqual(order, [1, 10, 2, 20, 3, 30]); assert.equal(m.isLocked, false)
  await assert.rejects(m.runExclusive(() => { throw new Error('x') }), /x/); assert.equal(await m.runExclusive(() => 'masih jalan'), 'masih jalan')   // gagal tidak mengunci selamanya
  const km = new U.KeyedMutex(); const log: string[] = []
  await Promise.all([km.run('a', async () => { log.push('a1'); await U.sleep(20); log.push('a2') }), km.run('a', async () => { log.push('a3') }), km.run('b', async () => { log.push('b1') })])
  assert.deepEqual(log, ['a1', 'b1', 'a2', 'a3'])                                                                                        // key beda paralel, key sama berurutan
  const sem = new U.Semaphore(2); let active = 0, peak = 0
  await Promise.all(Array.from({ length: 6 }, () => sem.run(async () => { peak = Math.max(peak, ++active); await U.sleep(5); active-- }))); assert.equal(peak, 2); assert.throws(() => new U.Semaphore(0), RangeError)
  ok('mutex')
}

// ---------- cache ----------
{
  let now = 0; const c = new U.TTLCache<string, number>({ ttlMs: 100, maxSize: 3, now: () => now })
  c.set('a', 1).set('b', 2).set('c', 3); c.get('a'); c.set('d', 4)                       // 'b' paling lama tak terpakai -> terbuang
  assert.deepEqual(['a', 'b', 'c', 'd'].map((k) => c.get(k)), [1, undefined, 3, 4]); assert.equal(c.size, 3)
  now = 150; assert.equal(c.get('a'), undefined); assert.equal(c.size, 0); c.set('x', 1, 1000); now = 500; assert.ok(c.has('x'))
  let loads = 0; const slow = () => U.sleep(10).then(() => ++loads)
  const [v1, v2] = await Promise.all([c.getOrLoad('k', slow), c.getOrLoad('k', slow)]); assert.deepEqual([v1, v2, loads], [1, 1, 1]); assert.equal(await c.getOrLoad('k', slow), 1)
  await assert.rejects(c.getOrLoad('bad', () => Promise.reject(new Error('gagal'))), /gagal/); assert.equal(await c.getOrLoad('bad', async () => 9), 9)   // kegagalan tidak di-cache
  ok('cache')
}

// ---------- retry / sleep ----------
{
  assert.deepEqual([1, 2, 3, 4, 5].map((n) => U.backoffDelay(n, { delayMs: 100, maxDelayMs: 1000, jitter: 0 })), [100, 200, 400, 800, 1000]); assert.equal(U.backoffDelay(1, { delayMs: 100, jitter: 0.5, random: () => 0 }), 50)
  let calls = 0; const seen: number[] = []
  assert.equal(await U.retry(async (a) => { calls++; if (a < 3) throw new Error('belum'); return 'ok' }, { delayMs: 1, jitter: 0, onRetry: (_e, a) => seen.push(a) }), 'ok'); assert.deepEqual([calls, seen], [3, [1, 2]])
  calls = 0; await assert.rejects(U.retry(async () => { calls++; throw new Error('selalu') }, { retries: 2, delayMs: 1 }), /selalu/); assert.equal(calls, 3)
  calls = 0; await assert.rejects(U.retry(async () => { calls++; throw new Error('fatal') }, { retries: 5, delayMs: 1, shouldRetry: () => false }), /fatal/); assert.equal(calls, 1)
  const ac = new AbortController(); const p = U.retry(async () => { throw new Error('x') }, { retries: 10, delayMs: 50, signal: ac.signal }); setTimeout(() => ac.abort(), 20); await assert.rejects(p, U.AbortError)
  await assert.rejects(U.sleep(1000, AbortSignal.abort()), U.AbortError); const t0 = Date.now(); await U.sleep(30); assert.ok(Date.now() - t0 >= 25)
  ok('retry')
}

// ---------- helpers / validation ----------
{
  await assert.rejects(U.withTimeout(U.sleep(100), 10, 'tugas'), (e: any) => e instanceof TimeoutError && /tugas timed out after 10ms/.test(e.message)); assert.equal(await U.withTimeout(Promise.resolve(5), 50), 5)
  const calls: number[] = []; const d = U.debounce((n: number) => calls.push(n), 20); d(1); d(2); d(3); await U.sleep(50); assert.deepEqual(calls, [3]); d(4); d.cancel(); await U.sleep(40); assert.deepEqual(calls, [3]); d(5); d.flush(); assert.deepEqual(calls, [3, 5])
  let n = 0; const o = U.once(() => ++n); o(); o(); assert.equal(n, 1); const df = U.defer<number>(); setTimeout(() => df.resolve(7), 5); assert.equal(await df.promise, 7)
  assert.deepEqual(U.chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]); assert.throws(() => U.chunk([1], 0), RangeError); assert.deepEqual(U.unique([1, 1, 2]), [1, 2]); assert.equal(U.unixTimestamp(1_700_000_999), 1_700_000); assert.ok(U.isPromiseLike(Promise.resolve()) && !U.isPromiseLike({}))
  assert.throws(() => U.assertNonEmptyString('nama', ' '), (e: any) => e instanceof ValidationError && e.data.name === 'nama'); U.assertNonEmptyString('n', 'x')
  assert.throws(() => U.assertPositiveInteger('n', 0), /between 1/); assert.throws(() => U.assertPositiveInteger('n', 1.5), ValidationError); assert.throws(() => U.assertPositiveInteger('n', 11, 10), /1 and 10/); U.assertPositiveInteger('n', 5, 10)
  assert.throws(() => U.assertInRange('x', 5, 1, 4), ValidationError); assert.throws(() => U.assertInRange('x', NaN, 1, 4), ValidationError); assert.throws(() => U.assertOneOf('mode', 'z', ['a', 'b']), /one of: a, b/)
  assert.throws(() => U.assertJid('j', 'bukan-jid'), /must be a JID/); assert.throws(() => U.assertJid('j', 'a@s.whatsapp.net', ['group']), /group JID/); U.assertJid('j', 'x@g.us', ['group']); assert.equal(U.clamp(15, 0, 10), 10)
  assert.ok(U.isPlainObject({}) && U.isPlainObject(Object.create(null)) && !U.isPlainObject([]) && !U.isPlainObject(new Date()) && !U.isPlainObject(null))
  ok('helpers + validation')
}

// ---------- logger ----------
{
  const lines: any[] = []; const log = U.createLogger({ level: 'info', name: 'uji', write: (l) => lines.push(JSON.parse(l)), time: () => 'T' })
  log.debug('disembunyikan'); log.info({ jid: 'a@s.whatsapp.net', mediaKey: Buffer.alloc(32), nested: { private: 'rahasia', ok: 1, bytes: new Uint8Array(4) } }, 'halo'); log.info('hanya pesan'); log.warn(new Error('boom', { cause: new Error('akar') }))
  assert.equal(lines.length, 3); assert.deepEqual(lines[0], { level: 'info', time: 'T', name: 'uji', jid: 'a@s.whatsapp.net', mediaKey: '[redacted]', nested: { private: '[redacted]', ok: 1, bytes: '[Uint8Array 4 bytes]' }, msg: 'halo' })
  assert.equal(lines[1].msg, 'hanya pesan'); assert.deepEqual([lines[2].level, lines[2].err.message, lines[2].err.cause.message], ['warn', 'boom', 'akar'])
  const child = log.child!({ socket: 's1' }); child.error({ x: 1 }); assert.deepEqual([lines[3].socket, lines[3].name, lines[3].x], ['s1', 'uji', 1])
  const quiet: string[] = []; const silent = U.createLogger({ level: 'silent', write: (l) => quiet.push(l) }); silent.error('x'); assert.equal(quiet.length, 0)
  const trace: any[] = []; U.createLogger({ level: 'trace', write: (l) => trace.push(JSON.parse(l)) }).trace({ a: 1 }); assert.equal(trace[0].level, 'trace')
  const circ: any = { a: 1 }; circ.self = { deep: { deeper: { deepest: { tooDeep: { x: 1 } } } } }; U.createLogger({ write: (l) => assert.ok(l.includes('[Object]')) }).info(circ)
  const sock = createSocket({ logger: U.createLogger({ write: (l) => lines.push(JSON.parse(l)) }) }); assert.ok(typeof sock.logger.child === 'function')              // cocok dengan antarmuka Logger
  ok('logger')
}

// ---------- internal ----------
{
  const f = new FeatureFlags({}, undefined); assert.ok(f.isEnabled('receive.sendReceipts')); assert.ok(!f.isEnabled('tidak-ada'))
  const e = new FeatureFlags({ 'receive.nackOnDecryptError': true }, 'receive.sendReceipts=false, baru , -receive.nackOnDecryptError'); assert.deepEqual([e.isEnabled('receive.sendReceipts'), e.isEnabled('baru'), e.isEnabled('receive.nackOnDecryptError')], [false, true, true])   // opsi > env
  e.set('receive.sendReceipts', true); assert.ok(e.isEnabled('receive.sendReceipts')); assert.equal(typeof e.all()['baru'], 'boolean')
  const rep = await checkCompatibility(); assert.deepEqual([rep.ok, rep.issues, rep.node === process.versions.node], [true, [], true]); assert.deepEqual(Object.keys(rep.optional), ['ws', 'sharp', 'ffmpeg']); assert.equal((await assertCompatible()).ok, true)
  const s = createSocket({}); const d = collectDiagnostics({ id: s.id, state: s.state, config: s.config, modules: s.modules, ev: s.ev }); assert.deepEqual([d.version, d.status, d.store, d.pendingQueries], [VERSION, 'idle', undefined, undefined])
  assert.ok(!JSON.stringify(d).includes('auth')); assert.match(formatDiagnostics(d), /corvus-ws 0\.1\.0.*\nsocket .*: idle/); assert.equal(USER_AGENT, `corvus-ws/${VERSION}`)
  ok('internal')
}
console.log('ALL OK'); setTimeout(() => process.exit(0), 20)
