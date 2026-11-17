'use strict'
/**
 * Membuat `proto/generated/*.ts` dari `proto/schemas/*.proto`.
 *
 * Jalankan lewat tsx (parser-nya ditulis dalam TypeScript):
 *   tsx scripts/generate-proto.cjs          # tulis ulang file
 *   tsx scripts/generate-proto.cjs --check  # gagal bila file hasil generate sudah usang
 */
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const SCHEMA_DIR = path.join(ROOT, 'proto', 'schemas')
const OUT_DIR = path.join(ROOT, 'proto', 'generated')

const HEADER = (source) =>
  `// File ini dibuat otomatis oleh scripts/generate-proto.cjs dari proto/schemas/${source}.\n` +
  '// JANGAN DIEDIT — ubah file .proto lalu jalankan `npm run proto:generate`.\n' +
  '/* eslint-disable */\n'

const SCALAR_TS = {
  double: 'number',
  float: 'number',
  int32: 'number',
  uint32: 'number',
  sint32: 'number',
  fixed32: 'number',
  sfixed32: 'number',
  int64: 'number | bigint',
  uint64: 'number | bigint',
  sint64: 'number | bigint',
  fixed64: 'number | bigint',
  sfixed64: 'number | bigint',
  bool: 'boolean',
  string: 'string',
  bytes: 'Uint8Array',
}

async function loadModules() {
  const registryMod = await import(path.join(ROOT, 'proto', 'loader', 'proto-registry.ts'))
  const loaderMod = await import(path.join(ROOT, 'proto', 'loader', 'proto-loader.ts'))
  return { ProtoRegistry: registryMod.ProtoRegistry, parseProto: loaderMod.parseProto }
}

function readSchemas() {
  return fs
    .readdirSync(SCHEMA_DIR)
    .filter((name) => name.endsWith('.proto'))
    .sort()
    .map((name) => ({ name, source: fs.readFileSync(path.join(SCHEMA_DIR, name), 'utf8') }))
}

const baseName = (file) => file.replace(/\.proto$/, '')

/** Urutkan file sehingga dependensi (import) muncul lebih dulu. */
function sortByImports(files) {
  const byName = new Map(files.map((f) => [f.name, f]))
  const out = []
  const state = new Map()
  const visit = (file) => {
    if (state.get(file.name) === 'done') return
    if (state.get(file.name) === 'visiting') throw new Error(`Circular import involving ${file.name}`)
    state.set(file.name, 'visiting')
    for (const imp of file.imports) {
      const dep = byName.get(imp)
      if (!dep) throw new Error(`${file.name}: imported file "${imp}" does not exist`)
      visit(dep)
    }
    state.set(file.name, 'done')
    out.push(file)
  }
  files.forEach(visit)
  return out
}

async function generateAll() {
  const { ProtoRegistry, parseProto } = await loadModules()
  const registry = new ProtoRegistry()
  const parsed = readSchemas().map(({ name, source }) => parseProto(source, name))
  parsed.forEach((file) => registry.add(file))
  registry.link()

  const pkg = parsed[0] ? parsed[0].package : ''
  for (const file of parsed) {
    if (file.package !== pkg) throw new Error(`${file.name}: all schemas must share package "${pkg}"`)
  }

  const tsName = (fullName) => (pkg && fullName.startsWith(`${pkg}.`) ? fullName.slice(pkg.length + 1) : fullName).replace(/\./g, '_')
  const fileOf = new Map()
  for (const file of parsed) {
    for (const m of file.messages) fileOf.set(m.fullName, file.name)
    for (const e of file.enums) fileOf.set(e.fullName, file.name)
  }

  const seen = new Map()
  for (const file of parsed) {
    for (const full of [...file.messages.map((m) => m.fullName), ...file.enums.map((e) => e.fullName)]) {
      const key = tsName(full)
      if (seen.has(key)) throw new Error(`TypeScript name clash: ${full} and ${seen.get(key)} -> ${key}`)
      seen.set(key, full)
    }
  }

  const outputs = new Map()
  const ordered = sortByImports(parsed)

  for (const file of ordered) {
    const foreignTypes = new Map() // file -> Set(ts names)
    const refType = (fullName) => {
      const owner = fileOf.get(fullName)
      if (owner !== file.name) {
        const set = foreignTypes.get(owner) ?? new Set()
        set.add(tsName(fullName))
        foreignTypes.set(owner, set)
      }
      return tsName(fullName)
    }
    const fieldType = (type, typeName) => {
      if (type === 'message') return refType(typeName)
      if (type === 'enum') return 'number'
      return SCALAR_TS[type]
    }

    let body = ''
    for (const en of file.enums) {
      const name = tsName(en.fullName)
      const entries = Object.entries(en.values)
        .map(([k, v]) => `  ${k}: ${v},`)
        .join('\n')
      body += `export const ${name} = {\n${entries}\n} as const\nexport type ${name} = (typeof ${name})[keyof typeof ${name}]\n\n`
    }
    for (const message of file.messages) {
      const lines = message.fields.map((f) => {
        let ts
        if (f.map) ts = `Record<string, ${fieldType(f.map.value, f.map.valueTypeName)}>`
        else if (f.label === 'repeated') ts = `Array<${fieldType(f.type, f.typeName)}>`
        else ts = fieldType(f.type, f.typeName)
        const note = f.oneof ? ` // oneof ${f.oneof}` : ''
        return `  ${f.name}?: ${ts} | null${note}`
      })
      body += `export interface ${tsName(message.fullName)} {\n${lines.join('\n')}\n}\n\n`
    }

    const imports = [...foreignTypes.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([owner, names]) => `import type { ${[...names].sort().join(', ')} } from './${baseName(owner)}.js'`)
      .join('\n')

    const descriptorName = `${baseName(file.name)}Descriptor`
    const descriptor = JSON.stringify(file, null, 2)
    const content =
      HEADER(file.name) +
      "import type { FileDescriptor } from '../loader/proto-registry.js'\n" +
      (imports ? `${imports}\n` : '') +
      `\n${body}export const ${descriptorName}: FileDescriptor = ${descriptor}\n`
    outputs.set(`${baseName(file.name)}.ts`, content)
  }

  const names = ordered.map((f) => baseName(f.name))
  const allMessages = ordered.flatMap((f) => f.messages.map((m) => ({ file: baseName(f.name), full: m.fullName, ts: tsName(m.fullName) })))
  const index =
    HEADER('*') +
    "import type { FileDescriptor } from '../loader/proto-registry.js'\n" +
    names.map((n) => `import { ${n}Descriptor } from './${n}.js'`).join('\n') +
    '\n' +
    names.map((n) => `import type * as ${n} from './${n}.js'`).join('\n') +
    '\n\n' +
    names.map((n) => `export * from './${n}.js'`).join('\n') +
    `\n\nexport const PACKAGE = ${JSON.stringify(pkg)}\n\n` +
    `/** Semua file skema, dependensi lebih dulu. */\nexport const descriptors: readonly FileDescriptor[] = [${names.map((n) => `${n}Descriptor`).join(', ')}]\n\n` +
    `/** Nama pendek (nama interface) -> nama lengkap di skema. */\nexport const PROTO_NAMES = {\n${allMessages.map((m) => `  ${m.ts}: ${JSON.stringify(m.full)},`).join('\n')}\n} as const\n\n` +
    `/** Nama pendek -> tipe TypeScript. */\nexport interface ProtoTypes {\n${allMessages.map((m) => `  ${m.ts}: ${m.file}.${m.ts}`).join('\n')}\n}\n\n` +
    'export type ProtoTypeName = keyof ProtoTypes\n'
  outputs.set('index.ts', index)

  return { outputs, registry, files: ordered }
}

async function main() {
  const check = process.argv.includes('--check')
  const { outputs } = await generateAll()
  fs.mkdirSync(OUT_DIR, { recursive: true })

  const stale = []
  for (const [file, content] of outputs) {
    const target = path.join(OUT_DIR, file)
    const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : undefined
    if (current === content) continue
    stale.push(file)
    if (!check) fs.writeFileSync(target, content)
  }
  for (const existing of fs.readdirSync(OUT_DIR)) {
    if (existing.endsWith('.ts') && !outputs.has(existing)) {
      stale.push(existing)
      if (!check) fs.rmSync(path.join(OUT_DIR, existing))
    }
  }

  if (check) {
    if (stale.length > 0) {
      console.error(`proto/generated is out of date (${stale.join(', ')}). Run "npm run proto:generate".`)
      process.exit(1)
    }
    console.log('proto/generated is up to date')
  } else {
    console.log(stale.length ? `Generated: ${stale.join(', ')}` : 'Nothing to update')
  }
}

module.exports = { generateAll, readSchemas, SCHEMA_DIR, OUT_DIR, ROOT }

if (require.main === module) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
