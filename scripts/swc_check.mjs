#!/usr/bin/env node
// swc_check.mjs — real syntax validation for JSX files (node --check skips JSX).
// Uses Next.js's bundled SWC (@swc/core is not a direct dependency).
// Usage: node scripts/swc_check.mjs file1.jsx file2.jsx ...
import { readFileSync } from 'fs'

let transformSync
try {
  ;({ transformSync } = await import('@swc/core'))
} catch {
  ;({ transformSync } = await import('next/dist/build/swc/index.js'))
}

const files = process.argv.slice(2)
let bad = 0
for (const f of files) {
  try {
    await transformSync(readFileSync(f, 'utf8'), { jsc: { parser: { syntax: 'ecmascript', jsx: true } }, filename: f })
    console.log('OK  ', f)
  } catch (e) {
    bad++
    console.log('FAIL', f, '\n    ', String(e.message).slice(0, 300))
  }
}
process.exit(bad ? 1 : 0)
