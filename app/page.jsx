'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useCurrency } from '@/components/CurrencyToggle'
import {
  IconMoney, IconRobot, IconVideo, IconShop, IconWrite, IconCode,
  IconChat, IconSearch, IconFlame, IconTrending, IconArrowRight,
  IconLightning, IconTool, IconSpinner, IconGlobe, IconEye
} from '@/components/Icons'

const PILLS = [
  { label: 'Make Money',         Icon: IconMoney,  query: 'make money with AI automation 2024' },
  { label: 'AI Business',        Icon: IconRobot,  query: 'start an AI-powered business from scratch' },
  { label: 'YouTube Automation', Icon: IconVideo,  query: 'faceless YouTube channel automation with AI' },
  { label: 'E-Commerce',         Icon: IconShop,   query: 'dropshipping store that runs itself with AI' },
  { label: 'Content Agency',     Icon: IconWrite,  query: 'AI content agency build and run' },
  { label: 'Dev Tools',          Icon: IconCode,   href: '/devtools' },
  { label: 'Ask Anything',       Icon: IconChat,   href: '/chat' },
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
  const [query, setQuery] = useState('')
  const [trending, setTrending] = useState([])
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(false)
  const [stats, setStats] = useState({ total: 0, views: 0 })
  const [suggestionIndex, setSuggestionIndex] = useState(0)
  const [displayText, setDisplayText] = useState('')
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
      <section className="relative max-w-3xl mx-auto px-4 pt-20 pb-16 text-center">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[480px] h-64 bg-red-600/[0.04] rounded-full blur-3xl pointer-events-none" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 bg-[#141414] border border-[#262626] rounded-full px-4 py-1.5 mb-6 animate-fade-up">
            <span className="w-1.5 h-1.5 bg-green-500 rounded-full pulse-dot" />
            <span className="text-xs text-[#737373] font-medium">Free for everyone · No signup required</span>
          </div>

          <h1 className="text-[40px] md:text-[56px] font-bold mb-4 leading-[1.08] tracking-tight animate-fade-up animate-fade-up-1">
            Your unfair advantage
            <br /><span className="text-red-500">starts here.</span>
          </h1>

          <p className="text-[#737373] text-[15px] mb-10 max-w-lg mx-auto animate-fade-up animate-fade-up-2 leading-relaxed">
            Tools, opportunities, and honest guides for builders everywhere.
          </p>

          <div className="flex gap-2 animate-fade-up animate-fade-up-3">
            <div className="relative flex-1">
              <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#404040] pointer-events-none">
                <IconSearch size={15} />
              </div>
              <input
                ref={inputRef}
                className="w-full bg-[#141414] border border-[#262626] rounded-xl pl-9 pr-9 py-3.5 text-sm text-white placeholder-[#404040] transition-colors"
                placeholder={displayText || 'What do you want to build or earn?'}
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
              />
              {query && (
                <button onClick={() => setQuery('')} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#404040] hover:text-white transition-colors">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                </button>
              )}
            </div>
            <button
              onClick={() => handleSearch()}
              disabled={loading || !query.trim()}
              className="bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white px-5 py-3.5 rounded-xl font-semibold text-sm transition-colors flex items-center gap-2 press"
            >
              {loading ? <IconSpinner size={14} /> : <IconArrowRight size={14} />}
              {loading ? 'Thinking' : 'Explore'}
            </button>
          </div>

          <div className="flex flex-wrap justify-center gap-2 mt-3 animate-fade-up animate-fade-up-4">
            {PILLS.map(({ label, Icon, query: q, href }) => (
              <button
                key={label}
                onClick={() => href ? router.push(href) : handleSearch(q)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#141414] border border-[#262626] hover:border-[#3a3a3a] hover:text-white text-[#737373] rounded-full text-xs transition-all"
              >
                <Icon size={12} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {trending.length > 0 && (
        <section className="max-w-3xl mx-auto px-4 pb-12">
          <div className="flex items-center gap-2 mb-3">
            <IconFlame size={13} className="text-red-500" />
            <span className="text-2xs font-semibold text-[#737373] uppercase tracking-widest">Trending today</span>
          </div>
          <div className="space-y-1.5">
            {trending.map((item, i) => (
              <button
                key={item.slug}
                onClick={() => router.push(`/explore/${item.slug}`)}
                className="w-full flex items-center justify-between bg-[#141414] border border-[#262626] hover:border-[#3a3a3a] hover:bg-[#161616] rounded-xl px-4 py-3 transition-all text-left group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[#2a2a2a] font-mono text-xs w-5 shrink-0">{String(i + 1).padStart(2, '0')}</span>
                  <span className="text-sm text-[#737373] group-hover:text-white transition-colors truncate">{item.query}</span>
                </div>
                <div className="flex items-center gap-1 ml-3 shrink-0 text-[#404040]">
                  <IconEye size={11} />
                  <span className="text-xs font-mono">{(item.views || 0).toLocaleString()}</span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {cards.length > 0 && (
        <section className="max-w-5xl mx-auto px-4 pb-16">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <IconTrending size={13} className="text-[#404040]" />
              <span className="text-2xs font-semibold text-[#737373] uppercase tracking-widest">Recent Results</span>
            </div>
            <button onClick={() => router.push('/opportunities')} className="text-xs text-red-500 hover:text-red-400 transition-colors flex items-center gap-1">
              View all <IconArrowRight size={11} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {cards.map(card => (
              <button
                key={card.slug}
                onClick={() => router.push(`/explore/${card.slug}`)}
                className="bg-[#141414] border border-[#262626] hover:border-[#3a3a3a] rounded-2xl p-5 text-left transition-all group hover:bg-[#161616]"
              >
                <h3 className="font-semibold text-sm mb-3 group-hover:text-red-400 transition-colors line-clamp-2 leading-snug tracking-tight">
                  {card.result?.title || card.query}
                </h3>
                {card.result && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1.5 text-green-400 text-sm font-semibold">
                      <IconMoney size={13} />
                      {format(card.result.income_min || 0)}–{format(card.result.income_max || 0)}
                      <span className="text-[#404040] text-xs font-normal">/{card.result.income_period || 'mo'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[#404040]">
                      <span className="flex items-center gap-1"><IconLightning size={11} />{card.result.start_days}d</span>
                      <span className="flex items-center gap-1"><IconTool size={11} />{format(card.result.monthly_cost || 0)}/mo</span>
                    </div>
                  </div>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {cards.length === 0 && (
        <section className="max-w-3xl mx-auto px-4 pb-16 text-center">
          <div className="bg-[#141414] border border-[#262626] rounded-2xl p-12">
            <div className="w-10 h-10 bg-[#1a1a1a] rounded-xl flex items-center justify-center mx-auto mb-4">
              <IconSearch size={18} className="text-[#404040]" />
            </div>
            <h3 className="font-semibold text-base mb-2 tracking-tight">Be the first to explore</h3>
            <p className="text-[#737373] text-sm">Search for any business idea above.</p>
          </div>
        </section>
      )}

      <div className="border-t border-[#141414] py-5 text-center">
        <p className="text-xs text-[#404040] flex items-center justify-center gap-2 flex-wrap">
          {stats.views > 0 && <><span className="text-[#737373] font-mono">{stats.views.toLocaleString()}</span> explored <span className="text-[#262626]">·</span> <span className="text-[#737373] font-mono">{stats.total}</span> cached <span className="text-[#262626]">·</span></>}
          <span className="text-[#737373]">free forever</span>
          <span className="text-[#262626]">·</span>
          <span className="flex items-center gap-1"><IconGlobe size={11} /> built for the world</span>
        </p>
      </div>
    </main>
  )
}
