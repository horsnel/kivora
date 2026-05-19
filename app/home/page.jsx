'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/components/LanguageProvider'
import { supabasePublic } from '@/lib/supabase'
import { IconCode, IconLightning, IconBulb } from '@/components/Icons'

const STARTERS = [
  { labelKey: 'chat.starter.build', icon: IconCode },
  { labelKey: 'chat.starter.earn', icon: IconLightning },
  { labelKey: 'chat.starter.learn', icon: IconBulb },
]

const TYPEWRITER_PHRASES = [
  'Ask anything...',
  'Explain quantum computing simply',
  'Write a Python web scraper',
  'Help me debug my React app',
  'Create a business plan for a startup',
  'Summarize this article for me',
  'Translate this to French',
]

export default function HomePage() {
  const router = useRouter()
  const { t } = useTranslation()
  const [user, setUser] = useState(null)
  const [input, setInput] = useState('')
  const [focused, setFocused] = useState(false)
  const [placeholderText, setPlaceholderText] = useState('')
  const textareaRef = useRef(null)
  const pillsRef = useRef(null)
  const typewriterRef = useRef({ phraseIdx: 0, charIdx: 0, deleting: false, timeout: null })

  // Typewriter placeholder animation
  useEffect(() => {
    const tw = typewriterRef.current
    function tick() {
      const phrase = TYPEWRITER_PHRASES[tw.phraseIdx]
      if (!tw.deleting) {
        // Typing forward
        tw.charIdx++
        setPlaceholderText(phrase.slice(0, tw.charIdx))
        if (tw.charIdx >= phrase.length) {
          // Pause at end, then start deleting
          tw.timeout = setTimeout(() => { tw.deleting = true; tick() }, 2000)
          return
        }
        tw.timeout = setTimeout(tick, 50 + Math.random() * 40)
      } else {
        // Deleting
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

  // Prevent page scroll when swiping pills horizontally
  useEffect(() => {
    const el = pillsRef.current
    if (!el) return
    function handleTouch(e) {
      const atStart = el.scrollLeft <= 0
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1
      if ((atStart && atEnd) || (atStart && e.touches[0]?.clientX > el._touchStartX) || (atEnd && e.touches[0]?.clientX < el._touchStartX)) {
        return // allow page scroll if can't scroll further in that direction
      }
      // If pills can scroll, stop page from scrolling
      if (!atStart || !atEnd) {
        e.stopPropagation()
      }
    }
    function saveStart(e) {
      el._touchStartX = e.touches[0]?.clientX
    }
    // On desktop: convert vertical wheel scroll to horizontal scroll on pills
    function handleWheel(e) {
      const hasScroll = el.scrollWidth > el.clientWidth
      if (!hasScroll) return
      const atStart = el.scrollLeft <= 0
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1
      if (atStart && atEnd) return
      e.preventDefault()
      e.stopPropagation()
      el.scrollLeft += e.deltaY !== 0 ? e.deltaY : e.deltaX
    }
    el.addEventListener('touchstart', saveStart, { passive: true })
    el.addEventListener('touchmove', handleTouch, { passive: false })
    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      el.removeEventListener('touchstart', saveStart)
      el.removeEventListener('touchmove', handleTouch)
      el.removeEventListener('wheel', handleWheel)
    }
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
    <main className="h-full flex flex-col bg-[#0a0a0a]">
      {/* Centered content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 pb-8 -mt-8">
        {/* Greeting */}
        {displayName && (
          <div className="text-center mb-8 animate-fade-up">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-2">
              {getGreeting()}, <span className="text-red-500">{displayName}</span>
            </h1>
          </div>
        )}

        {/* Chat bar — exact same design as ChatClient expanded bar */}
        <div className="w-full max-w-2xl animate-fade-up">
          <div className="chat-container-expanded">
            {/* Textarea */}
            <textarea
              ref={textareaRef}
              rows={1}
              className="chat-textarea-expanded scrollbar-none"
              value={input}
              onChange={e => { setInput(e.target.value); autoResize(e.target) }}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() } }}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              autoFocus
            />
            {/* Typewriter placeholder overlay */}
            {input.length === 0 && !focused && (
              <div className="chat-typewriter-placeholder" onClick={() => textareaRef.current?.focus()}>
                <span>{placeholderText}</span>
                <span className="typewriter-cursor" />
              </div>
            )}

            {/* Toolbar */}
            <div className="chat-toolbar-expanded">
              {/* Left actions */}
              <div className="chat-toolbar-left">
                {/* Attach file (visual only) */}
                <button className="chat-toolbar-btn" title="Attach file">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                  </svg>
                </button>
              </div>

              {/* Right actions */}
              <div className="chat-toolbar-right">
                {/* Submit button */}
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

          {/* Starter pills — horizontally scrollable */}
          <div className="starter-pills-row mt-4" ref={pillsRef}>
            {STARTERS.map(({ labelKey, icon: Icon }) => (
              <button
                key={labelKey}
                onClick={() => setInput(t(labelKey))}
                className="flex items-center gap-2 bg-transparent border border-[#1f1f1f] text-[#737373] hover:bg-[#0f0f0f] hover:border-[#2a2a2a] hover:text-white hover:-translate-y-px px-4 py-2 rounded-full text-[13px] font-normal cursor-pointer transition-all duration-200 tracking-[-0.01em] whitespace-nowrap shrink-0"
              >
                <Icon size={13} className="shrink-0" />
                <span>{t(labelKey)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ChatClient CSS — exact same styles */}
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
        }
        .chat-textarea-expanded:focus {
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
          border-color: transparent !important;
        }
        .chat-textarea-expanded::placeholder {
          color: #525252;
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
        .chat-toolbar-left {
          flex-wrap: nowrap;
          gap: 2px;
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
        .chat-submit-btn-active:active {
          transform: scale(0.95);
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
          display: flex;
          align-items: flex-start;
        }
        .typewriter-cursor {
          display: inline-block;
          width: 2px;
          height: 1.1em;
          background: #525252;
          margin-left: 1px;
          animation: blink 1s step-end infinite;
          vertical-align: text-bottom;
          flex-shrink: 0;
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }

        .starter-pills-row {
          display: flex;
          align-items: center;
          gap: 8px;
          overflow-x: auto;
          overflow-y: hidden;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-x: contain;
          scrollbar-width: none;
          padding: 4px 4px 4px 0;
        }
        .starter-pills-row::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </main>
  )
}
