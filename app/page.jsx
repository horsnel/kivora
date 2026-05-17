'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import {
  IconMoney, IconCode, IconChat, IconBook, IconGlobe, IconArrowRight,
  IconCheck, IconTrending, IconLightning, IconSearch, IconTool
} from '@/components/Icons'

const FEATURES = [
  {
    Icon: IconSearch,
    title: 'Opportunity Engine',
    desc: 'Type any idea — get a 5-layer guide with real costs, failure analysis, tool stack, and step-by-step action plan.',
  },
  {
    Icon: IconChat,
    title: 'AI Chat',
    desc: 'Ask anything about building a business, automating work, or learning a skill. Powered by Groq. Always free.',
  },
  {
    Icon: IconBook,
    title: 'StudyDesk',
    desc: 'Homework helper, essay outliner, research summarizer, citation generator, and coding practice — all in one.',
  },
  {
    Icon: IconCode,
    title: 'Dev Tools',
    desc: 'Code explainer, regex generator, JSON formatter, README builder, SQL writer, and API analyzer.',
  },
  {
    Icon: IconGlobe,
    title: 'Built for the world',
    desc: 'Auto-detects your country. Shows prices in your currency. Recommends tools that work without a VPN.',
  },
  {
    Icon: IconMoney,
    title: 'Honest income guides',
    desc: 'Real monthly costs, real failure reasons, real tool stacks. No hype. No upsells. Just signal.',
  },
]

const STATS = [
  { value: '6', label: 'Free tools' },
  { value: '400+', label: 'Opportunity guides' },
  { value: '11', label: 'Currencies supported' },
  { value: '$0', label: 'Forever free' },
]

const TESTIMONIALS = [
  { quote: 'Found a WhatsApp bot opportunity I\'d never considered. Had clients within 3 weeks.', name: 'Emeka O.', location: 'Lagos, Nigeria' },
  { quote: 'The dev tools alone are worth bookmarking. Code explainer saved me hours.', name: 'Priya S.', location: 'Bangalore, India' },
  { quote: 'Finally a platform that doesn\'t pretend everyone earns in dollars and has a US card.', name: 'Kwame A.', location: 'Accra, Ghana' },
]

export default function WelcomePage() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  function handleSearch() {
    if (query.trim()) router.push(`/home?q=${encodeURIComponent(query.trim())}`)
    else router.push('/home')
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">

      {/* ── Hero ───────────────────────────────────── */}
      <section className="relative min-h-[85vh] sm:min-h-screen flex flex-col items-center justify-center px-5 sm:px-6 text-center">
        {/* background glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] sm:w-[600px] h-[300px] sm:h-[400px] bg-red-600/5 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 left-0 w-48 sm:w-64 h-48 sm:h-64 bg-red-600/3 rounded-full blur-[80px]" />
        </div>

        <div className="relative max-w-4xl mx-auto w-full">
          {/* badge */}
          <div className="inline-flex items-center gap-2 bg-[#141414] border border-[#262626] rounded-full px-3 sm:px-4 py-1.5 mb-6 sm:mb-8 animate-fade-up">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full pulse-dot" />
            <span className="text-[11px] sm:text-xs text-[#737373] font-medium">Free for everyone · No credit card required</span>
          </div>

          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-semibold leading-[1.08] sm:leading-[1.05] tracking-tight mb-5 sm:mb-6 animate-fade-up animate-fade-up-1">
            Intelligence for<br />
            <span className="text-red-500">builders everywhere.</span>
          </h1>

          <p className="text-[#737373] text-base sm:text-lg md:text-xl mb-8 sm:mb-10 max-w-2xl mx-auto leading-relaxed animate-fade-up animate-fade-up-2 px-2 sm:px-0">
            Opportunities, tools, and honest guides for anyone building something real
            with AI — Africa, the diaspora, and the world.
          </p>

          {/* CTA group */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center animate-fade-up animate-fade-up-3">
            <Link
              href="/auth?mode=signup"
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3.5 rounded-xl font-semibold text-sm transition-colors press"
            >
              Get started free <IconArrowRight size={14} />
            </Link>
            <Link
              href="/home"
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#141414] border border-[#262626] hover:border-[#3a3a3a] text-white px-6 py-3.5 rounded-xl font-medium text-sm transition-colors"
            >
              <IconSearch size={14} /> Explore opportunities
            </Link>
          </div>

          <p className="text-[11px] sm:text-xs text-[#404040] mt-4 animate-fade-up animate-fade-up-4">
            No signup needed to use the tools · Account only to save results
          </p>
        </div>
      </section>

      {/* ── Stats ──────────────────────────────────── */}
      <section className="border-y border-[#141414] py-8 sm:py-10">
        <div className="max-w-4xl mx-auto px-5 sm:px-6 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 text-center">
          {STATS.map(s => (
            <div key={s.label}>
              <div className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-1">{s.value}</div>
              <div className="text-[11px] sm:text-xs text-[#737373]">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ───────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
        <div className="text-center mb-10 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3">Everything you need to build</h2>
          <p className="text-[#737373] text-sm sm:text-base max-w-xl mx-auto">Six tools. One platform. All free. No account required to start.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {FEATURES.map(({ Icon, title, desc }) => (
            <div key={title} className="bg-[#141414] rounded-xl p-5 sm:p-6 transition-colors group">
              <div className="w-9 h-9 bg-[#1a1a1a] rounded-xl flex items-center justify-center mb-4 group-hover:bg-red-950/20 transition-colors">
                <Icon size={16} className="text-[#737373] group-hover:text-red-400 transition-colors" />
              </div>
              <h3 className="font-semibold text-sm mb-2 tracking-tight">{title}</h3>
              <p className="text-[#737373] text-xs leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ───────────────────────────── */}
      <section className="bg-[#0d0d0d] border-y border-[#141414] py-14 sm:py-20">
        <div className="max-w-3xl mx-auto px-5 sm:px-6">
          <div className="text-center mb-10 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3">How it works</h2>
            <p className="text-[#737373] text-sm sm:text-base">Three steps from idea to action plan</p>
          </div>
          <div className="space-y-3 sm:space-y-4">
            {[
              { n: '01', title: 'Type your idea', desc: 'Enter any business idea, automation concept, or income opportunity into the search bar. No login, no form, just type.' },
              { n: '02', title: 'Get a 5-layer guide', desc: 'Kivora generates an honest breakdown: opportunity overview, real monthly costs, why most people fail, the best free tool stack, and a day-by-day action plan.' },
              { n: '03', title: 'Start building', desc: 'Click "Start This" to track your journey, save the guide to your dashboard, or share it with someone who needs it.' },
            ].map(step => (
              <div key={step.n} className="flex gap-4 sm:gap-5 bg-[#141414] rounded-xl p-5 sm:p-6">
                <span className="text-red-500 font-mono text-sm font-bold shrink-0 mt-0.5 w-6">{step.n}</span>
                <div>
                  <h3 className="font-semibold text-sm mb-1.5 tracking-tight">{step.title}</h3>
                  <p className="text-[#737373] text-sm leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── What makes it different ─────────────────── */}
      <section className="max-w-4xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
        <div className="text-center mb-10 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3">Why Kivora is different</h2>
          <p className="text-[#737373] text-sm sm:text-base max-w-xl mx-auto">Most AI tools are built for people who already have everything. We built this for everyone else.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            { title: 'Real costs, not dreams', desc: 'Every guide shows the actual monthly cost to run the business — not just the free trial.' },
            { title: 'Honest failure analysis', desc: 'We tell you exactly why most people quit this opportunity. Most sites don\'t.' },
            { title: 'Works anywhere stack', desc: 'Every tool recommendation shows if it works without a VPN and accepts local payment methods.' },
            { title: 'Your currency', desc: 'Auto-detects your country and shows prices in NGN, KES, GHS, GBP, EUR, and 7 more.' },
            { title: 'No paywalls', desc: 'Every tool on this platform is free. Forever. No credit card. No trial period.' },
            { title: 'Gets smarter over time', desc: 'Every guide you generate feeds our wiki. The platform learns and improves with every use.' },
          ].map(item => (
            <div key={item.title} className="flex gap-3 bg-[#141414] rounded-xl p-4 sm:p-5">
              <div className="w-5 h-5 bg-red-950/40 border border-red-900/30 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                <IconCheck size={10} className="text-red-400" />
              </div>
              <div>
                <h4 className="font-semibold text-sm mb-1 tracking-tight">{item.title}</h4>
                <p className="text-[#737373] text-xs leading-relaxed">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Testimonials ───────────────────────────── */}
      <section className="bg-[#0d0d0d] border-y border-[#141414] py-14 sm:py-20">
        <div className="max-w-4xl mx-auto px-5 sm:px-6">
          <div className="text-center mb-10 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3">From builders like you</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4">
            {TESTIMONIALS.map(t => (
              <div key={t.name} className="bg-[#141414] rounded-xl p-5 sm:p-6">
                <div className="flex gap-0.5 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} width="12" height="12" viewBox="0 0 12 12" fill="#dc2626"><path d="M6 1l1.4 2.8L10.5 4l-2.2 2.2.5 3.1L6 7.9 3.2 9.3l.5-3.1L1.5 4l3.1-.2z"/></svg>
                  ))}
                </div>
                <p className="text-[#d4d4d4] text-sm leading-relaxed mb-5">"{t.quote}"</p>
                <div>
                  <div className="font-semibold text-sm">{t.name}</div>
                  <div className="text-xs text-[#737373]">{t.location}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-5 sm:px-6 py-16 sm:py-24 text-center">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight mb-4">
          Your next move<br />starts with a search.
        </h2>
        <p className="text-[#737373] text-base sm:text-lg mb-8 sm:mb-10 max-w-xl mx-auto">
          No signup. No credit card. Just type what you want to build and see what's possible.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 max-w-lg mx-auto mb-4">
          <input
            className="flex-1 bg-[#141414] border border-[#262626] rounded-xl px-4 py-3.5 text-sm text-white placeholder-[#404040] focus:border-red-500 focus:outline-none transition-colors"
            placeholder="e.g. Build a chatbot business in Nigeria..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch} className="bg-red-600 hover:bg-red-700 text-white px-5 py-3.5 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 press whitespace-nowrap">
            Explore <IconArrowRight size={13} />
          </button>
        </div>
        <p className="text-xs text-[#404040]">
          Or{' '}
          <Link href="/auth?mode=signup" className="text-red-500 hover:text-red-400 transition-colors">
            create a free account
          </Link>
          {' '}to save your results
        </p>
      </section>

      {/* ── Footer ─────────────────────────────────── */}
      <footer className="border-t border-[#141414] py-10 sm:py-12">
        <div className="max-w-5xl mx-auto px-5 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 mb-8 sm:mb-10">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 bg-red-600 rounded-md flex items-center justify-center">
                  <svg width="10" height="10" viewBox="0 0 14 14" fill="none"><path d="M3 7L6.5 3.5L10 7L6.5 10.5L3 7Z" fill="white"/></svg>
                </div>
                <span className="font-bold text-sm">Ki<span className="text-red-500">vora</span></span>
              </div>
              <p className="text-xs text-[#737373] leading-relaxed">Intelligence for builders everywhere.</p>
            </div>
            <div>
              <h4 className="font-semibold text-xs uppercase tracking-widest text-[#737373] mb-4">Platform</h4>
              <ul className="space-y-2.5">
                {[['Explore', '/'], ['Chat', '/chat'], ['StudyDesk', '/study'], ['Dev Tools', '/devtools'], ['Opportunities', '/opportunities']].map(([l, h]) => (
                  <li key={l}><Link href={h} className="text-xs text-[#737373] hover:text-white transition-colors">{l}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-xs uppercase tracking-widest text-[#737373] mb-4">Company</h4>
              <ul className="space-y-2.5">
                {[['About', '/about'], ['Blog', '/blog'], ['Contact', '/contact']].map(([l, h]) => (
                  <li key={l}><Link href={h} className="text-xs text-[#737373] hover:text-white transition-colors">{l}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-xs uppercase tracking-widest text-[#737373] mb-4">Legal</h4>
              <ul className="space-y-2.5">
                {[['Privacy Policy', '/privacy'], ['Terms of Service', '/terms']].map(([l, h]) => (
                  <li key={l}><Link href={h} className="text-xs text-[#737373] hover:text-white transition-colors">{l}</Link></li>
                ))}
              </ul>
            </div>
          </div>
          <div className="border-t border-[#141414] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-[#404040]">&copy; {new Date().getFullYear()} Kivora. All rights reserved.</p>
            <p className="text-xs text-[#404040]">product of <span className="font-black text-[#737373]">O.L.H.M.E.S</span></p>
          </div>
        </div>
      </footer>
    </div>
  )
}
