'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useCurrency } from '@/components/CurrencyToggle'
import { useTranslation } from '@/components/LanguageProvider'
import {
  IconMoney, IconRobot, IconVideo, IconShop, IconWrite, IconCode,
  IconChat, IconSearch, IconFlame, IconTrending, IconArrowRight,
  IconLightning, IconTool, IconSpinner, IconGlobe, IconEye
} from '@/components/Icons'

const PILL_KEYS = [
  { key: 'make_money',  Icon: IconMoney,  query: 'make money with AI automation 2024' },
  { key: 'ai_business', Icon: IconRobot,  query: 'start an AI-powered business from scratch' },
  { key: 'youtube',     Icon: IconVideo,  query: 'faceless YouTube channel automation with AI' },
  { key: 'ecommerce',   Icon: IconShop,   query: 'dropshipping store that runs itself with AI' },
  { key: 'content',     Icon: IconWrite,  query: 'AI content agency build and run' },
  { key: 'dev_tools',   Icon: IconCode,   href: '/devtools' },
  { key: 'ask',         Icon: IconChat,   href: '/chat' },
]

const SUGGESTIONS = [
  'How to build a WhatsApp bot business',
  'Faceless YouTube empire with ElevenLabs',
  'Sell automation workflows on Gumroad',
  'Build a micro-SaaS in a weekend',
  'AI content agency for 20 clients',
  'Affiliate blog with Claude writing',
]

export default function HomePage() {
  const router = useRouter()
  const { format } = useCurrency()
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [trending, setTrending] = useState([])
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({ total: 0, views: 0 })
  const [suggestionIndex, setSuggestionIndex] = useState(0)
  const [displayText, setDisplayText] = useState('')
  const [dataLoading, setDataLoading] = useState(true)
  const inputRef = useRef(null)

  useEffect(() => { loadData() }, [])

  useEffect(() => {
    const suggestion = SUGGESTIONS[suggestionIndex]
    let i = 0
    setDisplayText('')
    const interval = setInterval(() => {
      if (i <= suggestion.length) { setDisplayText(suggestion.slice(0, i)); i++ }
      else { clearInterval(interval); setTimeout(() => setSuggestionIndex(p => (p + 1) % SUGGESTIONS.length), 2500) }
    }, 42)
    return () => clearInterval(interval)
  }, [suggestionIndex])

  async function loadData() {
    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/explore_cache?select=slug,query,result,views&order=views.desc&limit=12`,
        { headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}` } }
      )
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) {
        setTrending(data.slice(0, 5))
        setCards(data.slice(0, 6))
        setStats({ total: data.length, views: data.reduce((s, d) => s + (d.views || 0), 0) })
      }
    } catch (_) {}
    setDataLoading(false)
  }

  async function handleSearch(searchQuery) {
    const q = (searchQuery || query).trim()
    if (!q || loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/explore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q })
      })
      const data = await res.json()
      if (data.slug) router.push(`/explore/${data.slug}`)
    } catch (_) {}
    setLoading(false)
  }

  return (
    <main className="min-h-screen bg-[#0a0a0a]">
      <section className="relative max-w-5xl mx-auto px-4 sm:px-6 pt-16 sm:pt-20 pb-12 sm:pb-16 text-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[320px] sm:w-[480px] h-64 bg-red-600/[0.04] rounded-full blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 bg-[#141414] border border-[#262626] rounded-full px-3 sm:px-4 py-1.5 mb-4 sm:mb-6 animate-fade-up">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full pulse-dot" />
            <span className="text-caption font-medium">{t('home.badge')}</span>
          </div>

          <h1 className="text-display-xl sm:text-[40px] md:text-[56px] font-semibold mb-3 sm:mb-4 leading-[1.1] sm:leading-[1.08] tracking-tight animate-fade-up animate-fade-up-1">
            {t('home.title1')}
            <br /><span className="bg-gradient-to-r from-[#FF6B6B] to-[#FF8E53] bg-clip-text text-transparent">{t('home.title2')}</span>
          </h1>

          <p className="text-muted text-body mb-6 sm:mb-10 max-w-xl mx-auto animate-fade-up animate-fade-up-2 leading-relaxed">
            {t('home.subtitle')}
          </p>

          {/* Search row — larger, more prominent */}
          <div className="flex flex-col sm:flex-row gap-2 animate-fade-up animate-fade-up-3">
            <div className="relative flex-1">
              <div className="absolute left-6 top-1/2 -translate-y-1/2 text-muted2 pointer-events-none">
                <IconSearch size={24} />
              </div>
              <input
                ref={inputRef}
                className="w-full bg-[#141414] border border-[#262626] rounded-2xl pl-16 pr-16 py-10 sm:py-12 text-2xl sm:text-3xl text-white placeholder-muted2 transition-all focus:border-red-500/60 focus:shadow-[0_0_0_3px_rgba(220,38,38,0.1),0_0_24px_rgba(220,38,38,0.06)]"
                placeholder={displayText || t('home.placeholder')}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
              {query && (
                <button onClick={() => setQuery('')} className="absolute right-6 top-1/2 -translate-y-1/2 text-muted2 hover:text-white transition-colors">
                  <svg width={14} height={14} viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </button>
              )}
            </div>
            <button
              onClick={() => handleSearch()}
              disabled={loading || !query.trim()}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-6 py-4 rounded-xl font-semibold text-body transition-colors flex items-center justify-center gap-2 press"
            >
              {loading ? <IconSpinner size={14} /> : <IconArrowRight size={14} />}
              {loading ? t('home.thinking') : t('home.explore')}
            </button>
          </div>

          <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 mt-3 animate-fade-up animate-fade-up-4">
            {PILL_KEYS.map(({ key, Icon, query: q, href }) => (
              <button
                key={key}
                onClick={() => href ? router.push(href) : handleSearch(q)}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-[#141414] border border-[#262626] hover:border-[#3a3a3a] hover:text-white text-muted rounded-full text-caption transition-all"
              >
                <Icon size={12} />
                {t(`home.pill.${key}`)}
              </button>
            ))}
          </div>
        </div>
      </section>

      {dataLoading ? (
        <>
          <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-8 sm:pb-12">
            <div className="flex items-center gap-2 mb-3">
              <div className="skeleton w-3 h-3 rounded-sm" />
              <div className="skeleton w-24 h-3 rounded" />
            </div>
            <div className="space-y-1.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="skeleton border border-[#262626] rounded-xl px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="skeleton w-4 h-3 rounded" />
                    <div className="skeleton flex-1 h-3 rounded" style={{ maxWidth: `${60 + i * 8}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-12 sm:pb-16">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="skeleton w-3 h-3 rounded-sm" />
                <div className="skeleton w-28 h-3 rounded" />
              </div>
              <div className="skeleton w-16 h-3 rounded" />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton border border-[#262626] rounded-xl p-5 h-32" />
              ))}
            </div>
          </section>
        </>
      ) : (
        <>
          {trending.length > 0 && (
            <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-8 sm:pb-12">
              <div className="flex items-center gap-2 mb-3">
                <IconFlame size={14} className="text-red-500" />
                <span className="text-caption font-semibold text-muted uppercase tracking-widest">{t('home.trending')}</span>
              </div>
              <div className="space-y-1.5">
                {trending.map((item, i) => (
                  <button
                    key={item.slug}
                    onClick={() => router.push(`/explore/${item.slug}`)}
                    className="w-full flex items-center justify-between bg-[#141414] border border-white/[0.06] hover:border-white/[0.1] hover:bg-[#161616] rounded-xl px-4 sm:px-5 py-3.5 transition-all text-left group"
                  >
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <span className="text-[#2a2a2a] font-mono text-caption w-5 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                      <span className="text-body text-muted group-hover:text-white transition-colors truncate">{item.query}</span>
                    </div>
                    <div className="flex items-center gap-1 ml-2 sm:ml-3 shrink-0 text-muted2">
                      <IconEye size={12} />
                      <span className="text-caption font-mono">{(item.views || 0).toLocaleString()}</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          )}

          {cards.length > 0 && (
            <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-12 sm:pb-16">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <div className="flex items-center gap-2">
                  <IconTrending size={14} className="text-muted2" />
                  <span className="text-caption font-semibold text-muted uppercase tracking-widest">{t('home.recent')}</span>
                </div>
                <button onClick={() => router.push('/opportunities')} className="text-caption text-red-500 hover:text-red-400 transition-colors flex items-center gap-1">
                  {t('home.view_all')} <IconArrowRight size={12} />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {cards.map(card => (
                  <button
                    key={card.slug}
                    onClick={() => router.push(`/explore/${card.slug}`)}
                    className="bg-[#141414] border border-white/[0.06] rounded-xl p-6 text-left transition-all group hover:-translate-y-0.5 hover:border-white/[0.1] hover:bg-[#161616]"
                  >
                    <h3 className="font-semibold text-body mb-3 group-hover:text-red-400 transition-colors line-clamp-2 leading-snug tracking-tight text-[#737373]">
                      {card.result?.title || card.query}
                    </h3>
                    {card.result && (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5 text-slate-400 text-body font-medium">
                          <IconMoney size={14} />
                          {format(card.result.income_min || 0)}–{format(card.result.income_max || 0)}
                          <span className="text-muted2 text-caption font-normal">/{card.result.income_period || 'mo'}</span>
                        </div>
                        <div className="flex items-center gap-3 text-caption text-muted2">
                          <span className="flex items-center gap-1"><IconLightning size={12} />{card.result.start_days}d</span>
                          <span className="flex items-center gap-1"><IconTool size={12} />{format(card.result.monthly_cost || 0)}/mo</span>
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </section>
          )}

          {cards.length === 0 && (
            <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-12 sm:pb-16 text-center">
              <div className="bg-[#141414] rounded-xl p-8 sm:p-12">
                <div className="w-10 h-10 bg-[#1a1a1a] rounded-xl flex items-center justify-center mx-auto mb-4">
                  <IconSearch size={20} className="text-muted2" />
                </div>
                <h3 className="font-semibold text-headline-sm mb-2 tracking-tight text-[#737373]">{t('home.empty_title')}</h3>
                <p className="text-muted text-body">{t('home.empty_desc')}</p>
              </div>
            </section>
          )}
        </>
      )}

      <div className="border-t border-[#141414] py-4 sm:py-5 text-center">
        <p className="text-caption text-muted2 flex items-center justify-center gap-1.5 sm:gap-2 flex-wrap">
          {stats.views > 0 && <><span className="text-muted font-mono">{stats.views.toLocaleString()}</span> {t('home.stats.explored')} <span className="text-[#262626]">·</span> <span className="text-muted font-mono">{stats.total}</span> {t('home.stats.cached')} <span className="text-[#262626]">·</span></>}
          <span className="text-muted">{t('home.stats.free_forever')}</span>
          <span className="text-[#262626]">·</span>
          <span className="flex items-center gap-1"><IconGlobe size={12} /> {t('home.stats.built_for_world')}</span>
        </p>
      </div>
    </main>
  )
}
