// v5.24.7 — additive i18n keys for the browser drawer chrome.
// 3 new browser.* keys × 4 locales, then parity check.
import { readFileSync, writeFileSync } from 'node:fs'

const DIR = '/home/z/my-project/kivora/lib/i18n'
const LOCALES = ['en', 'fr', 'sw', 'yo']

const KEYS = {
  'browser.resize_handle': {
    en: 'Drag to resize the browser',
    fr: 'Faites glisser pour redimensionner le navigateur',
    sw: 'Buruta ili kubadilisha ukubwa wa kivinjari',
    yo: 'Fà á láti yí wínrà àsààyàn padà',
  },
  'browser.maximize': {
    en: 'Full height',
    fr: 'Pleine hauteur',
    sw: 'Urefu kamili',
    yo: 'Gíga pípọ́',
  },
  'browser.shrink': {
    en: 'Shrink',
    fr: 'Réduire',
    sw: 'Punguza',
    yo: 'Dinku',
  },
}

let out = []
for (const loc of LOCALES) {
  const p = `${DIR}/${loc}.json`
  const data = JSON.parse(readFileSync(p, 'utf8'))
  for (const [k, v] of Object.entries(KEYS)) {
    if (data[k] && data[k] !== v[loc]) out.push(`  overwrite ${loc} ${k}: ${JSON.stringify(data[k])} -> ${JSON.stringify(v[loc])}`)
    data[k] = v[loc]
  }
  writeFileSync(p, JSON.stringify(data, null, 2) + '\n')
  out.push(`${loc}: ${Object.keys(data).length} keys`)
}

// parity check
const counts = LOCALES.map((l) => Object.keys(JSON.parse(readFileSync(`${DIR}/${l}.json`, 'utf8'))).length)
const ok = counts.every((c) => c === counts[0])
out.push(`parity: ${counts.join('/')} -> ${ok ? 'OK' : 'MISMATCH'}`)
console.log(out.join('\n'))
process.exit(ok ? 0 : 1)
