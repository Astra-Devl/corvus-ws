'use strict'
/** Build lengkap: bersihkan dist, kompilasi ESM + CJS + types, lalu postbuild. */
const { spawnSync } = require('node:child_process')
const { join } = require('node:path')

const root = join(__dirname, '..')

function tscCommand() {
  try {
    return [process.execPath, [require.resolve('typescript/bin/tsc', { paths: [root] })]]
  } catch {
    return ['tsc', []] // TypeScript global
  }
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', shell: command === 'tsc' && process.platform === 'win32' })
  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

const [tsc, base] = tscCommand()
run(process.execPath, [join(__dirname, 'clean.cjs')])
for (const config of ['tsconfig.esm.json', 'tsconfig.cjs.json', 'tsconfig.types.json']) {
  console.log(`> tsc -p ${config}`)
  run(tsc, [...base, '-p', config])
}
run(process.execPath, [join(__dirname, 'postbuild.cjs')])
console.log('Build complete')
