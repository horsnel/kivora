'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/components/LanguageProvider'
import { supabasePublic } from '@/lib/supabase'
import { IconArrowRight, IconLightning, IconCode, IconMoney, IconBulb } from '@/components/Icons'

// ── Suggestion pills ──
const SUGGESTIONS = [
  { key: 'home.pill.build_saas', query: 'Help me build a SaaS', icon: IconCode },
  { key: 'home.pill.write_code', query: 'Write a Python script', icon: IconLightning },
  { key: 'home.pill.explain', query: 'Explain machine learning', icon: IconBulb },
  { key: 'home.pill.earn', query: 'How can I earn money online', icon: IconMoney },
]

export default function HomePage() {
  const router = useRouter()
  const { t } = useTranslation()
  const [user, setUser] = useState(null)
  const [aiQuery, setAiQuery] = useState('')
  const [inputFocused, setInputFocused] = useState(false)

  useEffect(() => {
    if (!supabasePublic) return
    supabasePublic.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  const displayName = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || null

  function getGreeting() {
    const h = new Date().getHours()
    if (h < 12) return t('discover.greeting.morning')
    if (h < 18) return t('discover.greeting.afternoon')
    return t('discover.greeting.evening')
  }

  function handleAiSubmit() {
    const q = aiQuery.trim()
    if (!q) return
    router.push(`/chat?q=${encodeURIComponent(q)}`)
  }

  function handleSuggestionClick(query) {
    router.push(`/chat?q=${encodeURIComponent(query)}`)
  }

  return (
    <main className="h-full flex flex-col bg-[#0a0a0a]">
      {/* Centered content — Claude/Replit style */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8 -mt-16">
        {/* Greeting */}
        <div className="text-center mb-8 animate-fade-up">
          {displayName ? (
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-2">
              {getGreeting()}, <span className="text-red-500">{displayName}</span>
            </h1>
          ) : (
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-2">
              {t('home.ask_ai')}
            </h1>
          )}
          <p className="text-[#737373] text-sm sm:text-base max-w-md mx-auto">
            {t('discover.greeting.subtitle')}
          </p>
        </div>

        {/* Chat input — centered, full-width cap */}
        <div className={`w-full max-w-2xl transition-all duration-300 animate-fade-up ${inputFocused ? 'scale-[1.01]' : ''}`}>
          <div className="bg-[#141414] border border-[#262626] rounded-2xl p-3 sm:p-4 transition-colors focus-within:border-red-500/30 focus-within:bg-[#161616]">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={aiQuery}
                onChange={e => setAiQuery(e.target.value)}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) handleAiSubmit() }}
                placeholder={t('home.ask_placeholder')}
                className="flex-1 bg-transparent text-[15px] text-[#e2e2e2] placeholder-[#525252] outline-none py-2.5 px-1"
                autoFocus
              />
              <button
                onClick={handleAiSubmit}
                disabled={!aiQuery.trim()}
                className="w-9 h-9 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-[#1a1a1a] disabled:opacity-40 flex items-center justify-center text-white disabled:text-[#525252] transition-all press shrink-0"
              >
                <IconArrowRight size={15} />
              </button>
            </div>
          </div>

          {/* Suggestion pills */}
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {SUGGESTIONS.map(pill => {
              const PillIcon = pill.icon
              return (
                <button
                  key={pill.key}
                  onClick={() => handleSuggestionClick(pill.query)}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-[#141414] border border-[#262626] rounded-xl text-xs sm:text-[13px] text-[#a3a3a3] hover:text-white hover:border-[#3a3a3a] hover:bg-[#1a1a1a] transition-all press"
                >
                  <PillIcon size={13} className="text-[#525252]" />
                  {t(pill.key)}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Footer note */}
      <div className="text-center pb-6 animate-fade-up">
        <p className="text-[11px] text-[#333]">
          Kivora AI can make mistakes. Consider checking important information.
        </p>
      </div>
    </main>
  )
}
