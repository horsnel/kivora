import en from './en.json'
import fr from './fr.json'
import sw from './sw.json'
import yo from './yo.json'

export const LANGUAGES = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'fr', label: 'French', nativeLabel: 'Français' },
  { code: 'sw', label: 'Swahili', nativeLabel: 'Kiswahili' },
  { code: 'yo', label: 'Yoruba', nativeLabel: 'Yorùbá' },
]

const translations = { en, fr, sw, yo }

export function t(key, lang = 'en', vars = {}) {
  let value = translations[lang]?.[key] || translations.en?.[key] || key
  // Simple variable interpolation: {name} → vars.name
  Object.entries(vars).forEach(([k, v]) => {
    value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), v)
  })
  return value
}

export function detectLanguage() {
  if (typeof window === 'undefined') return 'en'
  const saved = localStorage.getItem('kv_lang')
  if (saved && translations[saved]) return saved
  const browserLang = navigator.language?.slice(0, 2)
  if (translations[browserLang]) return browserLang
  return 'en'
}
