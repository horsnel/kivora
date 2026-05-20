'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/components/LanguageProvider'
import { supabasePublic } from '@/lib/supabase'

const TYPEWRITER_PHRASES = [
  'Ask anything...',
  'Generate a logo for my startup',
  'Build a landing page',
  'Convert my notes to PDF',
  'Analyze this image',
  'Summarize this article',
  'Create a dashboard',
  'Write Python code to scrape data',
]

// ── Pre-generated real AI images for gallery ──
const SAMPLE_IMAGES = [
  { prompt: 'Sunset over Lagos skyline', src: '/images/lagos-sunset.png' },
  { prompt: 'Afrofuturist city concept', src: '/images/afro-city.png' },
  { prompt: 'Tech startup logo design', src: '/images/tech-logo.png' },
  { prompt: 'African Ankara patterns', src: '/images/african-pattern.png' },
  { prompt: 'Modern workspace design', src: '/images/workspace.png' },
  { prompt: 'Neon cyberpunk portrait', src: '/images/cyberpunk.png' },
  { prompt: 'Mountain aurora borealis', src: '/images/aurora-mountain.png' },
  { prompt: 'Steampunk golden clock', src: '/images/steampunk-clock.png' },
  { prompt: 'Underwater coral reef', src: '/images/coral-reef.png' },
  { prompt: 'Cherry blossom garden', src: '/images/cherry-blossom.png' },
  { prompt: 'Space station orbiting Earth', src: '/images/space-station.png' },
  { prompt: 'Watercolor European village', src: '/images/watercolor-village.png' },
]

const SAMPLE_WEBSITES = [
  { title: 'SaaS Landing Page', desc: 'Modern pricing page with gradient hero', prompt: 'Build a SaaS landing page', src: '/images/websites/saas-landing.png' },
  { title: 'Analytics Dashboard', desc: 'Data visualization with charts and metrics', prompt: 'Build an analytics dashboard', src: '/images/websites/analytics-dashboard.png' },
  { title: 'Portfolio Site', desc: 'Minimal developer portfolio with projects', prompt: 'Build a portfolio website', src: '/images/websites/portfolio.png' },
  { title: 'E-commerce Store', desc: 'Product catalog with shopping cart', prompt: 'Build an e-commerce store', src: '/images/websites/ecommerce.png' },
  { title: 'Blog Template', desc: 'Clean reading experience with categories', prompt: 'Build a blog template', src: '/images/websites/blog.png' },
  { title: 'Chat Interface', desc: 'Real-time messaging UI with threads', prompt: 'Build a chat interface', src: '/images/websites/chat-interface.png' },
]

const FILE_TYPES = [
  { id: 'pdf', label: 'PDF', color: '#ef4444' },
  { id: 'docx', label: 'DOCX', color: '#3b82f6' },
  { id: 'xlsx', label: 'XLSX', color: '#22c55e' },
  { id: 'csv', label: 'CSV', color: '#f59e0b' },
  { id: 'json', label: 'JSON', color: '#a855f7' },
  { id: 'html', label: 'HTML', color: '#f97316' },
  { id: 'md', label: 'Markdown', color: '#6b7280' },
  { id: 'yaml', label: 'YAML', color: '#ec4899' },
]

// ── SVG Icon Components ──
function ImageIcon({ size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
}
function LayoutIcon({ size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
}
function FileConvertIcon({ size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/><path d="m12 18-2-2 2-2"/><path d="m16 14 2 2-2 2"/></svg>
}
function WebIcon({ size = 20 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>
}

export default function HomePage() {
  const router = useRouter()
  const { t } = useTranslation()
  const [user, setUser] = useState(null)
  const [input, setInput] = useState('')
  const [focused, setFocused] = useState(false)
  const [placeholderText, setPlaceholderText] = useState('')
  const textareaRef = useRef(null)
  const typewriterRef = useRef({ phraseIdx: 0, charIdx: 0, deleting: false, timeout: null })
  const scrollContainerRef = useRef(null)

  // Typewriter animation
  useEffect(() => {
    const tw = typewriterRef.current
    function tick() {
      const phrase = TYPEWRITER_PHRASES[tw.phraseIdx]
      if (!tw.deleting) {
        tw.charIdx++
        setPlaceholderText(phrase.slice(0, tw.charIdx))
        if (tw.charIdx >= phrase.length) {
          tw.timeout = setTimeout(() => { tw.deleting = true; tick() }, 2000)
          return
        }
        tw.timeout = setTimeout(tick, 50 + Math.random() * 40)
      } else {
        tw.charIdx--
        setPlaceholderText(phrase.slice(0, tw.charIdx))
        if (tw.charIdx <= 0) {
          tw.deleting = false
          tw.phraseIdx = (tw.phraseIdx + 1) % TYPEWRITER_PHRASES.length
          tw.timeout = setTimeout(tick, 400)
          return
        }
        tw.timeout = setTimeout(tick, 25)
      }
    }
    tick()
    return () => clearTimeout(tw.timeout)
  }, [])

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

  function autoResize(el) {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 180) + 'px'
  }

  function handleSubmit() {
    const q = input.trim()
    if (!q) return
    const params = new URLSearchParams({ q })
    router.push(`/chat?${params.toString()}`)
  }

  const hasInput = input.trim().length > 0

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white overflow-y-auto">
      {/* ── Good Morning Builder ── */}
      <div className="flex flex-col items-center pt-12 sm:pt-16 pb-4 px-4">
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-1 animate-fade-up">
          {getGreeting()}, <span className="text-red-500">{displayName || t('discover.builder')}</span>
        </h1>
        <p className="text-[#737373] text-sm sm:text-base animate-fade-up">
          {t('discover.greeting.subtitle')}
        </p>
      </div>

      {/* ── Chat Bar ── */}
      <div className="flex justify-center px-4 pb-8 animate-fade-up">
        <div className="w-full max-w-2xl">
          <div className="chat-container-expanded">
            <textarea
              ref={textareaRef}
              rows={1}
              className={`chat-textarea-expanded scrollbar-none${input.length === 0 && !focused ? ' no-caret' : ''}`}
              value={input}
              onChange={e => { setInput(e.target.value); autoResize(e.target) }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() } }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              autoFocus
            />
            {input.length === 0 && !focused && (
              <div className="chat-typewriter-placeholder" onClick={() => textareaRef.current?.focus()}>
                {placeholderText}
              </div>
            )}
            <div className="chat-toolbar-expanded">
              <div className="chat-toolbar-left">
                <button className="chat-toolbar-btn" title="Attach file">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                  </svg>
                </button>
              </div>
              <div className="chat-toolbar-right">
                <button
                  onClick={handleSubmit}
                  disabled={!hasInput}
                  className={`chat-submit-btn ${hasInput ? 'chat-submit-btn-active' : ''}`}
                  aria-label="Send message"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Capability Sections ── */}
      <div className="max-w-5xl mx-auto px-4 pb-16 space-y-10">

        {/* ── Section 1: Generate Images ── Horizontal scrollable */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center text-purple-400">
              <ImageIcon size={16} />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight text-white">Generate Images</h2>
              <p className="text-xs text-[#737373]">Create stunning visuals from text descriptions</p>
            </div>
          </div>

          {/* Horizontal scrollable image gallery */}
          <div
            ref={scrollContainerRef}
            className="flex gap-3 overflow-x-auto overscroll-x-contain pb-2 scrollbar-hide"
            style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
          >
            {SAMPLE_IMAGES.map((img, i) => (
              <button
                key={img.src}
                onClick={() => { setInput(`Generate an image: ${img.prompt}`); textareaRef.current?.focus() }}
                className="group relative shrink-0 w-[200px] h-[200px] rounded-xl overflow-hidden bg-[#111] border border-[#1a1a1a] hover:border-[#2a2a2a] transition-all duration-200 cursor-pointer"
                style={{ scrollSnapAlign: 'start' }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.src}
                  alt={img.prompt}
                  className="w-full h-full object-cover opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-300"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-2.5">
                  <p className="text-[11px] text-white/90 font-medium line-clamp-2">{img.prompt}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Quick prompts */}
          <div className="flex flex-wrap gap-2 mt-3">
            {['Landscape', 'Portrait', 'Logo', 'Icon', 'Illustration'].map(tag => (
              <button
                key={tag}
                onClick={() => { setInput(`Generate a ${tag.toLowerCase()}: `); textareaRef.current?.focus() }}
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#111] border border-[#1f1f1f] text-[#737373] hover:bg-[#1a1a1a] hover:border-[#2a2a2a] hover:text-white transition-all duration-200"
              >
                {tag}
              </button>
            ))}
          </div>
        </section>

        {/* ── Section 2: Build Websites ── Horizontal scrollable rectangular cards */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center text-emerald-400">
              <WebIcon size={16} />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight text-white">Build Websites</h2>
              <p className="text-xs text-[#737373]">Generate complete web pages with live preview</p>
            </div>
          </div>

          {/* Horizontal scrollable rectangular cards */}
          <div
            className="flex gap-3 overflow-x-auto overscroll-x-contain pb-2 scrollbar-hide"
            style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
          >
            {SAMPLE_WEBSITES.map((site, i) => (
              <button
                key={site.title}
                onClick={() => { setInput(`${site.prompt}: ${site.desc}`); textareaRef.current?.focus() }}
                className="group relative shrink-0 w-[260px] rounded-xl overflow-hidden bg-[#0f0f0f] border border-[#1a1a1a] hover:border-[#2a2a2a] transition-all duration-200 cursor-pointer text-left"
                style={{ scrollSnapAlign: 'start' }}
              >
                {/* Rectangular preview thumbnail */}
                <div className="w-full h-[120px] bg-gradient-to-br from-emerald-500/10 to-teal-500/10 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={site.src}
                    alt={site.title}
                    className="w-full h-full object-cover opacity-70 group-hover:opacity-90 group-hover:scale-105 transition-all duration-300"
                    loading="lazy"
                  />
                </div>
                {/* Text content */}
                <div className="p-3">
                  <h3 className="text-sm font-medium text-white/90 mb-0.5 group-hover:text-white transition-colors">{site.title}</h3>
                  <p className="text-xs text-[#525252] leading-relaxed">{site.desc}</p>
                </div>
              </button>
            ))}
          </div>

          {/* Quick prompts */}
          <div className="flex flex-wrap gap-2 mt-3">
            {['Landing page', 'Dashboard', 'Portfolio', 'Blog', 'E-commerce'].map(tag => (
              <button
                key={tag}
                onClick={() => { setInput(`Build a ${tag.toLowerCase()}: `); textareaRef.current?.focus() }}
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#111] border border-[#1f1f1f] text-[#737373] hover:bg-[#1a1a1a] hover:border-[#2a2a2a] hover:text-white transition-all duration-200"
              >
                {tag}
              </button>
            ))}
          </div>
        </section>

        {/* ── Section 3: Convert to File ── Horizontal scrollable cards */}
        <section>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center text-amber-400">
              <FileConvertIcon size={16} />
            </div>
            <div>
              <h2 className="text-base font-semibold tracking-tight text-white">Convert to File</h2>
              <p className="text-xs text-[#737373]">Transform content between formats instantly</p>
            </div>
          </div>

          {/* Horizontal scrollable cards */}
          <div
            className="flex gap-3 overflow-x-auto overscroll-x-contain pb-2 scrollbar-hide"
            style={{ scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch' }}
          >
            {FILE_TYPES.map(ft => (
              <button
                key={ft.id}
                onClick={() => { setInput(`Convert my text to ${ft.label} format: `); textareaRef.current?.focus() }}
                className="group shrink-0 w-[130px] p-4 rounded-xl bg-[#0f0f0f] border border-[#1a1a1a] hover:border-[#2a2a2a] transition-all duration-200 cursor-pointer text-center"
                style={{ scrollSnapAlign: 'start' }}
              >
                {/* Icon with color */}
                <div
                  className="w-10 h-10 rounded-lg mx-auto mb-2.5 flex items-center justify-center transition-transform duration-200 group-hover:scale-110"
                  style={{ backgroundColor: `${ft.color}15` }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={ft.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/></svg>
                </div>
                {/* Label */}
                <span className="text-sm font-medium text-white/90 group-hover:text-white transition-colors block">{ft.label}</span>
              </button>
            ))}
          </div>

          {/* Quick conversion prompts */}
          <div className="flex flex-wrap gap-2 mt-3">
            {['PDF report', 'Excel sheet', 'Presentation', 'HTML page', 'JSON data'].map(tag => (
              <button
                key={tag}
                onClick={() => { setInput(`Convert to ${tag}: `); textareaRef.current?.focus() }}
                className="px-3 py-1.5 rounded-full text-xs font-medium bg-[#111] border border-[#1f1f1f] text-[#737373] hover:bg-[#1a1a1a] hover:border-[#2a2a2a] hover:text-white transition-all duration-200"
              >
                {tag}
              </button>
            ))}
          </div>
        </section>


      </div>

      {/* ── CSS ── */}
      <style jsx>{`
        .chat-container-expanded {
          width: 100%;
          position: relative;
          background-color: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 20px;
          padding: 16px 16px 10px 16px;
          display: flex;
          flex-direction: column;
          transition: border-color 0.2s ease, box-shadow 0.2s ease;
          overflow: visible;
        }
        .chat-container-expanded:focus-within {
          border-color: rgba(255,255,255,0.12);
          box-shadow: 0 0 0 3px rgba(255,255,255,0.03);
        }

        .chat-textarea-expanded {
          width: 100%;
          background: transparent;
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
          color: #e2e2e2;
          font-size: 16px;
          line-height: 1.6;
          resize: none;
          max-height: 240px;
          min-height: 56px;
          font-family: inherit;
          padding: 4px 2px;
          margin-bottom: 12px;
          caret-color: #e2e2e2;
        }
        .chat-textarea-expanded.no-caret {
          caret-color: transparent;
        }
        .chat-textarea-expanded:focus {
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
          border-color: transparent !important;
        }

        .chat-toolbar-expanded {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 6px;
          min-height: 38px;
        }
        .chat-toolbar-left, .chat-toolbar-right {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
        }

        .chat-toolbar-btn {
          background: transparent;
          border: none;
          outline: none;
          color: #525252;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          padding: 6px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          transition: background 0.2s, color 0.2s;
          white-space: nowrap;
          flex-shrink: 0;
          width: 32px;
          height: 32px;
        }
        .chat-toolbar-btn:hover {
          background-color: rgba(255,255,255,0.06);
          color: #e2e2e2;
        }

        .chat-submit-btn {
          width: 38px;
          height: 38px;
          border-radius: 50%;
          border: none;
          background: rgba(255,255,255,0.06);
          color: #737373;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: background 0.15s, transform 0.1s ease, color 0.15s;
          padding: 0;
        }
        .chat-submit-btn:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }
        .chat-submit-btn-active {
          background: #e2e2e2;
          color: #0a0a0a;
        }
        .chat-submit-btn-active:hover {
          background: #ffffff;
          transform: scale(1.05);
        }

        .chat-typewriter-placeholder {
          position: absolute;
          top: 20px;
          left: 18px;
          right: 18px;
          color: #525252;
          font-size: 16px;
          line-height: 1.6;
          pointer-events: auto;
          cursor: text;
        }

        /* Hide scrollbar for horizontal scroll */
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        @keyframes fade-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-up {
          animation: fade-up 0.5s ease-out forwards;
        }
      `}</style>
    </main>
  )
}
