#!/usr/bin/env node
// Run every scripts/test_*.mjs suite with the right conventions:
//  - @/ alias imports need --experimental-loader ./scripts/loader_v53021.mjs
//  - tests that read files relative to scripts/ run with cwd=scripts
// Prints a per-suite pass/fail grid (v5.30.33 regression check).
import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const files = readdirSync('scripts')
  .filter(f => f.startsWith('test_') && f.endsWith('.mjs'))
  .sort()

const results = []
for (const f of files) {
  const src = readFileSync(join('scripts', f), 'utf8')
  const needsLoader = /from '@\//.test(src)
  const needsScriptsCwd = /readFileSync\('\.\.\//.test(src) || /readFileSync\("\.\.\//.test(src)
  const args = needsLoader
    ? ['--experimental-loader', './scripts/loader_v53021.mjs', join('scripts', f)]
    : [join('scripts', f)]
  const r = spawnSync('node', args, {
    timeout: 120_000,
    encoding: 'utf8',
    cwd: needsScriptsCwd ? 'scripts' : '.',
  })
  results.push({ f, ok: r.status === 0, code: r.status })
  console.log(`${r.status === 0 ? 'PASS' : 'FAIL'}  ${f}${needsLoader ? ' (loader)' : ''}${needsScriptsCwd ? ' (cwd=scripts)' : ''}`)
}
const passFiles = results.filter(r => r.ok).length
console.log(`\n${passFiles}/${results.length} suites passed`)
console.log('Failed:', results.filter(r => !r.ok).map(r => r.f).join(', ') || 'none')
