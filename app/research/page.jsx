'use client'
import { useState, useEffect, useRef, useMemo, Suspense, memo } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { useTranslation } from '@/components/LanguageProvider'
import dynamic from 'next/dynamic'
import remarkGfm from 'remark-gfm'
const ReactMarkdown = dynamic(() => import('react-markdown'), { ssr: false })
import { supabasePublic } from '@/lib/supabase'
import { IconSearch, IconWrite, IconCheck, IconChartBar, IconDna, IconTrending, IconRocket, IconHeart, IconMicroscope, IconWarning } from '@/components/Icons'

// ── Constants ──
const STORAGE_KEY = 'kivora-research-history'
const MAX_HISTORY = 20 // Fix #9: reduced from 30

const SUGGESTED_TOPICS = [
  { Icon: IconDna, label: 'AI & Machine Learning Trends' },
  { Icon: IconTrending, label: 'Crypto & Market Analysis' },
  { Icon: IconRocket, label: 'Space Technology' },
  { Icon: IconHeart, label: 'Health & Biotech' },
]

const TYPEWRITER_PHRASES = SUGGESTED_TOPICS.map(t => t.label)

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

const PIPELINE_STAGES_QUICK = [
  { id: 'search', name: 'Searching the web', detail: 'Finding relevant sources and information' },
  { id: 'writing', name: 'Generating report', detail: 'Composing comprehensive research report' },
]

const PIPELINE_STAGES_DEEP = [
  { id: 'search', name: 'Searching the web', detail: 'Finding relevant sources and information' },
  { id: 'analyzing', name: 'Analyzing & verifying', detail: 'Evaluating credibility, verifying claims, and extracting key insights' },
  { id: 'writing', name: 'Compiling wiki page', detail: 'Generating research report and compiling into persistent wiki' },
]

const APEX_MODELS = [
  { id: 'apex-free', name: 'Apex 1.7', tag: 'Free', color: 'gray' },
  { id: 'apex-premium', name: 'Apex 2.3', tag: 'Premium', color: 'red' },
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

// ── Heading patterns that indicate a duplicate Sources/References section ──
const DUPLICATE_SOURCE_HEADINGS = /^(#\s*)?(sources|references|bibliography|citations|works?\s+cited)\s*$/i

// ── Markdown-to-HTML Renderer (returns HTML string, not JSX) ──
function markdownToHtml(text, { skipDuplicateSources = false } = {}) {
  if (!text) return ''
  const lines = text.split('\n')
  const html = []
  let inList = false
  let listItems = []
  let inTable = false
  let tableRows = []
  let tableHeaders = []
  let skipMode = false

  function esc(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  function flushList() {
    if (listItems.length > 0) {
      html.push(`<ul class="space-y-1 mb-3 ml-1">${listItems.join('')}</ul>`)
      listItems = []
    }
    inList = false
  }

  function flushTable() {
    if (tableHeaders.length > 0) {
      const thead = '<tr>' + tableHeaders.map(h => `<th>${renderInline(h)}</th>`).join('') + '</tr>'
      const tbody = tableRows.map(row => '<tr>' + row.map(cell => `<td>${renderInline(cell)}</td>`).join('') + '</tr>').join('')
      html.push(`<div class="-mx-1 px-1 mb-3"><table class="w-full border-collapse"><thead>${thead}</thead><tbody>${tbody}</tbody></table></div>`)
    }
    tableHeaders = []
    tableRows = []
    inTable = false
  }

  function renderInline(str) {
    let s = esc(str)
    s = s.replace(/(\*\*|__)(.*?)\1/g, '<strong class="text-white font-semibold">$2</strong>')
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-red-400 hover:text-red-300 underline underline-offset-2">$1</a>')
    s = s.replace(/\[(\d+)\]/g, '<span class="citation-number">[$1]</span>')
    return s
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Detect duplicate Sources/References heading — skip everything until the next heading of same or higher level
    if (skipDuplicateSources && DUPLICATE_SOURCE_HEADINGS.test(line.trim())) {
      flushList()
      flushTable()
      const headingLevel = line.match(/^(#{1,3})\s/)?.[1]?.length || 0
      skipMode = headingLevel
      continue
    }
    // Exit skip mode when we hit a new heading at same or higher level
    if (skipMode) {
      const newHeadingMatch = line.match(/^(#{1,3})\s/)
      if (newHeadingMatch) {
        const newLevel = newHeadingMatch[1].length
        if (newLevel <= skipMode) {
          skipMode = false
          // Don't continue — process this heading normally
        } else {
          continue // Still inside the duplicate section (sub-heading)
        }
      } else if (/^---+$/.test(line.trim())) {
        // Horizontal rule might end the section
        skipMode = false
        continue
      } else {
        continue // Skip content inside duplicate section
      }
    }

    // Table row detection: lines containing pipes
    if (line.includes('|') && line.trim().startsWith('|')) {
      flushList()
      const cells = line.split('|').filter(c => c.trim() !== '').map(c => c.trim())
      // Separator row (|---|---|)
      if (cells.every(c => /^[-:]+$/.test(c))) {
        inTable = true
        continue
      }
      if (!inTable && tableHeaders.length === 0) {
        // First row = header
        tableHeaders = cells
        inTable = true
        continue
      }
      if (inTable) {
        tableRows.push(cells)
        continue
      }
    } else if (inTable) {
      // End of table
      flushTable()
    }

    if (line.startsWith('### ')) { flushList(); html.push(`<h3 class="text-base font-semibold text-white mt-5 mb-2">${renderInline(line.slice(4))}</h3>`); continue }
    if (line.startsWith('## ')) { flushList(); html.push(`<h2 class="text-lg font-semibold text-white mt-6 mb-2.5">${renderInline(line.slice(3))}</h2>`); continue }
    if (line.startsWith('# ')) { flushList(); html.push(`<h1 class="text-xl font-bold text-white mt-4 mb-3">${renderInline(line.slice(2))}</h1>`); continue }
    if (/^---+$/.test(line.trim())) { flushList(); html.push(`<hr class="border-[#1a1a1a] my-4" />`); continue }
    if (/^[-*]\s/.test(line)) { inList = true; listItems.push(`<li class="text-sm text-[#a0a0a0] leading-relaxed pl-1">${renderInline(line.replace(/^[-*]\s/, ''))}</li>`); continue }
    if (/^\d+\.\s/.test(line)) { inList = true; listItems.push(`<li class="text-sm text-[#a0a0a0] leading-relaxed pl-1 list-decimal ml-4">${renderInline(line.replace(/^\d+\.\s/, ''))}</li>`); continue }
    if (!line.trim()) { flushList(); continue }
    flushList()
    html.push(`<p class="text-sm text-[#a0a0a0] leading-relaxed mb-3">${renderInline(line)}</p>`)
  }
  flushList()
  flushTable()
  return html.join('')
}

// ── Filter duplicate Sources/References from HTML content (dangerouslySetInnerHTML path) ──
function filterDuplicateSources(html) {
  if (!html) return html
  // Remove sections headed by Sources/References/Bibliography etc.
  return html.replace(/<h[1-3][^>]*>\s*(Sources|References|Bibliography|Citations|Works?\s+Cited)\s*<\/h[1-3]>[\s\S]*?(?=<h[1-3][^>]*>|$)/gi, '')
}

// ── Kivora Research Thinking State (CSS-only, no LLM credits) ──
const KivoraResearchThinking = memo(function KivoraResearchThinking({ stage, sourceCount, mode }) {
  const stageLabels = {
    search: 'Searching',
    analyzing: 'Analyzing',
    writing: 'Writing',
  }
  const label = stageLabels[stage] || 'Researching'
  const isWriting = stage === 'writing'

  return (
    <div className="kivora-thinking">
      {/* Waveform animation */}
      <div className="kivora-thinking-wave">
        <span className="kivora-thinking-bar" style={{ animationDelay: '0s' }} />
        <span className="kivora-thinking-bar" style={{ animationDelay: '0.15s' }} />
        <span className="kivora-thinking-bar" style={{ animationDelay: '0.3s' }} />
        <span className="kivora-thinking-bar" style={{ animationDelay: '0.45s' }} />
        <span className="kivora-thinking-bar" style={{ animationDelay: '0.6s' }} />
      </div>

      {/* Stage label */}
      <div className="kivora-thinking-label">
        {label}
        <span className="kivora-thinking-cursor" />
      </div>

      {/* Source count badge */}
      {sourceCount > 0 && (
        <div className="kivora-thinking-sources">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          {sourceCount} {sourceCount === 1 ? 'source' : 'sources'}
        </div>
      )}

      {/* Progress line */}
      <div className="kivora-thinking-track">
        <div className={`kivora-thinking-fill ${isWriting ? 'kivora-thinking-fill-writing' : ''}`} />
      </div>
    </div>
  )
})

// ── Main Component (with Suspense wrapper for useSearchParams) ──
export default function ResearchPage() {
  return (
    <Suspense fallback={<main className="h-full flex items-center justify-center bg-[#0a0a0a] text-white"><div className="w-6 h-6 border-2 border-[#262626] border-t-red-500 rounded-full animate-spin" /></main>}>
      <ResearchPageContent />
    </Suspense>
  )
}

function ResearchPageContent() {
  const { t } = useTranslation()
  const searchParams = useSearchParams()
  const router = useRouter()
  const initialQuery = searchParams.get('q') || ''
  const [user, setUser] = useState(null)
  const [input, setInput] = useState('')
  const [focused, setFocused] = useState(false)
  const [placeholderText, setPlaceholderText] = useState('')
  const [collapsedPlaceholder, setCollapsedPlaceholder] = useState('')
  const [mode, setMode] = useState('quick')
  const [apexModel, setApexModel] = useState('apex-free')
  const [activeResearch, setActiveResearch] = useState(null)
  const [isResearching, setIsResearching] = useState(false)
  const [error, setError] = useState('')
  const [reportDisplay, setReportDisplay] = useState('')
  const [sourcesVisible, setSourcesVisible] = useState(0)
  const [sourcesExpanded, setSourcesExpanded] = useState(false)
  const [history, setHistory] = useState([])
  const [progress, setProgress] = useState(0)
  const [researchStage, setResearchStage] = useState('search')

  const textareaRef = useRef(null)
  const collapsedInputRef = useRef(null)
  const reportRef = useRef(null)
  const progressRef = useRef(null)
  const stageTimersRef = useRef([])

  const chatBarRef = useRef(null)
  const fileInputRef = useRef(null)
  const collapsedFileInputRef = useRef(null)
  const typewriterRef = useRef({ phraseIdx: 0, charIdx: 0, deleting: false, timeout: null })
  const collapsedTypewriterRef = useRef({ phraseIdx: 0, charIdx: 0, deleting: false, timeout: null })

  const hasActiveResearch = activeResearch !== null
  const hasInput = input.trim().length > 0

  // ── Typewriter animation for big text bar (Fix #10: fully canceled during research) ──
  useEffect(() => {
    const tw = typewriterRef.current
    // Fix #10: When researching, clear timers and placeholder — restart when done
    if (isResearching) {
      clearTimeout(tw.timeout)
      setPlaceholderText('')
      return
    }
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
  }, [isResearching])

  // ── Typewriter animation for collapsed input (Fix #10: fully canceled during research) ──
  useEffect(() => {
    const tw = collapsedTypewriterRef.current
    // Fix #10: When researching, clear timers and placeholder
    if (isResearching) {
      clearTimeout(tw.timeout)
      setCollapsedPlaceholder('')
      return
    }
    function tick() {
      const phrase = TYPEWRITER_PHRASES[tw.phraseIdx]
      if (!tw.deleting) {
        tw.charIdx++
        setCollapsedPlaceholder(phrase.slice(0, tw.charIdx))
        if (tw.charIdx >= phrase.length) {
          tw.timeout = setTimeout(() => { tw.deleting = true; tick() }, 2000)
          return
        }
        tw.timeout = setTimeout(tick, 50 + Math.random() * 40)
      } else {
        tw.charIdx--
        setCollapsedPlaceholder(phrase.slice(0, tw.charIdx))
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
  }, [isResearching])

  // ── Load history on mount ──
  useEffect(() => {
    setHistory(loadHistory())
  }, [])

  // ── Auto-start research if query in URL ──
  useEffect(() => {
    if (initialQuery && !isResearching && !activeResearch) {
      setInput(initialQuery)
      startResearch(initialQuery, mode)
    }
  }, [initialQuery]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auth ──
  useEffect(() => {
    if (!supabasePublic) return
    supabasePublic.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  // ── Cleanup progress interval and stage timers on unmount ──
  useEffect(() => {
    return () => {
      if (progressRef.current) clearInterval(progressRef.current)
      stageTimersRef.current.forEach(t => clearTimeout(t))
    }
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

  // Generate fallback follow-up questions when the LLM doesn't provide them
  function generateFallbackFollowups(query) {
    const q = query.trim()
    if (!q) return []
    return [
      `What are the latest developments in ${q}?`,
      `What are the main criticisms or controversies around ${q}?`,
      `How does ${q} compare to alternative approaches?`,
    ]
  }

  // ── Start Research ──
  async function startResearch(query, researchMode) {
    if (!query.trim() || isResearching) return

    const id = generateId()
    const research = {
      id,
      query: query.trim(),
      mode: researchMode,
      apexModel,
      sources: [],
      report: '',
      data: null,
      timestamp: Date.now(),
    }

    setActiveResearch(research)
    setIsResearching(true)
    setError('')
    setReportDisplay('')
    setSourcesVisible(0)
    setProgress(0)
    setResearchStage('search')

    // Clean up any existing timers
    stageTimersRef.current.forEach(t => clearTimeout(t))
    stageTimersRef.current = []
    if (progressRef.current) clearInterval(progressRef.current)

    // Animate progress — Fix #6: creep to 95%, hit 100% only on completion
    let fakeProgress = 0
    progressRef.current = setInterval(() => {
      if (fakeProgress < 30) {
        fakeProgress += 2 + Math.random() * 3
      } else if (fakeProgress < 60) {
        fakeProgress += 1 + Math.random() * 2
      } else if (fakeProgress < 85) {
        fakeProgress += 0.5 + Math.random() * 1
      } else {
        // After 85%, very slow creep — cap at 95%
        fakeProgress = Math.min(fakeProgress + 0.5 * Math.random(), 95)
      }
      setProgress(Math.min(fakeProgress, 95))
    }, 800)

    try {
      const t1 = setTimeout(() => {
        setResearchStage(researchMode === 'deep' ? 'analyzing' : 'writing')
      }, 800)
      stageTimersRef.current.push(t1)

      if (researchMode === 'deep') {
        const t2 = setTimeout(() => { setResearchStage('writing') }, 2500)
        stageTimersRef.current.push(t2)
      }

      // Call our server-side proxy — it forwards to the Worker with the API key
      // This avoids CORS issues and keeps the API key secure (never exposed to browser)
      //
      // RACE STRATEGY (fixes slow quick-mode):
      // Previously: fetch /api/research → wait up to 30s → if it errors, fetch
      // /api/research-fallback → wait another ~11s. Total worst case ~41s.
      // Now: race BOTH endpoints in parallel via Promise.any. The first one to
      // return a non-error response wins. Worker wins when it's reachable
      // (~20-30s, with cache hits + wiki metadata); fallback wins when worker
      // is unreachable or slow (~11s). Either way, user sees results in ~11s.
      //
      // Each fetch is wrapped so it rejects on HTTP error / error field / abort,
      // so Promise.any only resolves with the first VALID result.

      const primaryController = new AbortController()
      const fallbackController = new AbortController()
      const primaryTimeout = setTimeout(() => primaryController.abort(), researchMode === 'deep' ? 120000 : 30000)
      const fallbackTimeout = setTimeout(() => fallbackController.abort(), researchMode === 'deep' ? 90000 : 30000)

      const body = JSON.stringify({ query: query.trim(), mode: researchMode, apex_model: apexModel })

      const primaryPromise = fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: primaryController.signal,
      }).then(async r => {
        const data = await r.json()
        if (!r.ok || data.error) {
          throw new Error(data.error || `worker_${r.status}`)
        }
        return { data, usedFallback: false }
      }).finally(() => clearTimeout(primaryTimeout))

      const fallbackPromise = fetch('/api/research-fallback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        signal: fallbackController.signal,
      }).then(async r => {
        const data = await r.json()
        if (!r.ok || data.error) {
          throw new Error(data.error || `fallback_${r.status}`)
        }
        return { data, usedFallback: true }
      }).finally(() => clearTimeout(fallbackTimeout))

      let data
      let usedFallback = false

      try {
        const winner = await Promise.any([primaryPromise, fallbackPromise])
        data = winner.data
        usedFallback = winner.usedFallback
        // Cancel the loser
        if (usedFallback) primaryController.abort()
        else fallbackController.abort()
      } catch (aggregateErr) {
        // Both failed — fall through to error handling below
        const tried = aggregateErr?.errors?.map(e => e.message).filter(Boolean).join(' | ') || 'all providers failed'
        data = { error: tried }
        // Make sure both timeouts are cleared
        clearTimeout(primaryTimeout)
        clearTimeout(fallbackTimeout)
      }

      clearInterval(progressRef.current)
      progressRef.current = null
      stageTimersRef.current.forEach(t => clearTimeout(t))
      stageTimersRef.current = []

      if (data.error) {
        setError(data.error)
        setIsResearching(false)
        setResearchStage('done')
        setProgress(100)
        return
      }

      const completed = {
        id,
        query: query.trim(),
        mode: researchMode,
        apexModel,
        sources: data.sources || [],
        report: data.report || '',
        content: data.content || '',
        title: data.title || query.trim(),
        followups: data.followups || [],
        data: data.data || null,
        timestamp: Date.now(),
        fallback: usedFallback || data.fallback || false,
        fallbackProvider: data.fallback_provider || null,
        fallbackModel: data.fallback_model || null,
        // APEX 2.0 Wiki fields
        wikiPageId: data.wiki_page_id || data.wikiPageId || null,
        wikiCacheId: data.wiki_cache_id || data.wikiCacheId || null,
        wikiLifecycle: data.wiki_lifecycle || data.wikiLifecycle || 'draft',
        wikiSlug: data.wiki_slug || data.wikiSlug || '',
        wikiVersion: data.wiki_version || data.wikiVersion || 0,
        fromCache: data.from_cache || data.fromCache || false,
      }

      setActiveResearch(completed)
      setIsResearching(false)
      setResearchStage('done')
      setProgress(100)
      setReportDisplay(completed.report)
      setSourcesVisible(completed.sources.length)

      // Fix #9: Only store minimal fields in history, not full reports
      const minimalCompleted = { id: completed.id, query: completed.query, mode: completed.mode, apexModel: completed.apexModel, title: completed.title, timestamp: completed.timestamp }
      const newHistory = [minimalCompleted, ...loadHistory()].slice(0, MAX_HISTORY)
      saveHistory(newHistory)
      setHistory(newHistory)
    } catch (err) {
      clearInterval(progressRef.current)
      progressRef.current = null
      stageTimersRef.current.forEach(t => clearTimeout(t))
      stageTimersRef.current = []
      let msg = err.message || 'Research failed. Please try again.'
      if (err.name === 'AbortError') msg = 'Research timed out. Please try again or use Quick mode.'
      else if (msg === 'Failed to fetch') msg = 'Network error. Please check your connection and try again.'
      setError(msg)
      setIsResearching(false)
      setResearchStage('done')
      setProgress(100)
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
    setProgress(0)
    setResearchStage('search')
  }

  function loadResearch(item) {
    // Ensure item has all expected fields (guard against stale localStorage data)
    const safeItem = {
      ...item,
      apexModel: item.apexModel || 'apex-free',
      mode: item.mode || 'quick',
      sources: Array.isArray(item.sources) ? item.sources : [],
      followups: Array.isArray(item.followups) ? item.followups : [],
      report: item.report || '',
      content: item.content || '',
      title: item.title || item.query || '',
    }
    setActiveResearch(safeItem)
    setReportDisplay(safeItem.report)
    setSourcesVisible(safeItem.sources.length)
    setError('')
    setIsResearching(false)
    setResearchStage('done')
    setProgress(100)
    try {
      router.push(`/research?q=${encodeURIComponent(safeItem.query)}`, { scroll: false })
    } catch (e) {
      // Fix #11: router.push instead of router.replace for back-button; router.replace may throw in certain Next.js contexts; safe to ignore
    }
  }

  function handleFollowup(question) {
    setInput(question)
    startResearch(question, mode)
  }

  // ── Computed ──
  const stages = mode === 'deep' ? DEEP_STAGES : QUICK_STAGES
  const currentStageIdx = stages.findIndex(s => s.id === researchStage)
  const pipelineStages = activeResearch?.mode === 'deep' ? PIPELINE_STAGES_DEEP : PIPELINE_STAGES_QUICK
  const currentPipelineIdx = pipelineStages.findIndex(s => s.id === researchStage)
  const progressPercent = progress
  const sources = activeResearch?.sources || []
  const reportText = reportDisplay || activeResearch?.report || ''
  // Fix #12: No more client-side markdownToHtml — ReactMarkdown handles rendering

  // ── Render ──
  return (
    <main className="h-full flex flex-col bg-[#0a0a0a] text-white overflow-hidden">

      {/* ═══════════════════════════════════════════
          STATE 1: No active research → centered greeting + big text bar
          ═══════════════════════════════════════════ */}
      {!hasActiveResearch && (
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="flex flex-col items-center px-4 pt-[30vh] shrink-0">
          {/* Good Morning Builder */}
          <div className="flex flex-col items-center pb-4 animate-fade-up">
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight mb-1">
              {getGreeting()}, <span className="text-red-500">{displayName || t('discover.builder')}</span>
            </h1>
            <p className="text-[#737373] text-sm sm:text-base">
              {t('discover.greeting.subtitle')}
            </p>
          </div>

          <div className="w-full max-w-2xl animate-fade-up">
            {/* History pills — scrollable row above text bar */}
            {history.length > 0 && (
              <div className="flex gap-2 mb-3 overflow-x-auto scrollbar-none pb-0.5 px-1">
                {history.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => loadResearch(item)}
                    className="flex items-center gap-2 bg-transparent border border-[#1f1f1f] text-[#737373] hover:bg-[#0f0f0f] hover:border-[#2a2a2a] hover:text-white hover:-translate-y-px px-3.5 py-2 rounded-full text-[12px] font-normal cursor-pointer transition-all duration-200 tracking-[-0.01em] whitespace-nowrap shrink-0 max-w-[180px]"
                  >
                    <IconMicroscope size={12} className="shrink-0 text-red-400/60" />
                    <span className="truncate">{item.query}</span>
                  </button>
                ))}
              </div>
            )}

          {/* Big expanded text bar */}
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
                  {/* File upload button */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    multiple
                    onChange={e => {
                      const files = Array.from(e.target.files || [])
                      if (files.length > 0) {
                        // TODO: process attached files with research query
                        setInput(prev => prev ? prev + ' ' + files.map(f => f.name).join(', ') : files.map(f => f.name).join(', '))
                      }
                      e.target.value = ''
                    }}
                  />
                  {/* Fix #4: File attachment disabled — coming soon */}
                  <button
                    className="chat-toolbar-btn"
                    title="File attachments coming soon"
                    disabled
                    style={{ opacity: 0.4, cursor: 'not-allowed' }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                    </svg>
                  </button>
                  {/* Apex model selector dropdown */}
                  <div className="relative" style={{position:'relative'}}>
                    <button
                      onClick={() => {
                        const next = apexModel === 'apex-free' ? 'apex-premium' : 'apex-free'
                        setApexModel(next)
                      }}
                      className={`text-xs px-2.5 py-1 rounded-full transition-all duration-200 border ml-0.5 flex items-center gap-1 ${
                        apexModel === 'apex-premium'
                          ? 'bg-[rgba(220,38,38,0.12)] text-[#ef4444] border-[rgba(220,38,38,0.2)]'
                          : 'text-[#525252] border-[rgba(255,255,255,0.06)]'
                      }`}
                    >
                      {apexModel === 'apex-premium' ? 'Apex 2.3' : 'Apex 1.7'}
                    </button>
                  </div>
                  <button
                    onClick={() => setMode(mode === 'quick' ? 'deep' : 'quick')}
                    className={`text-xs px-2.5 py-1 rounded-full transition-all duration-200 border ml-0.5 ${
                      mode === 'deep'
                        ? 'bg-[rgba(168,85,247,0.12)] text-[#a855f7] border-[rgba(168,85,247,0.2)]'
                        : 'text-[#525252] border-[rgba(255,255,255,0.06)]'
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
        </div>
      )}

      {/* ═══════════════════════════════════════════
          STATE 2: Active research → output area + collapsed input bar at bottom
          ═══════════════════════════════════════════ */}
      {hasActiveResearch && (
        <>
          {/* Research output area — single scroll container */}
          <div className="flex-1 min-h-0 overflow-y-auto">

            {/* Progress pipeline */}
            {researchStage !== 'done' && (
              <div className="px-4 pt-5 pb-3 animate-fade-in">
                <div className="max-w-3xl mx-auto research-pipeline-card">
                  {/* Header */}
                  <div className="research-pipeline-header">
                    <div className="research-pipeline-pulse" />
                    <p className="research-pipeline-query">{activeResearch.query}</p>
                    <span className={`research-pipeline-mode ${
                      activeResearch.mode === 'deep' ? 'research-pipeline-mode-deep' : 'research-pipeline-mode-quick'
                    }`}>{activeResearch.mode === 'deep' ? 'Deep' : 'Quick'} · {activeResearch.apexModel === 'apex-premium' ? 'Apex 2.3' : 'Apex 1.7'}</span>
                  </div>

                  {/* Vertical stage pipeline */}
                  <div className="research-stages">
                    {pipelineStages.map((stage, idx) => {
                      const stageState = idx < currentPipelineIdx ? 'done' : idx === currentPipelineIdx ? 'active' : 'pending'
                      return (
                        <div key={stage.id} className={`research-stage research-stage-${stageState}`}>
                          <div className="research-stage-icon">
                            {stage.id === 'search' && (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
                            )}
                            {stage.id === 'analyzing' && (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 20V10" /><path d="M12 20V4" /><path d="M6 20v-6" /></svg>
                            )}
                            {stage.id === 'writing' && (
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                            )}
                          </div>
                          <div className="research-stage-body">
                            <div className="research-stage-name">{stage.name}</div>
                            <div className="research-stage-detail">{stage.detail}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Progress bar */}
                  <div className="research-pipeline-progress">
                    <div className="research-pipeline-progress-bar" style={{ width: `${progressPercent}%` }} />
                  </div>
                </div>
              </div>
            )}

            {/* Results area — content flows naturally, parent scrolls */}
            <div ref={reportRef} className="px-4 pb-4">
              <div className="max-w-4xl mx-auto space-y-4">

                {/* Query header */}
                {researchStage === 'done' && (
                  <div className="flex items-center gap-3 pt-3 animate-fade-in">
                    <IconMicroscope size={18} className="shrink-0 text-red-400" />
                    <h2 className="text-lg font-semibold text-white truncate flex-1">{activeResearch.query}</h2>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      activeResearch.mode === 'deep' ? 'bg-red-500 text-white' : 'bg-[#1f1f1f] text-red-400 border border-red-500/30'
                    }`}>{activeResearch.mode === 'deep' ? 'Deep' : 'Quick'} · {activeResearch.apexModel === 'apex-premium' ? 'Apex 2.3' : 'Apex 1.7'}</span>
                    {/* APEX 2.0 Wiki & Cache badges */}
                    {activeResearch.fromCache && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-blue-500/10 text-blue-400 border border-blue-500/30">
                        Cached
                      </span>
                    )}
                    {activeResearch.wikiLifecycle && activeResearch.wikiLifecycle !== 'draft' && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        activeResearch.wikiLifecycle === 'active' ? 'bg-green-500/10 text-green-400 border border-green-500/30' :
                        activeResearch.wikiLifecycle === 'stale' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30' :
                        activeResearch.wikiLifecycle === 'contradicted' ? 'bg-orange-500/10 text-orange-400 border border-orange-500/30' :
                        'bg-gray-500/10 text-gray-400 border border-gray-500/30'
                      }`}>
                        Wiki · {activeResearch.wikiLifecycle}{activeResearch.wikiVersion > 0 ? ` v${activeResearch.wikiVersion}` : ''}
                      </span>
                    )}
                    {reportText && !isResearching && (
                      <button
                        onClick={() => navigator.clipboard.writeText(activeResearch?.report || '')}
                        className="text-[10px] text-[#525252] hover:text-white transition-colors flex items-center gap-1 shrink-0"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        Copy
                      </button>
                    )}
                  </div>
                )}

                {/* Sources — collapsible card */}
                {sources.length > 0 && (
                  <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl overflow-hidden animate-fade-in">
                    <button
                      onClick={() => setSourcesExpanded(!sourcesExpanded)}
                      className="w-full px-4 py-3 shrink-0 flex items-center justify-between cursor-pointer hover:bg-[#141414] transition-colors duration-200"
                    >
                      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-green-500/70"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>
                        Sources <span className="text-[#525252] font-normal">({sources.length})</span>
                      </h3>
                      <svg
                        width="16" height="16" viewBox="0 0 16 16"
                        className={`shrink-0 text-[#525252] transition-transform duration-300 ${sourcesExpanded ? 'rotate-180' : ''}`}
                      >
                        <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </svg>
                    </button>
                    <div
                      className={`transition-all duration-300 ease-in-out overflow-hidden ${sourcesExpanded ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}
                    >
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
                              <div className={`w-2 h-2 rounded-full ${
                                source.tier === 'P1' ? 'bg-emerald-400' :
                                source.tier === 'P2' ? 'bg-blue-400' :
                                source.tier === 'P3' ? 'bg-yellow-400/70' :
                                'bg-gray-500/50'
                              }`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                {source.favicon && <img src={source.favicon} alt="" className="w-3.5 h-3.5 rounded" />}
                                <span className="text-[10px] text-[#525252] truncate">{getDomain(source.url)}</span>
                                {source.tier && (
                                  <span className={`text-[8px] px-1 py-0 rounded font-medium ${
                                    source.tier === 'P1' ? 'bg-emerald-500/10 text-emerald-400' :
                                    source.tier === 'P2' ? 'bg-blue-500/10 text-blue-400' :
                                    source.tier === 'P3' ? 'bg-yellow-500/10 text-yellow-400' :
                                    'bg-gray-500/10 text-gray-500'
                                  }`}>{source.tier}</span>
                                )}
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
                  </div>
                )}

                {/* Report — cardless, flows directly on background */}
                {!reportText && isResearching ? (
                  <KivoraResearchThinking
                    stage={researchStage}
                    sourceCount={sourcesVisible}
                    mode={activeResearch.mode}
                  />
                ) : reportText ? (
                  <div className="report-body animate-fade-in prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{reportText}</ReactMarkdown>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 animate-fade-in">
                    <p className="text-xs text-[#525252]">No report generated yet</p>
                  </div>
                )}

                {/* Follow-up Questions */}
                {researchStage === 'done' && (() => {
                  const followups = activeResearch.followups?.length > 0
                    ? activeResearch.followups
                    : generateFallbackFollowups(activeResearch.query)
                  return followups.length > 0 ? (
                    <div className="animate-fade-in">
                      <h3 className="text-sm font-semibold text-white mb-2">Follow-up Questions</h3>
                      <div className="flex flex-wrap gap-2">
                        {followups.map((q, i) => (
                          <button
                            key={i}
                            onClick={() => handleFollowup(q)}
                            className="text-xs px-3 py-2 rounded-full bg-transparent border border-[#1f1f1f] text-[#a0a0a0] hover:bg-[#0f0f0f] hover:border-[#2a2a2a] hover:text-white transition-all duration-200 cursor-pointer text-left"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null
                })()}

              </div>
            </div>
          </div>

          {/* Collapsed input bar at bottom */}
          <div className="shrink-0 border-t border-[#1a1a1a] bg-[#0a0a0a]">
            <div className="max-w-3xl mx-auto px-4 py-3.5">
              {/* History pills above collapsed bar — always visible except during active research */}
              {!isResearching && history.length > 0 && (
                <div className="flex gap-2 mb-3 overflow-x-auto scrollbar-none pb-1">
                  {history.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => loadResearch(item)}
                      className={`flex items-center gap-1.5 bg-transparent border text-[11px] font-normal cursor-pointer transition-all duration-200 tracking-[-0.01em] whitespace-nowrap shrink-0 max-w-[160px] px-3 py-1.5 rounded-full hover:bg-[#0f0f0f] hover:border-[#2a2a2a] hover:text-white hover:-translate-y-px ${
                        activeResearch?.id === item.id ? 'border-red-500/40 text-red-400' : 'border-[#1f1f1f] text-[#525252]'
                      }`}
                    >
                      <IconMicroscope size={10} className="shrink-0 text-red-400/60" />
                      <span className="truncate">{item.query}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="research-bar-collapsed">
                {/* File upload button */}
                {/* Fix #4: File attachment disabled — coming soon */}
                <button
                  className="research-collapsed-btn-circle"
                  aria-label="File attachments coming soon"
                  title="File attachments coming soon"
                  disabled
                  style={{ opacity: 0.4, cursor: 'not-allowed' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
                  </svg>
                </button>
                {/* Hidden file input for collapsed bar */}
                <input
                  ref={collapsedFileInputRef}
                  type="file"
                  className="hidden"
                  multiple
                  onChange={e => {
                    const files = Array.from(e.target.files || [])
                    if (files.length > 0) {
                      setInput(prev => prev ? prev + ' ' + files.map(f => f.name).join(', ') : files.map(f => f.name).join(', '))
                    }
                    e.target.value = ''
                  }}
                />

                {/* Input */}
                <div className="research-collapsed-input-wrap">
                  <input
                    ref={collapsedInputRef}
                    type="text"
                    placeholder={collapsedPlaceholder || 'Research anything...'}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() } }}
                    className="research-collapsed-input"
                    autoComplete="off"
                    spellCheck="false"
                    disabled={isResearching}
                  />
                </div>

                {/* Apex model chip */}
                <button
                  onClick={() => {
                    const next = apexModel === 'apex-free' ? 'apex-premium' : 'apex-free'
                    setApexModel(next)
                  }}
                  className={`text-[10px] px-2 py-1 rounded-full transition-all duration-200 border shrink-0 ${
                    apexModel === 'apex-premium'
                      ? 'bg-[rgba(220,38,38,0.12)] text-[#ef4444] border-[rgba(220,38,38,0.2)]'
                      : 'text-[#525252] border-[rgba(255,255,255,0.06)]'
                  }`}
                >
                  {apexModel === 'apex-premium' ? 'Apex 2.3' : 'Apex 1.7'}
                </button>
                {/* Mode chip */}
                <button
                  onClick={() => setMode(mode === 'quick' ? 'deep' : 'quick')}
                  className={`text-[10px] px-2 py-1 rounded-full transition-all duration-200 border shrink-0 ${
                    mode === 'deep'
                      ? 'bg-[rgba(168,85,247,0.12)] text-[#a855f7] border-[rgba(168,85,247,0.2)]'
                      : 'text-[#525252] border-[rgba(255,255,255,0.06)]'
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

        /* ─── Report body (cardless, Claude-style) ─── */
        .report-body {
          padding: 0;
          line-height: 1.7;
        }
        /* Headings — clearly distinguished, scannable hierarchy */
        .report-body h1 {
          font-size: 1.6rem;
          font-weight: 700;
          color: #ffffff;
          margin-top: 2rem;
          margin-bottom: 1rem;
          padding-bottom: 0.5rem;
          border-bottom: 1px solid #262626;
          letter-spacing: -0.02em;
          line-height: 1.25;
        }
        .report-body h2 {
          font-size: 1.3rem;
          font-weight: 700;
          color: #ffffff;
          margin-top: 1.75rem;
          margin-bottom: 0.75rem;
          padding-left: 0.625rem;
          border-left: 3px solid #ef4444;
          line-height: 1.3;
          letter-spacing: -0.015em;
        }
        /* When an h2 follows a --- divider, the hr already provides
           vertical breathing room — don't double up. */
        .report-body hr + h1,
        .report-body hr + h2,
        .report-body hr + h3 { margin-top: 0; }
        .report-body h3 {
          font-size: 1.075rem;
          font-weight: 600;
          color: #e5e5e5;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
          letter-spacing: -0.01em;
        }
        .report-body h1:first-child,
        .report-body h2:first-child,
        .report-body h3:first-child {
          margin-top: 0;
        }
        .report-body p { font-size: 0.9rem; color: #b8b8b8; line-height: 1.75; margin-bottom: 0.85rem; }
        .report-body ul { margin-bottom: 0.85rem; padding-left: 0.25rem; }
        .report-body ol { margin-bottom: 0.85rem; padding-left: 1rem; }
        .report-body li { font-size: 0.9rem; color: #b8b8b8; line-height: 1.75; padding-left: 0.25rem; margin-bottom: 0.2rem; }
        .report-body strong { color: #fff; font-weight: 600; }
        .report-body a { color: #f87171; text-decoration: underline; text-underline-offset: 2px; }
        .report-body a:hover { color: #fca5a5; }
        .report-body hr {
          border: none;
          border-top: 1px solid #262626;
          margin: 2.25rem 0;
          height: 0;
        }

        /* Clean unified table styling for both Streaming and Completed states */
        .report-body table,
        .prose-kivora table {
          width: 100%;
          table-layout: fixed;
          border-collapse: separate;
          border-spacing: 0;
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid #1a1a1a;
          margin-bottom: 0.75rem;
        }
        .report-body thead th,
        .prose-kivora table th {
          background: #111;
          font-size: 9px;
          font-weight: 600;
          color: #737373;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 0.375rem 0.5rem;
          text-align: left;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .report-body tbody td,
        .prose-kivora table td {
          font-size: 11px;
          color: #a0a0a0;
          padding: 0.375rem 0.5rem;
          line-height: 1.5;
          border-top: 1px solid #1a1a1a;
          word-break: break-word;
          overflow-wrap: break-word;
        }
        /* Zebra striping for readability */
        .report-body tbody tr:nth-child(even),
        .prose-kivora table tbody tr:nth-child(even) {
          background-color: rgba(255, 255, 255, 0.02);
        }

        /* ─── Kivora Research Thinking State ─── */
        .kivora-thinking {
          position: relative;
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 16px 20px;
          border-radius: 16px;
          background: rgba(255,255,255,0.02);
          overflow: hidden;
        }
        .kivora-thinking::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: 16px;
          padding: 1px;
          background: linear-gradient(135deg, rgba(168,85,247,0.25), rgba(239,68,68,0.25));
          -webkit-mask:
            linear-gradient(#fff 0 0) content-box,
            linear-gradient(#fff 0 0);
          -webkit-mask-composite: xor;
          mask-composite: exclude;
          pointer-events: none;
        }
        .kivora-thinking::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: #1a1a1a;
        }

        .kivora-thinking-wave {
          display: flex;
          align-items: center;
          gap: 3px;
          height: 20px;
        }
        .kivora-thinking-bar {
          display: block;
          width: 3px;
          border-radius: 2px;
          background: linear-gradient(180deg, #a855f7, #ef4444);
          animation: kivora-wave 1.2s ease-in-out infinite;
        }
        .kivora-thinking-bar:nth-child(1) { height: 8px; animation-delay: 0s; }
        .kivora-thinking-bar:nth-child(2) { height: 14px; animation-delay: 0.15s; }
        .kivora-thinking-bar:nth-child(3) { height: 20px; animation-delay: 0.3s; }
        .kivora-thinking-bar:nth-child(4) { height: 14px; animation-delay: 0.45s; }
        .kivora-thinking-bar:nth-child(5) { height: 8px; animation-delay: 0.6s; }

        @keyframes kivora-wave {
          0%, 100% { transform: scaleY(0.4); opacity: 0.5; }
          50% { transform: scaleY(1); opacity: 1; }
        }

        .kivora-thinking-label {
          font-size: 14px;
          font-weight: 600;
          background: linear-gradient(90deg, #a855f7, #ef4444);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .kivora-thinking-cursor {
          display: inline-block;
          width: 2px;
          height: 16px;
          background: linear-gradient(180deg, #a855f7, #ef4444);
          border-radius: 1px;
          animation: kivora-cursor-blink 1s steps(1) infinite;
        }
        @keyframes kivora-cursor-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }

        .kivora-thinking-sources {
          display: flex;
          align-items: center;
          gap: 5px;
          font-size: 11px;
          color: #737373;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.06);
          padding: 3px 10px;
          border-radius: 100px;
          font-weight: 500;
          margin-left: auto;
        }

        .kivora-thinking-track {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          height: 2px;
          background: #1a1a1a;
          overflow: hidden;
        }
        .kivora-thinking-fill {
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, #a855f7, #ef4444);
          animation: kivora-shimmer 2s ease-in-out infinite;
          transform-origin: left;
        }
        .kivora-thinking-fill-writing {
          animation: kivora-shimmer-writing 1.5s ease-in-out infinite;
        }
        @keyframes kivora-shimmer {
          0% { transform: scaleX(0); transform-origin: left; }
          50% { transform: scaleX(0.6); transform-origin: left; }
          100% { transform: scaleX(0); transform-origin: right; }
        }
        @keyframes kivora-shimmer-writing {
          0% { transform: scaleX(0.3); transform-origin: left; }
          50% { transform: scaleX(0.9); transform-origin: left; }
          100% { transform: scaleX(0.3); transform-origin: left; }
        }

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

        /* ─── Vertical Stage Pipeline ─── */
        .research-pipeline-card {
          background: #111111;
          border: 1px solid #1f1f1f;
          border-radius: 12px;
          padding: 20px;
          position: relative;
          overflow: hidden;
        }

        .research-pipeline-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 20px;
        }

        .research-pipeline-pulse {
          width: 10px;
          height: 10px;
          background: #ececec;
          border-radius: 50%;
          position: relative;
          flex-shrink: 0;
        }
        .research-pipeline-pulse::after {
          content: '';
          position: absolute;
          top: -4px;
          left: -4px;
          width: 18px;
          height: 18px;
          border: 1.5px solid #ececec;
          border-radius: 50%;
          animation: pipeline-ripple 1.8s ease-out infinite;
          opacity: 0;
        }
        @keyframes pipeline-ripple {
          0% { transform: scale(0.5); opacity: 0.6; }
          100% { transform: scale(2.5); opacity: 0; }
        }

        .research-pipeline-query {
          font-size: 13px;
          font-weight: 500;
          color: #a3a3a3;
          letter-spacing: 0.02em;
          flex: 1;
          min-width: 0;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .research-pipeline-mode {
          font-size: 10px;
          padding: 2px 8px;
          border-radius: 100px;
          font-weight: 500;
          flex-shrink: 0;
        }
        .research-pipeline-mode-deep {
          background: #ef4444;
          color: #fff;
        }
        .research-pipeline-mode-quick {
          background: #1f1f1f;
          color: #a3a3a3;
          border: 1px solid rgba(239, 68, 68, 0.3);
        }

        .research-stages {
          display: flex;
          flex-direction: column;
          gap: 0;
        }

        .research-stage {
          display: flex;
          align-items: flex-start;
          gap: 14px;
          padding: 10px 0;
          position: relative;
          opacity: 0.35;
          transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .research-stage-active {
          opacity: 1;
        }
        .research-stage-done {
          opacity: 0.6;
        }

        /* Vertical connector line */
        .research-stage:not(:last-child)::before {
          content: '';
          position: absolute;
          left: 11px;
          top: 34px;
          width: 1.5px;
          height: calc(100% - 14px);
          background: #333333;
          transition: background 0.4s;
        }
        .research-stage-done:not(:last-child)::before {
          background: #22c55e;
        }

        .research-stage-icon {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          position: relative;
          z-index: 2;
          transition: all 0.4s;
        }
        .research-stage-pending .research-stage-icon {
          background: #333333;
          border: 1.5px solid #2a2a2a;
        }
        .research-stage-active .research-stage-icon {
          background: #161616;
          border: 1.5px solid #ececec;
          box-shadow: 0 0 12px rgba(236, 236, 236, 0.08);
        }
        .research-stage-done .research-stage-icon {
          background: rgba(34, 197, 94, 0.1);
          border: 1.5px solid #22c55e;
        }

        .research-stage-icon svg {
          width: 12px;
          height: 12px;
          transition: all 0.3s;
        }
        .research-stage-pending .research-stage-icon svg {
          color: #525252;
        }
        .research-stage-active .research-stage-icon svg {
          color: #ececec;
        }
        .research-stage-done .research-stage-icon svg {
          color: #22c55e;
        }

        /* Spinner for active stage */
        .research-stage-active .research-stage-icon::after {
          content: '';
          position: absolute;
          inset: -3px;
          border-radius: 50%;
          border: 1.5px solid transparent;
          border-top-color: #ececec;
          animation: pipeline-spin 1s linear infinite;
        }
        @keyframes pipeline-spin {
          to { transform: rotate(360deg); }
        }

        .research-stage-body {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding-top: 2px;
        }
        .research-stage-name {
          font-size: 13px;
          font-weight: 500;
          color: #a3a3a3;
          transition: color 0.3s;
        }
        .research-stage-active .research-stage-name {
          color: #ececec;
        }
        .research-stage-done .research-stage-name {
          color: #a3a3a3;
        }

        .research-stage-detail {
          font-size: 12px;
          color: #525252;
          line-height: 1.5;
          max-height: 0;
          overflow: hidden;
          opacity: 0;
          transition: all 0.4s ease;
        }
        .research-stage-active .research-stage-detail,
        .research-stage-done .research-stage-detail {
          max-height: 60px;
          opacity: 1;
        }

        .research-pipeline-progress {
          margin-top: 16px;
          height: 2px;
          background: #1f1f1f;
          border-radius: 1px;
          overflow: hidden;
        }
        .research-pipeline-progress-bar {
          height: 100%;
          background: linear-gradient(90deg, #ececec, #22c55e);
          border-radius: 1px;
          transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>
    </main>
  )
}
