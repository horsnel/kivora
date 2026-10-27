#!/usr/bin/env node
// ════════════════════════════════════════════════════════════════════
// add_v528_i18n.mjs — v5.28 workspace-in-terminal keys, all 4 locales,
// inserted into the vfs.* block right after vfs.hint (v5.27 pattern).
// Verifies 4-way parity + {n}/{size} placeholders afterwards.
// ════════════════════════════════════════════════════════════════════
import { readFileSync, writeFileSync } from 'node:fs'

const FILES = {
  en: 'lib/i18n/en.json',
  fr: 'lib/i18n/fr.json',
  sw: 'lib/i18n/sw.json',
  yo: 'lib/i18n/yo.json',
}

// key → per-locale value
const NEW = {
  'vfs.refresh': {
    en: 'Refresh',
    fr: 'Actualiser',
    sw: 'Onyesha upya',
    yo: 'Ìtúnṣe',
  },
  'vfs.count': {
    en: '{n} files · {size}',
    fr: '{n} fichiers · {size}',
    sw: 'faili {n} · {size}',
    yo: 'fáìlì {n} · {size}',
  },
}

let changed = 0
for (const [lang, file] of Object.entries(FILES)) {
  const raw = readFileSync(file, 'utf8')
  const lines = raw.split('\n')
  const out = []
  let inserted = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const m = /^(\s*)"vfs\.hint":/.exec(line)
    if (!m) {
      out.push(line)
      continue
    }
    const indent = m[1]
    const todo = Object.entries(NEW).filter(([key]) => !raw.includes(`"${key}":`))
    if (!todo.length) {
      out.push(line)
      continue
    }
    // anchor needs a trailing comma if it doesn't already have one
    out.push(line.trimEnd().endsWith(',') ? line : `${line.trimEnd()},`)
    todo.forEach(([key, per], idx) => {
      const isLast = idx === todo.length - 1
      // peek the NEXT original line: if it closes the object, the final
      // inserted line must NOT carry a trailing comma (strict JSON)
      const nextLine = (lines[i + 1] || '').trim()
      const closes = nextLine.startsWith('}')
      const comma = isLast && closes ? '' : ','
      out.push(`${indent}${JSON.stringify(key)}: ${JSON.stringify(per[lang])}${comma}`)
    })
    inserted += todo.length
  }
  if (inserted) {
    writeFileSync(file, out.join('\n'))
    changed += inserted
    console.log(`${lang}: +${inserted} key(s)`)
  } else {
    console.log(`${lang}: already up to date`)
  }
}

// ── verify: parity + placeholder shape ──────────────────────────────
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const all = Object.fromEntries(Object.entries(FILES).map(([l, f]) => [l, JSON.parse(readFileSync(f, 'utf8'))]))
const counts = Object.entries(all).map(([l, d]) => `${l}=${Object.keys(d).length}`)
console.log('key counts:', counts.join(' '), `(changed=${changed})`)
const base = Object.keys(all.en).length
let ok = true
for (const [l, d] of Object.entries(all)) {
  if (Object.keys(d).length !== base) {
    console.error(`  ✗ ${l} has ${Object.keys(d).length} keys, en has ${base}`)
    ok = false
  }
  for (const key of Object.keys(NEW)) {
    if (typeof d[key] !== 'string') {
      console.error(`  ✗ ${l} missing ${key}`)
      ok = false
    }
  }
}
for (const l of ['fr', 'sw', 'yo']) {
  if (!all.l?.['vfs.count'] && !all[l]['vfs.count'].includes('{n}')) {
    console.error(`  ✗ ${l} vfs.count lost its {n} placeholder`)
    ok = false
  }
}
console.log(ok ? 'PARITY OK' : 'PARITY FAILED')
process.exit(ok ? 0 : 1)
