'use client'
import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
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

  // Memoize the t function so it only changes when lang changes.
  // Without this, t gets a new identity on every provider render,
  // which causes all consumers to re-render unnecessarily during navigation.
  const t = useCallback((key, vars = {}) => {
    return translate(key, lang, vars)
  }, [lang])

  // Memoize the entire context value to prevent cascading re-renders.
  // This is critical for navigation stability — without useMemo, every
  // render of LanguageProvider creates a new context object, triggering
  // re-renders of ALL consumers (every page uses useTranslation).
  const value = useMemo(() => ({ lang, setLang, t, languages: LANGUAGES }), [lang, t])

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}
