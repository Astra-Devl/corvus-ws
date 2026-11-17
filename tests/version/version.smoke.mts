import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  DEFAULT_VERSION_SOURCES,
  FileVersionCache,
  MemoryVersionCache,
  VersionError,
  VersionManager,
  assertValidVersion,
  fetchLatestVersion,
  isFresh,
  isValidVersion,
  normalizeVersion,
  parseClientRevision,
  resolveVersion,
  validateVersion,
  type VersionSourceDefinition,
} from '../../src/index.ts'

const ok = (n: string) => console.log(n, 'ok')
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const swBody = (rev: number | string) => `self.__x={"a":1,\\"client_revision\\":${rev},"b":2}`
const response = (body: string, status = 200) => ({ ok: status >= 200 && status < 300, status, text: async () => body }) as unknown as Response

// ---------- parse + validasi ----------
assert.deepEqual(parseClientRevision('{"client_revision":1023223821,"x":1}'), [2, 3000, 1023223821])
assert.deepEqual(parseClientRevision(swBody(42)), [2, 3000, 42])
assert.throws(() => parseClientRevision('no revision here'), VersionError)
assert.throws(() => parseClientRevision('"client_revision":0'), VersionError)
assert.deepEqual(validateVersion([2, 3000, 1]), [])
assert.equal(validateVersion([2, 3000]).length, 1)
assert.equal(validateVersion([2, -1, 3])[0]!.code, 'format')
assert.equal(validateVersion([2.5, 1, 1])[0]!.code, 'format')
assert.equal(validateVersion('2.3000.1').length, 1)
assert.deepEqual(validateVersion([3, 1, 1], { strict: true }).map((i) => i.code), ['implausible', 'implausible'])
assert.equal(validateVersion([2, 3000, 0], { strict: true })[0]!.message, 'revision must be greater than 0')
assert.ok(isValidVersion([1, 2, 3]) && !isValidVersion([1, 2]))
assert.throws(() => assertValidVersion([1, 2]), VersionError)
assert.deepEqual(normalizeVersion('2.3000.1023223821'), [2, 3000, 1023223821])
assert.deepEqual(normalizeVersion([2, 3000, 5]), [2, 3000, 5])
assert.throws(() => normalizeVersion('2.3000'), VersionError)
assert.throws(() => normalizeVersion('a.b.c'), VersionError)
assert.ok(isFresh({ version: [2, 3000, 1], fetchedAt: 1000 }, 500, 1400) && !isFresh({ version: [2, 3000, 1], fetchedAt: 1000 }, 500, 1500) && !isFresh({ version: [2, 3000, 1], fetchedAt: 5000 }, 500, 1000))
ok('parse + validate')

// ---------- fetcher ----------
const calls: Array<{ url: string; headers: Record<string, string> }> = []
const goodFetch = (async (url: string, init?: { headers?: Record<string, string> }) => {
  calls.push({ url, headers: init!.headers! })
  return response(swBody(777))
}) as unknown as typeof fetch
const info = await fetchLatestVersion({ fetch: goodFetch, headers: { 'x-extra': '1' } })
assert.deepEqual(info.version, [2, 3000, 777]); assert.equal(info.source, 'remote'); assert.equal(info.sourceName, 'whatsapp-web')
assert.equal(calls[0]!.url, DEFAULT_VERSION_SOURCES[0]!.url); assert.equal(calls[0]!.headers['x-extra'], '1'); assert.ok(calls[0]!.headers['user-agent'])

const bad: VersionSourceDefinition = { name: 'bad', url: 'https://bad.test', parse: () => { throw new Error('nope') } }
const down: VersionSourceDefinition = { name: 'down', url: 'https://down.test', parse: parseClientRevision }
const good: VersionSourceDefinition = { name: 'good', url: 'https://good.test', parse: parseClientRevision }
const routed = (async (url: string) => (url.includes('down') ? response('x', 503) : response(swBody(9)))) as unknown as typeof fetch
assert.equal((await fetchLatestVersion({ fetch: routed, sources: [down, bad, good] })).sourceName, 'good')
await assert.rejects(fetchLatestVersion({ fetch: routed, sources: [down, bad] }), (e: VersionError) => e instanceof VersionError && e.data!.errors instanceof Array && (e.data!.errors as string[]).length === 2 && /HTTP 503/.test(e.message))
await assert.rejects(fetchLatestVersion({ sources: [] }), /No version sources/)
await assert.rejects(fetchLatestVersion({ fetch: (async () => { throw new Error('boom') }) as unknown as typeof fetch }), /failed/)
const hang = ((_url: string, init: { signal: AbortSignal }) => new Promise((_res, rej) => init.signal.addEventListener('abort', () => rej(init.signal.reason)))) as unknown as typeof fetch
await assert.rejects(fetchLatestVersion({ fetch: hang, timeoutMs: 30 }), /timed out after 30ms/)
await assert.rejects(fetchLatestVersion({ fetch: (async () => response('x'.repeat(8 * 1024 * 1024 + 1))) as unknown as typeof fetch }), /too large/)
ok('fetcher')

// ---------- cache ----------
const mem = new MemoryVersionCache()
assert.equal(await mem.get(), undefined)
await mem.set({ version: [2, 3000, 1], fetchedAt: 5, sourceName: 's' }); assert.deepEqual(await mem.get(), { version: [2, 3000, 1], fetchedAt: 5, sourceName: 's' })
await mem.clear(); assert.equal(await mem.get(), undefined)
const dir = await mkdtemp(join(tmpdir(), 'corvus-version-'))
try {
  const path = join(dir, 'nested', 'version.json')
  const file = new FileVersionCache(path)
  assert.equal(await file.get(), undefined)
  await file.set({ version: [2, 3000, 11], fetchedAt: 123, sourceName: 'whatsapp-web' })
  assert.deepEqual(await file.get(), { version: [2, 3000, 11], fetchedAt: 123, sourceName: 'whatsapp-web' })
  assert.deepEqual(JSON.parse(await readFile(path, 'utf8')).version, [2, 3000, 11])
  await writeFile(path, '{ rusak'); assert.equal(await file.get(), undefined)
  await writeFile(path, JSON.stringify({ version: [1, 2], fetchedAt: 1 })); assert.equal(await file.get(), undefined)
  await writeFile(path, JSON.stringify({ version: [2, 3000, 1], fetchedAt: 'x' })); assert.equal(await file.get(), undefined)
  await file.clear(); assert.equal(await file.get(), undefined); await file.clear()

  // ---------- manager ----------
  let revision = 100
  let fetches = 0
  let failing = false
  const live = (async () => { fetches++; if (failing) throw new Error('offline'); return response(swBody(revision)) }) as unknown as typeof fetch

  const pinned = new VersionManager({ version: [2, 3000, 5], fetch: live })
  assert.deepEqual(await pinned.get(), [2, 3000, 5]); assert.equal(pinned.current!.source, 'config'); assert.equal(fetches, 0)
  assert.throws(() => new VersionManager({ version: [1, 2] as never }), VersionError)

  const updates: Array<[string | undefined, string]> = []
  const errors: string[] = []
  const stale: string[] = []
  const m = new VersionManager({ fetch: live, ttlMs: 60_000 })
  m.ev.on('version.update', (e) => updates.push([e.previous?.version.join('.'), e.current.version.join('.')]))
  m.ev.on('version.error', (e) => errors.push(e.error.message))
  m.ev.on('version.stale', (e) => stale.push(e.info.source))
  const [a, b] = await Promise.all([m.resolve(), m.resolve()])
  assert.equal(a, b); assert.equal(fetches, 1) // permintaan paralel berbagi satu fetch
  assert.equal((await m.resolve()).source, 'remote'); assert.equal(fetches, 1) // masih segar
  revision = 101
  assert.deepEqual((await m.refresh()).version, [2, 3000, 101]); assert.equal(fetches, 2)
  await m.refresh(); assert.equal(updates.length, 2) // versi sama -> tidak ada update baru
  assert.deepEqual(updates, [[undefined, '2.3000.100'], ['2.3000.100', '2.3000.101']])

  // gagal -> pakai data lama
  failing = true
  const staleInfo = await m.refresh()
  assert.deepEqual(staleInfo.version, [2, 3000, 101]); assert.equal(staleInfo.source, 'cache')
  assert.equal(errors.length, 1); assert.deepEqual(stale, ['cache'])
  failing = false

  // cache bersama (file): manager kedua tidak fetch
  const shared = new FileVersionCache(join(dir, 'shared.json'))
  fetches = 0
  const first = new VersionManager({ fetch: live, cache: shared, ttlMs: 60_000 })
  await first.get(); assert.equal(fetches, 1)
  const second = new VersionManager({ fetch: live, cache: shared, ttlMs: 60_000 })
  const fromCache = await second.resolve()
  assert.equal(fromCache.source, 'cache'); assert.equal(fetches, 1); assert.deepEqual(fromCache.version, [2, 3000, 101])
  // cache kedaluwarsa + fetch gagal + staleIfError=false -> error / fallback
  failing = true
  const strict = new VersionManager({ fetch: live, cache: shared, ttlMs: 0, staleIfError: false })
  await assert.rejects(strict.get(), VersionError)
  const withFallback = new VersionManager({ fetch: live, cache: false, fallback: [2, 3000, 1] })
  const fb = await withFallback.resolve(); assert.equal(fb.source, 'fallback'); assert.deepEqual(fb.version, [2, 3000, 1])
  const none = new VersionManager({ fetch: live, cache: false })
  await assert.rejects(none.get(), /Could not determine the client version/)
  failing = false

  // auto refresh
  fetches = 0; revision = 200
  const auto = new VersionManager({ fetch: live, cache: false })
  await auto.get(); auto.startAutoRefresh(25); await sleep(120); auto.stopAutoRefresh()
  const afterStop = fetches; assert.ok(afterStop >= 3, `fetch berulang (${afterStop})`); await sleep(60); assert.equal(fetches, afterStop)
  assert.throws(() => auto.startAutoRefresh(0), VersionError)
  failing = true; auto.startAutoRefresh(10); await sleep(40); auto.dispose() // kegagalan tidak boleh jadi unhandled rejection
  failing = false

  // helper sekali pakai
  assert.deepEqual(await resolveVersion({ fetch: live, cache: false }), [2, 3000, 200])
  assert.deepEqual(await resolveVersion({ version: [2, 3000, 9] }), [2, 3000, 9])
  ok('manager')
} finally {
  await rm(dir, { recursive: true, force: true })
}

console.log('ALL OK'); setTimeout(() => process.exit(0), 20)
