'use client'
import { createContext, useContext, useState, useEffect } from 'react'
import { t as translate, detectLanguage, LANGUAGES } from '@/lib/i18n'

const LanguageContext = createContext({
  lang: 'en',
  setLang: () => {},
  t: (key) => key,
  languages: LANGUAGES,
})

export function useTranslation() {
  return useContext(LanguageContext)
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState('en')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const detected = detectLanguage()
    setLang(detected)
    setMounted(true)
  }, [])

  useEffect(() => {
    if (mounted && typeof window !== 'undefined') {
      localStorage.setItem('kv_lang', lang)
    }
  }, [lang, mounted])

  function t(key, vars = {}) {
    return translate(key, lang, vars)
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, languages: LANGUAGES }}>
      {children}
    </LanguageContext.Provider>
  )
}
