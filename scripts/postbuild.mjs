// Root package.json memakai "type": "module", jadi output CJS harus ditandai
// agar Node memperlakukan dist/cjs/*.js sebagai CommonJS.
import { writeFileSync } from 'node:fs'

writeFileSync(
  new URL('../dist/cjs/package.json', import.meta.url),
  JSON.stringify({ type: 'commonjs' }, null, 2) + '\n',
)
