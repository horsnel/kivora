// v5.18 — inject new i18n keys into all four locale files (en/fr/sw/yo).
// Flat key space, alphabetically merged to match the existing file layout.
// Idempotent: re-running only fills keys that are missing.
const fs = require('fs')
const path = require('path')

const DIR = path.join(__dirname, '..', 'lib', 'i18n')

const KEYS = {
  en: {
    'common.ok': 'OK',
    'home.err.credits': 'Out of credits',
    'home.err.rate': 'Too many requests',
    'home.err.engine': 'Engine at capacity',
    'home.err.network': 'Connection problem',
    'home.err.generic': 'Could not explore',
    'chat.date.pinned': 'Pinned',
    'chat.session.subtitle': 'What would you like to do with this conversation?',
    'chat.session.pin': 'Pin',
    'chat.session.unpin': 'Unpin',
    'chat.session.rename': 'Rename',
    'chat.session.rename_title': 'Rename conversation',
    'chat.session.rename_save': 'Save',
    'chat.session.name_placeholder': 'Conversation name',
    'chat.session.share': 'Share',
    'chat.session.delete': 'Delete',
    'chat.session.shared': 'Conversation copied — paste it anywhere',
  },
  fr: {
    'common.ok': 'OK',
    'home.err.credits': 'Crédits épuisés',
    'home.err.rate': 'Trop de requêtes',
    'home.err.engine': 'Moteur saturé',
    'home.err.network': 'Problème de connexion',
    'home.err.generic': 'Exploration impossible',
    'chat.date.pinned': 'Épinglées',
    'chat.session.subtitle': 'Que voulez-vous faire avec cette conversation ?',
    'chat.session.pin': 'Épingler',
    'chat.session.unpin': 'Détacher',
    'chat.session.rename': 'Renommer',
    'chat.session.rename_title': 'Renommer la conversation',
    'chat.session.rename_save': 'Enregistrer',
    'chat.session.name_placeholder': 'Nom de la conversation',
    'chat.session.share': 'Partager',
    'chat.session.delete': 'Supprimer',
    'chat.session.shared': 'Conversation copiée — collez-la où vous voulez',
  },
  sw: {
    'common.ok': 'Sawa',
    'home.err.credits': 'Mikopo imeisha',
    'home.err.rate': 'Maombi mengi mno',
    'home.err.engine': 'Injini imejaa kwa sasa',
    'home.err.network': 'Shida ya muunganisho',
    'home.err.generic': 'Haiwezi kuchunguza',
    'chat.date.pinned': 'Zilizopiniwa',
    'chat.session.subtitle': 'Unataka kufanya nini na mazungumzo haya?',
    'chat.session.pin': 'Pinia',
    'chat.session.unpin': 'Ondoa pini',
    'chat.session.rename': 'Badilisha jina',
    'chat.session.rename_title': 'Badilisha jina la mazungumzo',
    'chat.session.rename_save': 'Hifadhi',
    'chat.session.name_placeholder': 'Jina la mazungumzo',
    'chat.session.share': 'Shiriki',
    'chat.session.delete': 'Futa',
    'chat.session.shared': 'Mazungumzo yamenakiliwa — bandika popote',
  },
  yo: {
    'common.ok': 'Ó dára',
    'home.err.credits': 'Kirẹ́dììtì ti tán',
    'home.err.rate': 'Ìbẹ̀rẹ̀ pọ̀ jù',
    'home.err.engine': 'Ẹ̀rọ náà ti kún',
    'home.err.network': 'Ìṣòró ìbánisọrọ',
    'home.err.generic': 'Kò lè ṣàwárí',
    'chat.date.pinned': 'Tí a pìn',
    'chat.session.subtitle': 'Kí o fẹ́ ṣe nípa ìjíròyìn yìí?',
    'chat.session.pin': 'Pìn',
    'chat.session.unpin': 'Yọ pìn kúrò',
    'chat.session.rename': 'Yí orúkọ padà',
    'chat.session.rename_title': 'Yí orúkọ ìjíròyìn padà',
    'chat.session.rename_save': 'Fipámúlẹ̀',
    'chat.session.name_placeholder': 'Orúkọ ìjíròyìn',
    'chat.session.share': 'Pín',
    'chat.session.delete': 'Nu kúrò',
    'chat.session.shared': 'Ìjíròyìn ti dáakọ — lẹ̀ mọ́ ibíkíbi',
  },
}

let failures = 0
for (const [lang, keys] of Object.entries(KEYS)) {
  const file = path.join(DIR, `${lang}.json`)
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  let added = 0
  for (const [k, v] of Object.entries(keys)) {
    if (data[k] === undefined) { data[k] = v; added++ }
  }
  const sorted = {}
  for (const k of Object.keys(data).sort()) sorted[k] = data[k]
  fs.writeFileSync(file, JSON.stringify(sorted, null, 2) + '\n')
  console.log(`${lang}: +${added} keys (total ${Object.keys(sorted).length})`)
  if (added < Object.keys(keys).length) {
    console.log(`  note: ${Object.keys(keys).length - added} already existed`)
  }
}
if (failures) process.exit(1)
console.log('i18n injection complete')
