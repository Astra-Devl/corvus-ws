'use strict'
/**
 * Memeriksa skema di proto/schemas dan memastikan proto/generated sinkron.
 * Jalankan lewat tsx:  tsx scripts/validate-proto.cjs
 */
const fs = require('node:fs')
const path = require('node:path')
const { generateAll, OUT_DIR } = require('./generate-proto.cjs')

async function main() {
  const problems = []
  const { outputs, files } = await generateAll() // sekaligus memeriksa import, siklus, dan referensi tipe

  for (const file of files) {
    for (const message of file.messages) {
      const numbers = new Map()
      const names = new Set()
      for (const field of message.fields) {
        const where = `${file.name}: ${message.fullName}.${field.name}`
        if (numbers.has(field.number)) problems.push(`${where}: field number ${field.number} already used by "${numbers.get(field.number)}"`)
        numbers.set(field.number, field.name)
        if (names.has(field.name)) problems.push(`${where}: duplicate field name`)
        names.add(field.name)
        if (field.number >= 19000 && field.number <= 19999) problems.push(`${where}: field number ${field.number} is reserved by protobuf`)
        if (field.packed && field.label !== 'repeated') problems.push(`${where}: only repeated fields can be packed`)
      }
      for (const oneof of message.oneofs) {
        if (!message.fields.some((f) => f.oneof === oneof)) problems.push(`${file.name}: ${message.fullName}: oneof "${oneof}" is empty`)
      }
    }
    for (const en of file.enums) {
      if (Object.keys(en.values).length === 0) problems.push(`${file.name}: enum ${en.fullName} has no values`)
    }
  }

  for (const [name, content] of outputs) {
    const target = path.join(OUT_DIR, name)
    if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== content) {
      problems.push(`proto/generated/${name} is out of date — run "npm run proto:generate"`)
    }
  }
  for (const existing of fs.existsSync(OUT_DIR) ? fs.readdirSync(OUT_DIR) : []) {
    if (existing.endsWith('.ts') && !outputs.has(existing)) problems.push(`proto/generated/${existing} has no matching schema`)
  }

  if (problems.length > 0) {
    for (const problem of problems) console.error(`✗ ${problem}`)
    process.exit(1)
  }
  const messages = files.reduce((n, f) => n + f.messages.length, 0)
  console.log(`✓ ${files.length} schemas, ${messages} messages, generated files are up to date`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
