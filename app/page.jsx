'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'
import { useTranslation } from '@/components/LanguageProvider'
import {
  IconMoney, IconCode, IconChat, IconBook, IconGlobe, IconArrowRight,
  IconCheck, IconTrending, IconLightning, IconSearch, IconTool
} from '@/components/Icons'

/* ── Code-typing animation component ── */
function CodeTyping() {
  const lines = [
    { indent: 0, text: 'const app = createApp({', color: 'text-red-400' },
    { indent: 1, text: 'name: "my-project",', color: 'text-[#d4d4d4]' },
    { indent: 1, text: 'ai: true,', color: 'text-emerald-400' },
    { indent: 1, text: 'deploy: "cloudflare"', color: 'text-[#d4d4d4]' },
    { indent: 0, text: '})', color: 'text-red-400' },
  ]
  const [visibleLines, setVisibleLines] = useState(0)
  const [charIndex, setCharIndex] = useState(0)
  const intervalRef = useRef(null)

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      if (visibleLines < lines.length) {
        const currentLine = lines[visibleLines].text
        if (charIndex < currentLine.length) {
          setCharIndex(prev => prev + 1)
        } else {
          setVisibleLines(prev => prev + 1)
          setCharIndex(0)
        }
      } else {
        // Reset after a pause
        setTimeout(() => {
          setVisibleLines(0)
          setCharIndex(0)
        }, 3000)
      }
    }, 60)
    return () => clearInterval(intervalRef.current)
  }, [visibleLines, charIndex])

  return (
    <div className="font-mono text-[11px] sm:text-xs leading-relaxed p-3 sm:p-4 bg-[#0a0a0a] rounded-lg border border-[#1a1a1a]">
      {lines.slice(0, visibleLines + 1).map((line, i) => (
        <div key={i} className="flex">
          <span className="text-[#404040] select-none w-5 text-right mr-3 shrink-0">{i + 1}</span>
          <span style={{ paddingLeft: `${line.indent * 16}px` }} className={line.color}>
            {i === visibleLines
              ? line.text.slice(0, charIndex)
              : line.text}
            {i === visibleLines && <span className="animate-pulse text-red-500">|</span>}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function WelcomePage() {
  const router = useRouter()
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const [scrolled, setScrolled] = useState(false)

  const FEATURES = [
    {
      Icon: IconSearch,
      title: t('welcome.features.opportunity'),
      desc: t('welcome.features.opportunity.desc'),
      span: 'col-span-1 sm:col-span-2 row-span-1',  // Large — hero feature
      accent: 'red',
    },
    {
      Icon: IconChat,
      title: t('welcome.features.chat'),
      desc: t('welcome.features.chat.desc'),
      span: 'col-span-1 row-span-1',
      accent: 'red',
    },
    {
      Icon: IconBook,
      title: t('welcome.features.studydesk'),
      desc: t('welcome.features.studydesk.desc'),
      span: 'col-span-1 row-span-1',
      accent: 'default',
    },
    {
      Icon: IconCode,
      title: t('welcome.features.devtools'),
      desc: t('welcome.features.devtools.desc'),
      span: 'col-span-1 sm:col-span-2 row-span-1',  // Large — dev tools showcase
      accent: 'teal',
      codeDemo: true,
    },
    {
      Icon: IconGlobe,
      title: t('welcome.features.global'),
      desc: t('welcome.features.global.desc'),
      span: 'col-span-1 row-span-1',
      accent: 'default',
    },
    {
      Icon: IconMoney,
      title: t('welcome.features.income'),
      desc: t('welcome.features.income.desc'),
      span: 'col-span-1 row-span-1',
      accent: 'default',
    },
  ]

  const DIFFERENTIATORS = [
    t('welcome.why.card1.title'),
    t('welcome.why.card2.title'),
    t('welcome.why.card3.title'),
    t('welcome.why.card4.title'),
    t('welcome.why.card5.title'),
    t('welcome.why.card6.title'),
  ]

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  function handleSearch() {
    if (query.trim()) router.push(`/explore?q=${encodeURIComponent(query.trim())}`)
    else router.push('/explore')
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">

      {/* ── Fixed top bar with logo ── */}
      <nav className={`fixed top-0 left-0 right-0 z-30 transition-all duration-300 ${scrolled ? 'bg-[#0a0a0a]/90 backdrop-blur-md border-b border-[#1a1a1a]/60' : 'bg-transparent border-b border-transparent'}`}>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-12 sm:h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-[#dc2626] rounded-lg flex items-center justify-center">
              <svg width="14" height="14" viewBox="0 0 32 32" fill="none">
                <path d="M16 4L6 24L16 18Z" fill="white" opacity="0.95" />
                <path d="M16 4L26 24L16 18Z" fill="white" opacity="0.55" />
                <rect x="6" y="26" width="20" height="3" rx="1.5" fill="white" opacity="0.3" />
              </svg>
            </div>
            <span className="font-bold text-[15px] tracking-tight">
              Ki<span className="text-red-500">vora</span>
            </span>
          </Link>

          <div className="flex items-center gap-4">
            <a href="#features" className="hidden sm:inline text-xs text-[#737373] hover:text-white transition-colors">Features</a>
            <Link href="/auth?mode=signin" className="bg-red-600 hover:bg-red-700 text-white text-sm px-4 py-1.5 rounded-lg font-semibold transition-colors">
              {t('auth.signin')}
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ───────────────────────────────────── */}
      <section className="relative min-h-[85vh] sm:min-h-screen flex flex-col items-center justify-center px-5 sm:px-6 text-center">
        {/* background glow — multi-layer depth */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] sm:w-[700px] h-[350px] sm:h-[450px] bg-red-600/5 rounded-full blur-[120px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[300px] sm:w-[400px] h-[250px] sm:h-[300px] bg-red-600/3 rounded-full blur-[100px]" />
          <div className="absolute bottom-0 left-0 w-48 sm:w-64 h-48 sm:h-64 bg-[#a855f7]/3 rounded-full blur-[80px]" />
        </div>

        <div className="relative max-w-4xl mx-auto w-full">
          {/* badge */}
          <div className="inline-flex items-center gap-2 bg-[#111111] border border-[#1f1f1f] rounded-full px-3 sm:px-4 py-1.5 mb-6 sm:mb-8 animate-fade-up">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full pulse-dot" />
            <span className="text-[11px] sm:text-xs text-muted font-medium">{t('welcome.badge')}</span>
          </div>

          <h1 className="text-[clamp(2.5rem,8vw,5rem)] font-extrabold leading-[1.05] tracking-[-0.02em] text-white mb-5 sm:mb-6 max-w-[15ch] mx-auto animate-fade-up animate-fade-up-1">
            Intelligence for<br />
            <span className="bg-gradient-to-r from-[#FF6B6B] to-[#FF8E53] bg-clip-text text-transparent">builders</span> everywhere.
          </h1>

          <p className="text-muted text-base sm:text-lg md:text-xl mb-8 sm:mb-10 max-w-2xl mx-auto leading-relaxed animate-fade-up animate-fade-up-2 px-2 sm:px-0">
            {t('welcome.subtitle')}
          </p>

          {/* CTA group */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center animate-fade-up animate-fade-up-3">
            <Link
              href="/auth?mode=signup"
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white px-6 py-3.5 rounded-xl font-semibold text-sm transition-colors press"
            >
              {t('welcome.cta.primary')} <IconArrowRight size={14} />
            </Link>
            <Link
              href="/explore"
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#111111] border border-[#1f1f1f] hover:border-[#2f2f2f] text-white px-6 py-3.5 rounded-xl font-medium text-sm transition-colors"
            >
              <IconSearch size={14} /> {t('welcome.cta.secondary')}
            </Link>
          </div>

          <p className="text-[11px] sm:text-xs text-muted2 mt-4 animate-fade-up animate-fade-up-4">
            {t('welcome.cta.sub')}
          </p>
        </div>
      </section>

      {/* ── Features — Bento Grid ────────────────────── */}
      <section id="features" className="max-w-5xl mx-auto px-5 sm:px-6 py-14 sm:py-20">
        <div className="text-center mb-10 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3">{t('welcome.features.title')}</h2>
          <p className="text-muted text-sm sm:text-base max-w-xl mx-auto">{t('welcome.features.subtitle')}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {FEATURES.map(({ Icon, title, desc, span, accent, codeDemo }) => (
            <div
              key={title}
              className={`${span} bg-[#111111] border border-[#1a1a1a] rounded-xl p-5 sm:p-6 transition-all duration-200 group hover:border-[#2a2a2a] hover:bg-[#131313] ${accent === 'red' ? 'relative overflow-hidden' : ''}`}
            >
              {/* Red accent glow for opportunity card */}
              {accent === 'red' && (
                <>
                  <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-red-600/5 via-transparent to-transparent pointer-events-none" />
                  <div className="absolute top-0 right-0 w-32 h-32 bg-red-600/5 rounded-full blur-[60px] pointer-events-none" />
                </>
              )}

              <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-4 transition-colors ${
                accent === 'teal'
                  ? 'bg-emerald-950/30 group-hover:bg-emerald-950/50'
                  : accent === 'red'
                  ? 'bg-red-950/20 group-hover:bg-red-950/30'
                  : 'bg-[#161616] group-hover:bg-[#1a1a1a]'
              }`}>
                <Icon size={16} className={`transition-colors ${
                  accent === 'teal'
                    ? 'text-muted group-hover:text-emerald-400'
                    : accent === 'red'
                    ? 'text-muted group-hover:text-red-400'
                    : 'text-muted group-hover:text-red-400'
                }`} />
              </div>
              <h3 className="font-semibold text-sm mb-2 tracking-tight text-[#d4d4d4]">{title}</h3>
              <p className="text-muted text-xs leading-relaxed">{desc}</p>

              {/* Code typing demo for Dev Tools */}
              {codeDemo && (
                <div className="mt-4 opacity-80 group-hover:opacity-100 transition-opacity">
                  <CodeTyping />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── What makes it different — Horizontal Pills ── */}
      <section className="max-w-5xl mx-auto px-5 sm:px-6 py-10 sm:py-14">
        <div className="text-center mb-6 sm:mb-8">
          <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3">{t('welcome.why.title')}</h2>
          <p className="text-muted text-sm sm:text-base max-w-xl mx-auto">{t('welcome.why.subtitle')}</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3">
          {DIFFERENTIATORS.map((item) => (
            <div key={item} className="inline-flex items-center gap-2 bg-[#111111] border border-[#1a1a1a] rounded-full px-4 py-2.5 hover:border-[#2a2a2a] transition-colors">
              <div className="w-4 h-4 bg-red-950/40 border border-red-900/30 rounded-full flex items-center justify-center shrink-0">
                <IconCheck size={8} className="text-red-400" />
              </div>
              <span className="text-xs sm:text-sm font-medium text-[#d4d4d4]">{item}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-5 sm:px-6 py-16 sm:py-24 text-center">
        <h2 className="text-3xl sm:text-4xl md:text-5xl font-semibold tracking-tight mb-4">
          {t('welcome.cta_bottom.title')}
        </h2>
        <p className="text-muted text-base sm:text-lg mb-8 sm:mb-10 max-w-xl mx-auto">
          {t('welcome.cta_bottom.subtitle')}
        </p>
        <div className="flex flex-col sm:flex-row gap-2 max-w-lg mx-auto mb-4">
          <input
            className="flex-1 bg-[#111111] border border-[#1f1f1f] rounded-xl px-4 py-3.5 text-sm text-white placeholder-[#404040] focus:outline-none transition-colors"
            placeholder={t('welcome.cta_bottom.placeholder')}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <button onClick={handleSearch} className="bg-red-600 hover:bg-red-700 text-white px-5 py-3.5 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 press whitespace-nowrap">
            {t('welcome.cta_bottom.explore')} <IconArrowRight size={13} />
          </button>
        </div>
        <p className="text-xs text-muted2">
          {t('welcome.cta_bottom.or')}{' '}
          <Link href="/auth?mode=signup" className="text-red-500 hover:text-red-400 transition-colors">
            {t('welcome.cta_bottom.create_account')}
          </Link>
          {' '}{t('welcome.cta_bottom.save_results')}
        </p>
      </section>

      {/* ── Footer ─────────────────────────────────── */}
      <footer className="border-t border-[#1a1a1a] py-10 sm:py-12 bg-[#080808]">
        <div className="max-w-5xl mx-auto px-5 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 mb-8 sm:mb-10">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-6 h-6 bg-[#dc2626] rounded-md flex items-center justify-center">
                  <svg width="12" height="12" viewBox="0 0 32 32" fill="none"><path d="M16 4L6 24L16 18Z" fill="white" opacity="0.95"/><path d="M16 4L26 24L16 18Z" fill="white" opacity="0.55"/><rect x="6" y="26" width="20" height="3" rx="1.5" fill="white" opacity="0.3"/></svg>
                </div>
                <span className="font-bold text-sm">Ki<span className="text-red-500">vora</span></span>
              </div>
              <p className="text-xs text-muted leading-relaxed">{t('welcome.footer.tagline')}</p>
            </div>
            <div>
              <h4 className="font-semibold text-xs uppercase tracking-widest text-muted mb-4">{t('welcome.footer.platform')}</h4>
              <ul className="space-y-2.5">
                {[
                  [t('footer.explore'), '/'],
                  [t('footer.chat'), '/chat'],
                  [t('footer.studydesk'), '/study'],
                  [t('footer.devtools'), '/devtools'],
                  [t('footer.opportunities'), '/opportunities'],
                  ['Tools & Features', '/tools']
                ].map(([l, h]) => (
                  <li key={l}><Link href={h} className="text-xs text-muted hover:text-white transition-colors">{l}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-xs uppercase tracking-widest text-muted mb-4">{t('welcome.footer.company')}</h4>
              <ul className="space-y-2.5">
                {[
                  [t('footer.about'), '/about'],
                  [t('footer.blog'), '/blog'],
                  [t('footer.contact'), '/contact']
                ].map(([l, h]) => (
                  <li key={l}><Link href={h} className="text-xs text-muted hover:text-white transition-colors">{l}</Link></li>
                ))}
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-xs uppercase tracking-widest text-muted mb-4">{t('welcome.footer.legal')}</h4>
              <ul className="space-y-2.5">
                {[
                  [t('footer.privacy'), '/privacy'],
                  [t('footer.terms'), '/terms']
                ].map(([l, h]) => (
                  <li key={l}><Link href={h} className="text-xs text-muted hover:text-white transition-colors">{l}</Link></li>
                ))}
              </ul>
            </div>
          </div>
          <div className="border-t border-[#1a1a1a] pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-muted2">&copy; {new Date().getFullYear()} Kivora. All rights reserved.</p>
            <p className="text-xs text-muted2">product of <span className="font-black text-muted">O.L.H.M.E.S</span></p>
          </div>
        </div>
      </footer>
    </div>
  )
}
