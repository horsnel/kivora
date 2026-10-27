// v5.27 — additive i18n keys for the persistent agent workspace panel.
// 10 new vfs.* keys × 4 locales, then parity check.
import { readFileSync, writeFileSync } from 'node:fs'

const DIR = '/home/z/my-project/kivora/lib/i18n'
const LOCALES = ['en', 'fr', 'sw', 'yo']

const KEYS = {
  'vfs.title': {
    en: 'Workspace files',
    fr: 'Fichiers de travail',
    sw: 'Faili za eneo la kazi',
    yo: 'Àwọn fáìlì ibi iṣẹ́',
  },
  'vfs.subtitle': {
    en: 'Saved by the AI · persistent',
    fr: "Enregistrés par l'IA · persistants",
    sw: 'Kuhifadhiwa na AI · kudumu',
    yo: 'Tí AI fipamọ́ · wọ́n ń péré',
  },
  'vfs.empty': {
    en: 'No files yet — anything the AI creates in the terminal is saved here automatically.',
    fr: 'Aucun fichier — tout ce que l’IA crée dans le terminal est enregistré ici automatiquement.',
    sw: 'Hakuna faili bado — chochote kinachotengenezwa na AI kwenye terminal kinahifadhiwa hapa kiotomatiki.',
    yo: 'Kò sí fáìlì síbẹ̀síbẹ̀ — ohunkóhun tí AI bá ṣe nínú tẹ́mínálì yóò fipamọ́ ibí láìrò̀yè.',
  },
  'vfs.signin': {
    en: 'Sign in to keep the files the AI creates for you.',
    fr: 'Connectez-vous pour conserver les fichiers que l’IA crée pour vous.',
    sw: 'Ingia ili kuhifadhi faili ambazo AI hutengeneza kwako.',
    yo: 'Wọlé kí o lè fi àwọn fáìlì tí AI ṣe fún ọ pamọ́.',
  },
  'vfs.signin_cta': {
    en: 'Sign in',
    fr: 'Se connecter',
    sw: 'Ingia',
    yo: 'Wọlé',
  },
  'vfs.download': {
    en: 'Download',
    fr: 'Télécharger',
    sw: 'Pakua',
    yo: 'Gbàsílẹ̀',
  },
  'vfs.delete': {
    en: 'Delete',
    fr: 'Supprimer',
    sw: 'Futa',
    yo: 'Nu kúrò',
  },
  'vfs.deleted': {
    en: 'File deleted',
    fr: 'Fichier supprimé',
    sw: 'Faili imefutwa',
    yo: 'Fáìlì ti nu',
  },
  'vfs.error': {
    en: 'Something went wrong',
    fr: 'Une erreur est survenue',
    sw: 'Kuna hitilafu imetokea',
    yo: 'Àṣìṣe kan ṣẹlẹ̀',
  },
  'vfs.hint': {
    en: 'Files persist across sessions — the AI can re-read them anytime.',
    fr: 'Les fichiers persistent entre les sessions — l’IA peut les relire à tout moment.',
    sw: 'Faili hudumu kwenye kipindi kipya — AI inaweza kusoma tena wakati wowote.',
    yo: 'Àwọn fáìlì ń wọ́n láàárọ̀ ìgbà — AI lè tún ka wọ́n nígbà gbogbo.',
  },
}

let out = []
for (const loc of LOCALES) {
  const f = `${DIR}/${loc}.json`
  const data = JSON.parse(readFileSync(f, 'utf8'))
  let added = 0
  for (const [k, v] of Object.entries(KEYS)) {
    if (!(k in data)) {
      data[k] = v[loc]
      added++
    }
  }
  writeFileSync(f, JSON.stringify(data, null, 2) + '\n')
  out.push(`${loc}: +${added} → ${Object.keys(data).length} keys`)
}
console.log(out.join('\n'))

// parity check
const sets = LOCALES.map((l) => new Set(Object.keys(JSON.parse(readFileSync(`${DIR}/${l}.json`, 'utf8')))))
const allSame = sets.every((s) => s.size === sets[0].size && [...s].every((k) => sets[0].has(k)))
console.log(allSame ? `parity OK — ${sets[0].size} keys × ${LOCALES.length} locales` : 'PARITY FAIL')
process.exit(allSame ? 0 : 1)
