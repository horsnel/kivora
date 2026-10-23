// v5.23.1 — usage-side i18n audit: every t('key') referenced in code must
// exist in all four locale files. (scripts/i18n_audit.mjs only compares
// locales AGAINST EACH OTHER — keys missing from all four slip through and
// leak raw key names into the UI, e.g. the guest banner's "common.close".)
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const ROOT = process.cwd()
const LOCALES = ['en', 'fr', 'sw', 'yo']
const loc = {}
for (const l of LOCALES) loc[l] = JSON.parse(readFileSync(join(ROOT, `lib/i18n/${l}.json`), 'utf8'))

// ── collect t('…') keys from source ──────────────────────────────
const SKIP = new Set(['node_modules', '.next', '.git', 'scripts', 'public'])
const exts = new Set(['.jsx', '.js'])
const keys = new Set()
const keyRe = /\bt\(\s*'([a-z0-9_.]+)'\s*[),]/g

function walk(dir) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e)
    const st = statSync(p)
    if (st.isDirectory()) { if (!SKIP.has(e)) walk(p); continue }
    if (!exts.has(e.slice(-4)) ) continue
    const src = readFileSync(p, 'utf8')
    for (const m of src.matchAll(keyRe)) keys.add(m[1])
  }
}
walk(join(ROOT, 'app'))
walk(join(ROOT, 'components'))
walk(join(ROOT, 'lib'))

// Dynamic keys (t(group.labelKey), t(dynamic)) can't be static-checked
let missing = 0
for (const k of [...keys].sort()) {
  const absent = LOCALES.filter(l => typeof loc[l][k] !== 'string')
  if (absent.length) {
    missing++
    console.log(`MISSING ${k}  (absent in: ${absent.join(', ')})`)
  }
}
console.log(`\n${keys.size} static keys referenced · ${missing} missing`)
process.exit(missing ? 1 : 0)
