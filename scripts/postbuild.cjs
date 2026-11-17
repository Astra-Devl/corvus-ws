'use strict'
/**
 * Dijalankan setelah semua tsc selesai.
 * - Root package.json memakai "type": "module", jadi output CJS harus ditandai
 *   agar Node memperlakukan dist/cjs/**.js sebagai CommonJS.
 * - Pastikan semua entry point yang dijanjikan package.json benar-benar ada.
 */
const { existsSync, writeFileSync } = require('node:fs')
const { join } = require('node:path')

const root = join(__dirname, '..')
writeFileSync(join(root, 'dist', 'cjs', 'package.json'), JSON.stringify({ type: 'commonjs' }, null, 2) + '\n')

const expected = [
  'dist/esm/src/index.js',
  'dist/cjs/src/index.js',
  'dist/types/src/index.d.ts',
  'dist/esm/proto/index.js',
  'dist/cjs/proto/index.js',
  'dist/types/proto/index.d.ts',
]
const missing = expected.filter((file) => !existsSync(join(root, file)))
if (missing.length > 0) {
  console.error(`Build output is incomplete, missing: ${missing.join(', ')}`)
  process.exit(1)
}
