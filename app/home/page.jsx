'use client'
import { useState, useEffect, useRef } from 'react'
import { useTranslation } from '@/components/LanguageProvider'
import { supabasePublic } from '@/lib/supabase'
import { IconSearch, IconWrite, IconCheck, IconChartBar, IconDna, IconTrending, IconRocket, IconHeart, IconMicroscope, IconWarning } from '@/components/Icons'

// ── Constants ──
const STORAGE_KEY = 'kivora-research-history'
const MAX_HISTORY = 50

const TYPEWRITER_PHRASES = [
  'Research anything...',
  'Analyze AI market trends in 2026',
  'Deep dive into quantum computing',
  'Compare crypto investment opportunities',
  'Research space technology breakthroughs',
  'Investigate biotech innovations',
  'Analyze competitor strategies',
  'Research renewable energy trends',
  'Explore machine learning research',
]

const QUICK_STAGES = [
  { id: 'search', label: 'Searching', Icon: IconSearch },
  { id: 'writing', label: 'Writing', Icon: IconWrite },
  { id: 'done', label: 'Done', Icon: IconCheck },
]

const DEEP_STAGES = [
  { id: 'search', label: 'Searching', Icon: IconSearch },
  { id: 'analyzing', label: 'Analyzing', Icon: IconChartBar },
  { id: 'writing', label: 'Writing', Icon: IconWrite },
  { id: 'done', label: 'Done', Icon: IconCheck },
]

// ── Helpers ──
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function getDomain(url) {
  try { return new URL(url).hostname.replace('www.', '') } catch { return url }
}

function loadHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveHistory(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_HISTORY)))
  } catch {}
}

// ── Simple Markdown Renderer ──
function renderMarkdown(text) {
  if (!text) return null
  const lines = text.split('\n')
  const elements = []
  let inList = false
  let listItems = []
  let keyIdx = 0

  function flushList() {
    if (listItems.length > 0) {
      elements.push(<ul key={`ul-${keyIdx++}`} className="space-y-1 mb-3 ml-1">{listItems}</ul>)
      listItems = []
    }
    inList = false
  }

  function renderInline(str) {
    const parts = []
    const regex = /(\*\*|__)(.*?)\1|\[([^\]]+)\]\(([^)]+)\)|\[(\d+)\]/g
    let lastIndex = 0
    let match
    while ((match = regex.exec(str)) !== null) {
      if (match.index > lastIndex) {
        parts.push(str.slice(lastIndex, match.index))
      }
      if (match[1]) {
        parts.push(<strong key={`b-${keyIdx++}`} className="text-white font-semibold">{match[2]}</strong>)
      } else if (match[3] !== undefined && match[4] !== undefined) {
        parts.push(
          <a key={`a-${keyIdx++}`} href={match[4]} target="_blank" rel="noopener noreferrer" className="text-red-400 hover:text-red-300 underline underline-offset-2">
            {match[3]}
          </a>
        )
      } else if (match[5] !== undefined) {
        parts.push(<span key={`cit-${keyIdx++}`} className="citation-number">[{match[5]}]</span>)
      }
      lastIndex = match.index + match[0].length
    }
    if (lastIndex < str.length) parts.push(str.slice(lastIndex))
    return parts.length > 0 ? parts : str
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (line.startsWith('### ')) { flushList(); elements.push(<h3 key={`h3-${keyIdx++}`} className="text-base font-semibold text-white mt-5 mb-2">{renderInline(line.slice(4))}</h3>); continue }
    if (line.startsWith('## ')) { flushList(); elements.push(<h2 key={`h2-${keyIdx++}`} className="text-lg font-semibold text-white mt-6 mb-2.5">{renderInline(line.slice(3))}</h2>); continue }
    if (line.startsWith('# ')) { flushList(); elements.push(<h1 key={`h1-${keyIdx++}`} className="text-xl font-bold text-white mt-4 mb-3">{renderInline(line.slice(2))}</h1>); continue }
    if (/^---+$/.test(line.trim())) { flushList(); elements.push(<hr key={`hr-${keyIdx++}`} className="border-[#1a1a1a] my-4" />); continue }
    if (/^[-*]\s/.test(line)) { inList = true; listItems.push(<li key={`li-${keyIdx++}`} className="text-sm text-[#a0a0a0] leading-relaxed pl-1">{renderInline(line.replace(/^[-*]\s/, ''))}</li>); continue }
    if (/^\d+\.\s/.test(line)) { inList = true; listItems.push(<li key={`li-${keyIdx++}`} className="text-sm text-[#a0a0a0] leading-relaxed pl-1 list-decimal ml-4">{renderInline(line.replace(/^\d+\.\s/, ''))}</li>); continue }
    if (!line.trim()) { flushList(); continue }
    flushList()
    elements.push(<p key={`p-${keyIdx++}`} className="text-sm text-[#a0a0a0] leading-relaxed mb-3">{renderInline(line)}</p>)
  }
  flushList()
  return elements
}

// ── Main Component ──
export default function HomePage() {
  const { t } = useTranslation()
  const [user, setUser] = useState(null)
  const [input, setInput] = useState('')
  const [focused, setFocused] = useState(false)
  const [placeholderText, setPlaceholderText] = useState('')
  const [mode, setMode] = useState('quick')
  const [activeResearch, setActiveResearch] = useState(null)
  const [isResearching, setIsResearching] = useState(false)
  const [error, setError] = useState('')
  const [reportDisplay, setReportDisplay] = useState('')
  const [sourcesVisible, setSourcesVisible] = useState(0)

  const textareaRef = useRef(null)
  const collapsedInputRef = useRef(null)
  const reportRef = useRef(null)
  const streamTimerRef = useRef(null)
  const chatBarRef = useRef(null)
  const typewriterRef = useRef({ phraseIdx: 0, charIdx: 0, deleting: false, timeout: null })

  const hasActiveResearch = activeResearch !== null
  const hasInput = input.trim().length > 0

  // ── Typewriter animation ──
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

  // ── Auth ──
  useEffect(() => {
    if (!supabasePublic) return
    supabasePublic.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  // ── Cleanup streaming timer ──
  useEffect(() => {
    return () => { if (streamTimerRef.current) clearInterval(streamTimerRef.current) }
  }, [])

  // ── Auto-scroll report during streaming ──
  useEffect(() => {
    if (reportRef.current && isResearching) {
      reportRef.current.scrollTop = reportRef.current.scrollHeight
    }
  }, [reportDisplay, isResearching])

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

  // ── Start Research ──
  async function startResearch(query, researchMode) {
    if (!query.trim() || isResearching) return

    const id = generateId()
    const research = {
      id,
      query: query.trim(),
      mode: researchMode,
      sources: [],
      report: '',
      data: null,
      progress: 0,
      stage: 'search',
      timestamp: Date.now(),
    }

    setActiveResearch(research)
    setIsResearching(true)
    setError('')
    setReportDisplay('')
    setSourcesVisible(0)

    // Animate progress
    const stages = researchMode === 'deep' ? DEEP_STAGES : QUICK_STAGES
    let fakeProgress = 0
    const progressInterval = setInterval(() => {
      fakeProgress += Math.random() * 3
      if (fakeProgress > 90) fakeProgress = 90
      setActiveResearch(prev => prev ? { ...prev, progress: Math.min(fakeProgress, prev.stage === 'done' ? 100 : fakeProgress) } : prev)
    }, 500)

    try {
      setTimeout(() => {
        setActiveResearch(prev => prev ? { ...prev, stage: researchMode === 'deep' ? 'analyzing' : 'writing' } : prev)
      }, 2000)
      if (researchMode === 'deep') {
        setTimeout(() => {
          setActiveResearch(prev => prev ? { ...prev, stage: 'writing' } : prev)
        }, 5000)
      }

      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: query.trim(), mode: researchMode }),
      })
      const data = await res.json()
      clearInterval(progressInterval)

      if (data.error) {
        setError(data.error)
        setIsResearching(false)
        setActiveResearch(prev => prev ? { ...prev, stage: 'done', progress: 100 } : prev)
        return
      }

      const completed = {
        id,
        query: query.trim(),
        mode: researchMode,
        sources: data.sources || [],
        report: data.report || '',
        data: data.data || null,
        progress: 100,
        stage: 'done',
        timestamp: Date.now(),
      }

      setActiveResearch(completed)
      setIsResearching(false)

      if (completed.report) streamReport(completed.report)
      if (completed.sources.length > 0) staggerSources(completed.sources.length)

      const newHistory = [completed, ...loadHistory()].slice(0, MAX_HISTORY)
      saveHistory(newHistory)
    } catch (err) {
      clearInterval(progressInterval)
      setError(err.message || 'Research failed. Please try again.')
      setIsResearching(false)
      setActiveResearch(prev => prev ? { ...prev, stage: 'done', progress: 100 } : prev)
    }
  }

  function streamReport(fullText) {
    let idx = 0
    const speed = 8
    setReportDisplay('')
    streamTimerRef.current = setInterval(() => {
      idx += speed
      if (idx >= fullText.length) {
        setReportDisplay(fullText)
        clearInterval(streamTimerRef.current)
        streamTimerRef.current = null
      } else {
        setReportDisplay(fullText.slice(0, idx))
      }
    }, 16)
  }

  function staggerSources(count) {
    setSourcesVisible(0)
    for (let i = 1; i <= count; i++) {
      setTimeout(() => setSourcesVisible(i), i * 120)
    }
  }

  function handleSubmit() {
    const q = input.trim()
    if (!q || isResearching) return
    startResearch(q, mode)
  }

  function newResearch() {
    setActiveResearch(null)
    setReportDisplay('')
    setSourcesVisible(0)
    setError('')
    setInput('')
    setIsResearching(false)
  }

  // ── Computed ──
  const stages = mode === 'deep' ? DEEP_STAGES : QUICK_STAGES
  const currentStageIdx = activeResearch ? stages.findIndex(s => s.id === activeResearch.stage) : 0
  const progressPercent = activeResearch?.progress || 0
  const sources = activeResearch?.sources || []
  const reportText = reportDisplay || activeResearch?.report || ''

  // ── Render ──
  return (
    <main className="h-dvh flex flex-col bg-[#0a0a0a] text-white overflow-hidden">

      {/* ═══════════════════════════════════════════
          STATE 1: No active research → centered greeting + big text bar
          ═══════════════════════════════════════════ */}
      {!hasActiveResearch && (
        <div className="flex-1 flex flex-col items-center justify-center px-4 overflow-y-auto">
          {/* Good Morning Builder */}
          <div className="flex flex-col items-center pb-4 animate-fade-up">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-1">
              {getGreeting()}, <span className="text-red-500">{displayName || t('discover.builder')}</span>
            </h1>
            <p className="text-[#737373] text-sm sm:text-base">
              {t('discover.greeting.subtitle')}
            </p>
          </div>

          {/* Big expanded text bar */}
          <div className="w-full max-w-2xl animate-fade-up">
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
                  {/* Mode toggle */}
                  <button
                    className={`chat-toolbar-btn ${mode === 'deep' ? 'chat-toolbar-btn-active' : ''}`}
                    onClick={() => setMode(mode === 'quick' ? 'deep' : 'quick')}
                    title={mode === 'quick' ? 'Switch to Deep mode' : 'Switch to Quick mode'}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {mode === 'deep' ? (
                        <><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>
                      ) : (
                        <><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></>
                      )}
                    </svg>
                  </button>
                  <button
                    onClick={() => setMode(mode === 'quick' ? 'deep' : 'quick')}
                    className={`text-xs px-2.5 py-1 rounded-full transition-all duration-200 border ${
                      mode === 'deep'
                        ? 'bg-red-500 text-white border-red-500 shadow-lg shadow-red-500/20'
                        : 'border-red-500/50 text-red-400'
                    }`}
                  >
                    {mode === 'deep' ? 'Deep' : 'Quick'}
                  </button>
                </div>
                <div className="chat-toolbar-right">
                  <button
                    onClick={handleSubmit}
                    disabled={!hasInput}
                    className={`chat-submit-btn ${hasInput ? 'chat-submit-btn-active' : ''}`}
                    aria-label="Start research"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════
          STATE 2: Active research → output area + collapsed input bar at bottom
          ═══════════════════════════════════════════ */}
      {hasActiveResearch && (
        <>
          {/* Research output area */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

            {/* Progress bar */}
            {activeResearch.stage !== 'done' && (
              <div className="px-4 pt-3 pb-2 animate-fade-in">
                <div className="max-w-3xl mx-auto bg-[#111111] border border-[#1a1a1a] rounded-xl p-3.5">
                  <div className="flex items-center gap-2 mb-3">
                    <IconMicroscope size={16} className="shrink-0 text-red-400" />
                    <p className="text-sm text-white font-medium truncate flex-1">{activeResearch.query}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      activeResearch.mode === 'deep' ? 'bg-red-500 text-white' : 'bg-[#1f1f1f] text-red-400 border border-red-500/30'
                    }`}>{activeResearch.mode === 'deep' ? 'Deep' : 'Quick'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mb-2.5">
                    {stages.map((stage, idx) => (
                      <div key={stage.id} className="flex items-center gap-1.5">
                        <div className={`flex items-center gap-1 text-[11px] font-medium transition-colors duration-300 ${
                          idx < currentStageIdx ? 'text-green-400' : idx === currentStageIdx ? 'text-red-400' : 'text-[#525252]'
                        }`}>
                          <stage.Icon size={12} />
                          <span className="hidden sm:inline">{stage.label}</span>
                        </div>
                        {idx < stages.length - 1 && (
                          <svg width="12" height="12" viewBox="0 0 12 12" className={idx < currentStageIdx ? 'text-green-400' : 'text-[#262626]'}>
                            <path d="M4 2l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                          </svg>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
                    <div className="h-full bg-red-500 rounded-full transition-all duration-500 ease-out" style={{ width: `${progressPercent}%` }} />
                  </div>
                </div>
              </div>
            )}

            {/* Results area — scrollable */}
            <div className="flex-1 overflow-y-auto overscroll-behavior-contain px-4 pb-4">
              <div className="max-w-3xl mx-auto space-y-3">

                {/* Query header */}
                {activeResearch.stage === 'done' && (
                  <div className="flex items-center gap-3 pt-2 animate-fade-in">
                    <IconMicroscope size={18} className="shrink-0 text-red-400" />
                    <h2 className="text-lg font-semibold text-white truncate flex-1">{activeResearch.query}</h2>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      activeResearch.mode === 'deep' ? 'bg-red-500 text-white' : 'bg-[#1f1f1f] text-red-400 border border-red-500/30'
                    }`}>{activeResearch.mode === 'deep' ? 'Deep' : 'Quick'}</span>
                  </div>
                )}

                {/* Sources */}
                {sources.length > 0 && (
                  <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl overflow-hidden animate-fade-in">
                    <div className="px-4 py-3 border-b border-[#1a1a1a] shrink-0 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-white">
                        Sources <span className="text-[#525252] font-normal">({sources.length})</span>
                      </h3>
                    </div>
                    <div className="max-h-48 overflow-y-auto custom-scrollbar divide-y divide-[#1a1a1a]">
                      {sources.map((source, idx) => (
                        <a
                          key={source.id ?? idx}
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-start gap-3 px-4 py-2.5 hover:bg-[#141414] transition-all duration-200 ${
                            idx < sourcesVisible ? 'source-visible' : 'source-hidden'
                          }`}
                        >
                          <div className="mt-1.5 shrink-0">
                            <div className="w-2 h-2 rounded-full bg-green-500/70" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              {source.favicon && <img src={source.favicon} alt="" className="w-3.5 h-3.5 rounded" />}
                              <span className="text-[10px] text-[#525252] truncate">{getDomain(source.url)}</span>
                            </div>
                            <p className="text-xs text-[#c0c0c0] font-medium leading-snug line-clamp-1">
                              {source.title}
                            </p>
                          </div>
                          <svg width="14" height="14" viewBox="0 0 14 14" className="shrink-0 text-[#333] mt-1">
                            <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                          </svg>
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Report */}
                <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl overflow-hidden animate-fade-in">
                  <div className="px-4 py-3 border-b border-[#1a1a1a] shrink-0 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">Report</h3>
                    {reportText && !isResearching && (
                      <button
                        onClick={() => navigator.clipboard.writeText(activeResearch?.report || '')}
                        className="text-[10px] text-[#525252] hover:text-white transition-colors flex items-center gap-1"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        Copy
                      </button>
                    )}
                  </div>
                  <div
                    ref={reportRef}
                    className="px-4 py-3 max-h-[calc(100vh-360px)] overflow-y-auto custom-scrollbar"
                  >
                    {!reportText && isResearching ? (
                      <div className="flex flex-col items-center justify-center py-12">
                        <div className="w-5 h-5 border-2 border-red-500/30 border-t-red-500 rounded-full animate-spin mb-3" />
                        <p className="text-xs text-[#525252]">
                          {activeResearch?.stage === 'search' ? 'Searching the web...' :
                           activeResearch?.stage === 'analyzing' ? 'Analyzing sources...' :
                           'Writing report...'}
                        </p>
                      </div>
                    ) : reportText ? (
                      <div className="report-content">
                        {renderMarkdown(reportText)}
                        {isResearching && <span className="inline-block w-0.5 h-4 bg-red-500 animate-pulse ml-0.5 align-middle" />}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12">
                        <p className="text-xs text-[#525252]">No report generated yet</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>

          {/* Collapsed input bar at bottom */}
          <div className="shrink-0 border-t border-[#1a1a1a] bg-[#0a0a0a]">
            <div className="max-w-3xl mx-auto px-3 py-3">
              <div className="research-bar-collapsed">
                {/* New research button */}
                <button
                  className="research-collapsed-btn-circle"
                  onClick={newResearch}
                  aria-label="New research"
                  title="New research"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </button>

                {/* Input */}
                <div className="research-collapsed-input-wrap">
                  <input
                    ref={collapsedInputRef}
                    type="text"
                    placeholder="Research anything..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() } }}
                    className="research-collapsed-input"
                    autoComplete="off"
                    spellCheck="false"
                    disabled={isResearching}
                  />
                </div>

                {/* Mode chip */}
                <button
                  onClick={() => setMode(mode === 'quick' ? 'deep' : 'quick')}
                  className={`text-[10px] px-2 py-1 rounded-full transition-all duration-200 border shrink-0 ${
                    mode === 'deep'
                      ? 'bg-red-500/10 text-red-400 border-red-500/20'
                      : 'bg-[#1f1f1f] text-[#737373] border-transparent'
                  }`}
                >
                  {mode === 'deep' ? 'Deep' : 'Quick'}
                </button>

                {/* Send button */}
                <button
                  onClick={handleSubmit}
                  disabled={!hasInput || isResearching}
                  className={`research-collapsed-send ${hasInput && !isResearching ? 'research-collapsed-send-active' : ''}`}
                  aria-label="Start research"
                >
                  {isResearching ? (
                    <div className="w-4 h-4 border-2 border-[#525252] border-t-red-400 rounded-full animate-spin" />
                  ) : hasInput ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24"><rect x="4" y="8" width="2" height="8" rx="1" fill="currentColor"/><rect x="8" y="5" width="2" height="14" rx="1" fill="currentColor"/><rect x="12" y="9" width="2" height="6" rx="1" fill="currentColor"/><rect x="16" y="6" width="2" height="12" rx="1" fill="currentColor"/><rect x="20" y="10" width="2" height="4" rx="1" fill="currentColor"/></svg>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Error toast */}
      {error && (
        <div className="fixed top-4 right-4 z-[100] bg-red-950/90 border border-red-800/50 rounded-xl px-4 py-3 max-w-sm animate-slide-in-right backdrop-blur-sm">
          <div className="flex items-start gap-2.5">
            <IconWarning size={14} className="text-red-400 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-xs text-red-300 font-medium mb-0.5">Research Error</p>
              <p className="text-[11px] text-red-400/80">{error}</p>
            </div>
            <button onClick={() => setError('')} className="text-red-500/50 hover:text-red-400 transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      )}

      {/* ── CSS ── */}
      <style jsx>{`
        /* ─── Big expanded text bar (initial state) ─── */
        .chat-container-expanded {
          width: 100%;
          position: relative;
          isolation: isolate;
          background-color: transparent;
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 20px;
          padding: 16px 16px 10px 16px;
          display: flex;
          flex-direction: column;
          transition: border-color 0.3s ease;
          overflow: visible;
        }
        .chat-container-expanded:focus-within {
          border-color: transparent;
        }
        .chat-container-expanded:focus-within::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 20px;
          padding: 1.5px;
          background: linear-gradient(90deg, #a855f7, #ef4444);
          -webkit-mask:
            linear-gradient(#fff 0 0) content-box,
            linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
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
        .chat-textarea-expanded.no-caret { caret-color: transparent; }
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
        .chat-toolbar-btn-active {
          background-color: rgba(220, 38, 38, 0.12) !important;
          color: #ef4444 !important;
        }
        .chat-toolbar-btn-active:hover {
          background-color: rgba(220, 38, 38, 0.18) !important;
          color: #f87171 !important;
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
        .chat-submit-btn:disabled { cursor: not-allowed; opacity: 0.5; }
        .chat-submit-btn-active { background: #e2e2e2; color: #0a0a0a; }
        .chat-submit-btn-active:hover { background: #ffffff; transform: scale(1.05); }

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

        /* ─── Collapsed pill bar (research active state) ─── */
        .research-bar-collapsed {
          display: flex;
          align-items: center;
          background: rgba(255,255,255,0.04);
          border-radius: 28px;
          padding: 8px 12px;
          gap: 8px;
          border: 1px solid rgba(255,255,255,0.06);
          min-height: 56px;
          transition: border-color 0.3s ease;
          position: relative;
        }
        .research-bar-collapsed:focus-within { border-color: transparent; }
        .research-bar-collapsed:focus-within::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 28px;
          padding: 1.5px;
          background: linear-gradient(90deg, #a855f7, #ef4444);
          -webkit-mask:
            linear-gradient(#fff 0 0) content-box,
            linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }
        .research-collapsed-btn-circle {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: none;
          background: rgba(255,255,255,0.04);
          color: #525252;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: background 0.15s ease, color 0.15s ease;
          padding: 0;
        }
        .research-collapsed-btn-circle:hover {
          background: rgba(255,255,255,0.08);
          color: #e2e2e2;
        }
        .research-collapsed-input-wrap {
          flex: 1;
          min-width: 0;
          display: flex;
          align-items: center;
        }
        .research-collapsed-input {
          width: 100%;
          height: 36px;
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
          background: transparent;
          font-size: 16px;
          color: #e2e2e2;
          padding: 0 4px;
          font-family: inherit;
        }
        .research-collapsed-input::placeholder { color: #525252; opacity: 1; }
        .research-collapsed-input:disabled { opacity: 0.6; }
        .research-collapsed-send {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: none;
          background: rgba(255,255,255,0.06);
          color: #737373;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          transition: background 0.15s ease, transform 0.1s ease, opacity 0.15s ease, color 0.15s ease;
          padding: 0;
        }
        .research-collapsed-send:disabled { cursor: not-allowed; opacity: 0.5; }
        .research-collapsed-send-active { background: #e2e2e2; color: #0a0a0a; }
        .research-collapsed-send-active:hover { background: #ffffff; transform: scale(1.05); }

        /* ─── Shared ─── */
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .scrollbar-none { -ms-overflow-style: none; scrollbar-width: none; }

        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #262626; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #333; }

        .citation-number {
          color: #f87171;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          padding: 0 1px;
          transition: color 0.15s;
        }
        .citation-number:hover { color: #fca5a5; }

        .report-content h1 { font-size: 1.25rem; font-weight: 700; color: #fff; margin-top: 1rem; margin-bottom: 0.75rem; }
        .report-content h2 { font-size: 1.1rem; font-weight: 600; color: #fff; margin-top: 1.25rem; margin-bottom: 0.5rem; }
        .report-content h3 { font-size: 1rem; font-weight: 600; color: #fff; margin-top: 1rem; margin-bottom: 0.5rem; }
        .report-content p { font-size: 0.875rem; color: #a0a0a0; line-height: 1.7; margin-bottom: 0.75rem; }
        .report-content ul { margin-bottom: 0.75rem; padding-left: 0.25rem; }
        .report-content li { font-size: 0.875rem; color: #a0a0a0; line-height: 1.7; padding-left: 0.25rem; }
        .report-content strong { color: #fff; font-weight: 600; }
        .report-content a { color: #f87171; text-decoration: underline; text-underline-offset: 2px; }
        .report-content hr { border-color: #1a1a1a; margin: 1rem 0; }

        .source-visible { animation: source-slide-up 0.3s ease-out forwards; }
        .source-hidden { opacity: 0; }

        @keyframes fade-up {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-up { animation: fade-up 0.5s ease-out forwards; }

        @keyframes fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.4s ease-out forwards; }

        @keyframes slide-in-right {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-slide-in-right { animation: slide-in-right 0.3s ease-out forwards; }

        @keyframes source-slide-up {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </main>
  )
}
