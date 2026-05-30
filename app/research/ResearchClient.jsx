'use client'
import { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'

// ── Constants ──
const STORAGE_KEY = 'kivora-research-history'
const MAX_HISTORY = 50

const SUGGESTED_TOPICS = [
  { emoji: '🧬', label: 'AI & Machine Learning Trends' },
  { emoji: '💰', label: 'Crypto & Market Analysis' },
  { emoji: '🚀', label: 'Space Technology' },
  { emoji: '⚕️', label: 'Health & Biotech' },
]

const QUICK_STAGES = [
  { id: 'search', label: 'Searching', emoji: '🔍' },
  { id: 'writing', label: 'Writing', emoji: '📝' },
  { id: 'done', label: 'Done', emoji: '✅' },
]

const DEEP_STAGES = [
  { id: 'search', label: 'Searching', emoji: '🔍' },
  { id: 'analyzing', label: 'Analyzing', emoji: '📊' },
  { id: 'writing', label: 'Writing', emoji: '📝' },
  { id: 'done', label: 'Done', emoji: '✅' },
]

const MOBILE_TABS = [
  { id: 'sources', label: 'Sources' },
  { id: 'report', label: 'Report' },
  { id: 'data', label: 'Data' },
]

// ── Helpers ──
function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function formatDate(ts) {
  const d = new Date(ts)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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
    // Bold
    const parts = []
    const regex = /(\*\*|__)(.*?)\1|\[([^\]]+)\]\(([^)]+)\)|\[(\d+)\]/g
    let lastIndex = 0
    let match
    while ((match = regex.exec(str)) !== null) {
      if (match.index > lastIndex) {
        parts.push(str.slice(lastIndex, match.index))
      }
      if (match[1]) {
        // Bold
        parts.push(<strong key={`b-${keyIdx++}`} className="text-white font-semibold">{match[2]}</strong>)
      } else if (match[3] !== undefined && match[4] !== undefined) {
        // Link
        parts.push(
          <a key={`a-${keyIdx++}`} href={match[4]} target="_blank" rel="noopener noreferrer" className="text-red-400 hover:text-red-300 underline underline-offset-2">
            {match[3]}
          </a>
        )
      } else if (match[5] !== undefined) {
        // Citation number like [1]
        parts.push(
          <span key={`cit-${keyIdx++}`} className="citation-number">[{match[5]}]</span>
        )
      }
      lastIndex = match.index + match[0].length
    }
    if (lastIndex < str.length) parts.push(str.slice(lastIndex))
    return parts.length > 0 ? parts : str
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Heading
    if (line.startsWith('### ')) {
      flushList()
      elements.push(<h3 key={`h3-${keyIdx++}`} className="text-base font-semibold text-white mt-5 mb-2">{renderInline(line.slice(4))}</h3>)
      continue
    }
    if (line.startsWith('## ')) {
      flushList()
      elements.push(<h2 key={`h2-${keyIdx++}`} className="text-lg font-semibold text-white mt-6 mb-2.5">{renderInline(line.slice(3))}</h2>)
      continue
    }
    if (line.startsWith('# ')) {
      flushList()
      elements.push(<h1 key={`h1-${keyIdx++}`} className="text-xl font-bold text-white mt-4 mb-3">{renderInline(line.slice(2))}</h1>)
      continue
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      flushList()
      elements.push(<hr key={`hr-${keyIdx++}`} className="border-[#1a1a1a] my-4" />)
      continue
    }

    // List item
    if (/^[-*]\s/.test(line)) {
      inList = true
      listItems.push(
        <li key={`li-${keyIdx++}`} className="text-sm text-[#a0a0a0] leading-relaxed pl-1">
          {renderInline(line.replace(/^[-*]\s/, ''))}
        </li>
      )
      continue
    }

    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      inList = true
      listItems.push(
        <li key={`li-${keyIdx++}`} className="text-sm text-[#a0a0a0] leading-relaxed pl-1 list-decimal ml-4">
          {renderInline(line.replace(/^\d+\.\s/, ''))}
        </li>
      )
      continue
    }

    // Empty line
    if (!line.trim()) {
      flushList()
      continue
    }

    // Regular paragraph
    flushList()
    elements.push(<p key={`p-${keyIdx++}`} className="text-sm text-[#a0a0a0] leading-relaxed mb-3">{renderInline(line)}</p>)
  }

  flushList()
  return elements
}


// ── Main Component ──
export default function ResearchClient() {
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('q') || ''

  // State
  const [input, setInput] = useState('')
  const [mode, setMode] = useState('quick') // 'quick' | 'deep'
  const [activeResearch, setActiveResearch] = useState(null) // { id, query, mode, sources, report, data, progress, stage, timestamp }
  const [history, setHistory] = useState([])
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [mobileTab, setMobileTab] = useState('report')
  const [folders, setFolders] = useState(['All Research'])
  const [activeFolder, setActiveFolder] = useState('All Research')
  const [newFolderName, setNewFolderName] = useState('')
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [error, setError] = useState('')
  const [isResearching, setIsResearching] = useState(false)
  const [reportDisplay, setReportDisplay] = useState('') // for streaming effect
  const [sourcesVisible, setSourcesVisible] = useState(0) // for stagger animation

  // ── Expandable text bar states ──
  const [barExpanded, setBarExpanded] = useState(false)

  const textareaRef = useRef(null)
  const collapsedInputRef = useRef(null)
  const reportRef = useRef(null)
  const streamTimerRef = useRef(null)
  const chatBarRef = useRef(null)

  // Load history on mount
  useEffect(() => {
    setHistory(loadHistory())
  }, [])

  // Auto-start research if query in URL
  useEffect(() => {
    if (initialQuery && !isResearching && !activeResearch) {
      setInput(initialQuery)
      startResearch(initialQuery, mode)
    }
  }, [initialQuery]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup streaming timer
  useEffect(() => {
    return () => {
      if (streamTimerRef.current) clearInterval(streamTimerRef.current)
    }
  }, [])

  // Auto-expand bar when input is pre-filled
  useEffect(() => {
    if (input.trim() && !barExpanded) {
      setBarExpanded(true)
    }
  }, [input]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-collapse bar on click outside (only when input is empty)
  useEffect(() => {
    if (!barExpanded) return
    function handleClick(e) {
      if (chatBarRef.current && !chatBarRef.current.contains(e.target)) {
        if (!input.trim()) {
          setBarExpanded(false)
        }
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [barExpanded, input])

  // Auto-scroll report to bottom during streaming
  useEffect(() => {
    if (reportRef.current && isResearching) {
      reportRef.current.scrollTop = reportRef.current.scrollHeight
    }
  }, [reportDisplay, isResearching])

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
    setMobileTab('report')

    // Animate progress
    const stages = researchMode === 'deep' ? DEEP_STAGES : QUICK_STAGES
    const stageProgressMap = researchMode === 'deep'
      ? { search: 15, analyzing: 50, writing: 75, done: 100 }
      : { search: 25, writing: 60, done: 100 }

    // Simulate progress while waiting
    let fakeProgress = 0
    const progressInterval = setInterval(() => {
      fakeProgress += Math.random() * 3
      if (fakeProgress > 90) fakeProgress = 90
      setActiveResearch(prev => prev ? { ...prev, progress: Math.min(fakeProgress, prev.stage === 'done' ? 100 : fakeProgress) } : prev)
    }, 500)

    try {
      // Simulate stage transitions
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

      // Complete research
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

      // Stream report text
      if (completed.report) {
        streamReport(completed.report)
      }

      // Stagger source visibility
      if (completed.sources.length > 0) {
        staggerSources(completed.sources.length)
      }

      // Save to history
      const newHistory = [completed, ...loadHistory()].slice(0, MAX_HISTORY)
      setHistory(newHistory)
      saveHistory(newHistory)

    } catch (err) {
      clearInterval(progressInterval)
      setError(err.message || 'Research failed. Please try again.')
      setIsResearching(false)
      setActiveResearch(prev => prev ? { ...prev, stage: 'done', progress: 100 } : prev)
    }
  }

  // ── Stream Report (character by character) ──
  function streamReport(fullText) {
    let idx = 0
    const speed = 8 // characters per tick
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

  // ── Stagger Sources Animation ──
  function staggerSources(count) {
    setSourcesVisible(0)
    for (let i = 1; i <= count; i++) {
      setTimeout(() => setSourcesVisible(i), i * 120)
    }
  }

  // ── Load a Past Research Item ──
  function loadResearch(item) {
    setActiveResearch(item)
    setReportDisplay(item.report || '')
    setSourcesVisible(item.sources?.length || 0)
    setMobileTab('report')
    setSidebarOpen(false)
    setError('')
    setIsResearching(false)
  }

  // ── New Research (clear active) ──
  function newResearch() {
    setActiveResearch(null)
    setReportDisplay('')
    setSourcesVisible(0)
    setError('')
    setInput('')
    setIsResearching(false)
    setBarExpanded(false)
  }

  // ── Submit Handler ──
  function handleSubmit() {
    const q = input.trim()
    if (!q || isResearching) return
    setBarExpanded(false)
    startResearch(q, mode)
  }

  // ── Auto-resize textarea ──
  function autoResize(el) {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 240) + 'px'
  }

  // ── Add Folder ──
  function addFolder() {
    const name = newFolderName.trim()
    if (!name || folders.includes(name)) return
    const updated = [...folders, name]
    setFolders(updated)
    setNewFolderName('')
    setShowNewFolder(false)
  }

  // ── Keyboard shortcut ──
  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  // ── Computed ──
  const stages = mode === 'deep' ? DEEP_STAGES : QUICK_STAGES
  const currentStageIdx = activeResearch ? stages.findIndex(s => s.id === activeResearch.stage) : 0
  const hasData = activeResearch?.data !== null && activeResearch?.data !== undefined
  const progressPercent = activeResearch?.progress || 0

  // ── Render Sidebar Item ──
  function renderSidebarItem(item) {
    const isActive = activeResearch?.id === item.id
    return (
      <button
        key={item.id}
        onClick={() => loadResearch(item)}
        className={`w-full text-left px-3 py-2.5 rounded-lg transition-all duration-150 group ${
          isActive ? 'bg-[#1a1a1a] border border-[#262626]' : 'hover:bg-[#141414] border border-transparent'
        }`}
      >
        <div className="flex items-center gap-2 mb-1">
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
            item.mode === 'deep'
              ? 'bg-red-500/20 text-red-400'
              : 'bg-[#1f1f1f] text-[#737373]'
          }`}>{item.mode === 'deep' ? 'Deep' : 'Quick'}</span>
          <span className="text-[10px] text-[#525252]">{formatDate(item.timestamp)}</span>
        </div>
        <p className="text-xs text-[#a0a0a0] truncate group-hover:text-white transition-colors">
          {item.query}
        </p>
      </button>
    )
  }

  // ── Render Progress Bar ──
  function renderProgressBar() {
    if (!activeResearch || activeResearch.stage === 'done') return null

    return (
      <div className="px-4 pt-3 pb-2 animate-fade-in">
        <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-3.5">
          {/* Query display */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm">🔬</span>
            <p className="text-sm text-white font-medium truncate flex-1">{activeResearch.query}</p>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
              activeResearch.mode === 'deep' ? 'bg-red-500 text-white' : 'bg-[#1f1f1f] text-red-400 border border-red-500/30'
            }`}>{activeResearch.mode === 'deep' ? 'Deep' : 'Quick'}</span>
          </div>

          {/* Stage pipeline */}
          <div className="flex items-center gap-1.5 mb-2.5">
            {stages.map((stage, idx) => (
              <div key={stage.id} className="flex items-center gap-1.5">
                <div className={`flex items-center gap-1 text-[11px] font-medium transition-colors duration-300 ${
                  idx < currentStageIdx ? 'text-green-400' : idx === currentStageIdx ? 'text-red-400' : 'text-[#525252]'
                }`}>
                  <span>{stage.emoji}</span>
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

          {/* Progress bar */}
          <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
            <div
              className="h-full bg-red-500 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-[#525252]">
              {activeResearch.stage === 'done' ? 'Complete' : `Stage ${currentStageIdx + 1} of ${stages.length}`}
            </span>
            <span className="text-[10px] text-[#525252]">{Math.round(progressPercent)}%</span>
          </div>
        </div>
      </div>
    )
  }

  // ── Render Sources Tile ──
  function renderSourcesTile() {
    const sources = activeResearch?.sources || []
    const visibleCount = sourcesVisible

    return (
      <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl overflow-hidden flex flex-col tile-fade-in">
        <div className="px-4 py-3 border-b border-[#1a1a1a] shrink-0">
          <h3 className="text-sm font-semibold text-white">
            Sources <span className="text-[#525252] font-normal">({sources.length})</span>
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-behavior-contain max-h-96 lg:max-h-[calc(100vh-320px)] custom-scrollbar">
          {sources.length === 0 ? (
            <div className="p-6 text-center">
              {isResearching ? (
                <div className="flex items-center justify-center gap-2 text-[#525252]">
                  <div className="w-3 h-3 border border-red-500/30 border-t-red-500 rounded-full animate-spin" />
                  <span className="text-xs">Finding sources...</span>
                </div>
              ) : (
                <p className="text-xs text-[#525252]">No sources yet</p>
              )}
            </div>
          ) : (
            <div className="divide-y divide-[#1a1a1a]">
              {sources.map((source, idx) => (
                <a
                  key={source.id ?? idx}
                  href={source.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`flex items-start gap-3 px-4 py-3 hover:bg-[#141414] transition-all duration-200 source-slide-up ${
                    idx < visibleCount ? 'source-visible' : 'source-hidden'
                  }`}
                  style={{ animationDelay: `${idx * 80}ms` }}
                >
                  {/* Status dot */}
                  <div className="mt-1.5 shrink-0">
                    {source.status === 'deep' ? (
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                    ) : (
                      <div className="w-2 h-2 rounded-full bg-green-500/70" />
                    )}
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      {source.favicon && (
                        <img src={source.favicon} alt="" className="w-3.5 h-3.5 rounded" />
                      )}
                      <span className="text-[10px] text-[#525252] truncate">{getDomain(source.url)}</span>
                    </div>
                    <p className="text-xs text-[#c0c0c0] font-medium leading-snug line-clamp-2 mb-0.5">
                      {source.title}
                    </p>
                    {source.snippet && (
                      <p className="text-[11px] text-[#525252] leading-snug line-clamp-2">{source.snippet}</p>
                    )}
                  </div>
                  {/* Arrow */}
                  <svg width="14" height="14" viewBox="0 0 14 14" className="shrink-0 text-[#333] mt-1">
                    <path d="M5 3l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Render Report Tile ──
  function renderReportTile() {
    const reportText = reportDisplay || activeResearch?.report || ''

    return (
      <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl overflow-hidden flex flex-col tile-fade-in">
        <div className="px-4 py-3 border-b border-[#1a1a1a] shrink-0 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Report</h3>
          {reportText && !isResearching && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(activeResearch?.report || '')
              }}
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
          className="flex-1 overflow-y-auto overscroll-behavior-contain max-h-96 lg:max-h-[calc(100vh-320px)] custom-scrollbar px-4 py-3"
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
          ) : !reportText ? (
            <div className="flex flex-col items-center justify-center py-12">
              <p className="text-xs text-[#525252]">No report generated yet</p>
            </div>
          ) : (
            <div className="report-content">
              {renderMarkdown(reportText)}
              {isResearching && <span className="inline-block w-0.5 h-4 bg-red-500 animate-pulse ml-0.5 align-middle" />}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Render Data Tile ──
  function renderDataTile() {
    if (!hasData) {
      return (
        <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl overflow-hidden flex flex-col tile-fade-in">
          <div className="px-4 py-3 border-b border-[#1a1a1a] shrink-0">
            <h3 className="text-sm font-semibold text-white">Data Extracts</h3>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center py-12">
            <div className="text-2xl mb-2 opacity-30">📊</div>
            <p className="text-xs text-[#525252]">No extractable data found</p>
            <p className="text-[10px] text-[#333] mt-1">Charts and tables will appear here when detected</p>
          </div>
        </div>
      )
    }

    return (
      <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl overflow-hidden flex flex-col tile-fade-in">
        <div className="px-4 py-3 border-b border-[#1a1a1a] shrink-0">
          <h3 className="text-sm font-semibold text-white">Data Extracts</h3>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-behavior-contain max-h-96 lg:max-h-[calc(100vh-320px)] custom-scrollbar p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm">📊</span>
            <span className="text-xs text-[#a0a0a0]">Data detected in research</span>
          </div>
          <pre className="text-xs text-[#737373] bg-[#0a0a0a] rounded-lg p-3 overflow-x-auto">
            {JSON.stringify(activeResearch.data, null, 2)}
          </pre>
        </div>
      </div>
    )
  }

  // ── Render Empty State ──
  function renderEmptyState() {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-4 animate-fade-in">
        <div className="text-5xl mb-5 opacity-80">🔬</div>
        <h2 className="text-xl sm:text-2xl font-semibold text-white mb-2 tracking-tight">
          What should I research?
        </h2>
        <p className="text-sm text-[#525252] mb-8 text-center max-w-md">
          Enter a topic and I'll search the web, analyze sources, and generate a comprehensive report.
        </p>

        {/* Suggested topics 2x2 grid */}
        <div className="grid grid-cols-2 gap-2.5 w-full max-w-sm">
          {SUGGESTED_TOPICS.map((topic) => (
            <button
              key={topic.label}
              onClick={() => { setInput(`${topic.emoji} ${topic.label}`); textareaRef.current?.focus() }}
              className="flex items-center gap-2 px-3 py-2.5 bg-[#111111] border border-[#1a1a1a] rounded-xl text-xs text-[#a0a0a0] hover:bg-[#141414] hover:border-[#262626] hover:text-white transition-all duration-200 text-left"
            >
              <span className="text-base shrink-0">{topic.emoji}</span>
              <span className="leading-snug">{topic.label}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ── Render Sidebar ──
  function renderSidebar() {
    return (
      <>
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/60 z-40 lg:hidden backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar panel */}
        <aside className={`fixed top-0 left-0 h-full w-[260px] bg-[#0f0f0f] border-r border-[#1a1a1a] z-50 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:z-auto ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="px-4 py-4 border-b border-[#1a1a1a] shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">🔬</span>
                  <div>
                    <h1 className="text-sm font-semibold text-white tracking-tight">Kivora Research Lab</h1>
                    <p className="text-[10px] text-[#525252]">{history.length} research{history.length !== 1 ? 'es' : ''}</p>
                  </div>
                </div>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="lg:hidden p-1 text-[#525252] hover:text-white transition-colors"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* New Research Button */}
            <div className="px-3 pt-3 shrink-0">
              <button
                onClick={newResearch}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-[#1a1a1a] hover:bg-[#222] border border-[#262626] rounded-lg text-xs text-[#a0a0a0] hover:text-white transition-all duration-200"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                New Research
              </button>
            </div>

            {/* Folders */}
            <div className="px-3 pt-3 shrink-0">
              <div className="flex items-center gap-1.5 px-1 mb-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[#525252]">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                <span className="text-[10px] text-[#525252] font-semibold uppercase tracking-wider">Folders</span>
              </div>
              {folders.map(folder => (
                <button
                  key={folder}
                  onClick={() => setActiveFolder(folder)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-all duration-150 mb-0.5 ${
                    activeFolder === folder ? 'bg-[#1a1a1a] text-white' : 'text-[#737373] hover:bg-[#141414] hover:text-[#a0a0a0]'
                  }`}
                >
                  📁 {folder}
                </button>
              ))}
              {showNewFolder ? (
                <div className="flex items-center gap-1.5 mt-1">
                  <input
                    value={newFolderName}
                    onChange={e => setNewFolderName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addFolder()}
                    placeholder="Folder name..."
                    className="flex-1 bg-[#0a0a0a] border border-[#262626] rounded px-2 py-1 text-xs text-white placeholder-[#404040] focus:outline-none focus:border-[#3a3a3a]"
                    autoFocus
                  />
                  <button onClick={addFolder} className="p-1 text-green-400 hover:text-green-300">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewFolder(true)}
                  className="w-full text-left px-2.5 py-1.5 rounded-md text-[10px] text-[#404040] hover:text-[#525252] hover:bg-[#0f0f0f] transition-all"
                >
                  + New Folder
                </button>
              )}
            </div>

            {/* Research History */}
            <div className="flex-1 overflow-y-auto overscroll-behavior-contain custom-scrollbar px-3 pt-3 pb-2">
              <div className="flex items-center gap-1.5 px-1 mb-2">
                <span className="text-[10px] text-[#525252] font-semibold uppercase tracking-wider">History</span>
              </div>
              {history.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-[10px] text-[#404040]">No research yet</p>
                  <p className="text-[10px] text-[#333]">Start by entering a topic above</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {history.map(item => renderSidebarItem(item))}
                </div>
              )}
            </div>

            {/* Bottom settings */}
            <div className="px-3 py-3 border-t border-[#1a1a1a] shrink-0">
              <button className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs text-[#525252] hover:text-[#737373] hover:bg-[#141414] transition-all">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
                Settings
              </button>
            </div>
          </div>
        </aside>
      </>
    )
  }

  // ── Render Input Bar ──
  function renderInputBar() {
    const hasInput = input.trim().length > 0

    return (
      <div className="shrink-0 border-t border-[#1a1a1a] bg-[#0a0a0a]">
        <div className="max-w-4xl mx-auto px-3 py-3">
          {/* ═══ COLLAPSED STATE — Floating pill bar (v2) ═══ */}
          {!barExpanded && (
            <div className="research-bar-collapsed">
              {/* Search icon */}
              <button
                className="research-collapsed-btn-circle"
                aria-label="Research"
                title="Research"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                </svg>
              </button>

              {/* Input field — single line in collapsed state */}
              <div className="research-collapsed-input-wrap">
                <input
                  ref={collapsedInputRef}
                  type="text"
                  placeholder="Research anything..."
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onFocus={() => setBarExpanded(true)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() } }}
                  className="research-collapsed-input"
                  autoComplete="off"
                  spellCheck="false"
                  disabled={isResearching}
                />
              </div>

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
          )}

          {/* ═══ EXPANDED STATE — Floating pill with toolbar ═══ */}
          {barExpanded && (
            <div className="research-container-expanded" ref={chatBarRef}>
              {/* Textarea */}
              <textarea
                ref={textareaRef}
                rows={1}
                className="research-textarea-expanded scrollbar-none"
                placeholder="Research anything..."
                value={input}
                onChange={e => { setInput(e.target.value); autoResize(e.target) }}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() } }}
                autoFocus
                disabled={isResearching}
              />

              {/* Mode indicator */}
              <div className="flex items-center gap-1.5 px-1 pt-1">
                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                  mode === 'deep'
                    ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                    : 'bg-[#1f1f1f] text-[#737373] border border-transparent'
                }`}>
                  {mode === 'deep' ? 'Deep Mode' : 'Quick Mode'}
                </span>
              </div>

              {/* Toolbar */}
              <div className="research-toolbar-expanded">
                {/* Left actions */}
                <div className="research-toolbar-left">
                  {/* Mode toggle */}
                  <button
                    className={`research-toolbar-btn ${mode === 'deep' ? 'research-toolbar-btn-active' : ''}`}
                    onClick={() => setMode(mode === 'quick' ? 'deep' : 'quick')}
                    title={mode === 'quick' ? 'Switch to Deep mode' : 'Switch to Quick mode'}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      {mode === 'deep' ? (
                        <>
                          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                          <circle cx="12" cy="12" r="3" />
                        </>
                      ) : (
                        <>
                          <circle cx="11" cy="11" r="8" />
                          <path d="m21 21-4.3-4.3" />
                        </>
                      )}
                    </svg>
                  </button>

                  {/* Deep/Quick label */}
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

                {/* Right actions */}
                <div className="research-toolbar-right">
                  {/* Submit button */}
                  <button
                    onClick={handleSubmit}
                    disabled={!hasInput || isResearching}
                    className={`research-submit-btn ${hasInput && !isResearching ? 'research-submit-btn-active' : ''}`}
                    aria-label="Start research"
                  >
                    {isResearching ? (
                      <div className="w-4 h-4 border-2 border-[#525252] border-t-red-400 rounded-full animate-spin" />
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
                      </svg>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Render Active Research View ──
  function renderActiveView() {
    return (
      <div className="flex-1 flex flex-col min-h-0 animate-fade-in">
        {/* Progress Bar */}
        {renderProgressBar()}

        {/* Mobile tab bar */}
        <div className="lg:hidden flex items-center gap-1 px-3 py-2 border-b border-[#1a1a1a] shrink-0">
          {MOBILE_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setMobileTab(tab.id)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                mobileTab === tab.id
                  ? 'bg-[#1a1a1a] text-white'
                  : 'text-[#525252] hover:text-[#737373]'
              }`}
            >
              {tab.label}
              {tab.id === 'sources' && activeResearch?.sources?.length > 0 && (
                <span className="ml-1 text-[10px] text-[#525252]">({activeResearch.sources.length})</span>
              )}
            </button>
          ))}
        </div>

        {/* Desktop tiles layout */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-behavior-contain">
          {/* Desktop: side-by-side grid */}
          <div className="hidden lg:grid lg:grid-cols-5 lg:gap-3 lg:p-4 lg:h-full">
            <div className="col-span-2 flex flex-col">
              {renderSourcesTile()}
            </div>
            <div className="col-span-3 flex flex-col">
              {renderReportTile()}
            </div>
          </div>

          {/* Mobile: single tile based on active tab */}
          <div className="lg:hidden p-3">
            {mobileTab === 'sources' && renderSourcesTile()}
            {mobileTab === 'report' && renderReportTile()}
            {mobileTab === 'data' && renderDataTile()}
          </div>
        </div>

        {/* Desktop data tile (conditional, below main grid) */}
        {hasData && (
          <div className="hidden lg:block px-4 pb-3">
            {renderDataTile()}
          </div>
        )}
      </div>
    )
  }

  // ── Error Toast ──
  function renderError() {
    if (!error) return null
    return (
      <div className="fixed top-4 right-4 z-[100] bg-red-950/90 border border-red-800/50 rounded-xl px-4 py-3 max-w-sm animate-slide-in-right backdrop-blur-sm">
        <div className="flex items-start gap-2.5">
          <span className="text-red-400 text-sm mt-0.5">⚠️</span>
          <div className="flex-1">
            <p className="text-xs text-red-300 font-medium mb-0.5">Research Error</p>
            <p className="text-[11px] text-red-400/80">{error}</p>
          </div>
          <button onClick={() => setError('')} className="text-red-500/50 hover:text-red-400 transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    )
  }

  // ── Main Render ──
  return (
    <div className="h-dvh flex bg-[#0a0a0a] text-white overflow-hidden">
      {renderSidebar()}

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center gap-3 px-3 py-2.5 border-b border-[#1a1a1a] shrink-0 bg-[#0a0a0a]">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 text-[#525252] hover:text-white transition-colors"
            aria-label="Open sidebar"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm">🔬</span>
            <h1 className="text-sm font-semibold text-white tracking-tight">Research Lab</h1>
          </div>
        </div>

        {/* Content */}
        {activeResearch ? renderActiveView() : renderEmptyState()}

        {/* Input bar */}
        {renderInputBar()}
      </div>

      {renderError()}

      {/* ── Custom CSS ── */}
      <style jsx>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.4s ease-out forwards;
        }

        @keyframes slide-in-right {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out forwards;
        }

        @keyframes tile-fade-in {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .tile-fade-in {
          animation: tile-fade-in 0.5s ease-out forwards;
        }

        @keyframes source-slide-up {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .source-slide-up.source-visible {
          animation: source-slide-up 0.3s ease-out forwards;
        }
        .source-slide-up.source-hidden {
          opacity: 0;
        }

        /* Custom scrollbar */
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #262626;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #333;
        }

        /* ═══════════════════════════════════════
           COLLAPSED STATE — Floating pill bar
           ═══════════════════════════════════════ */
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
        .research-bar-collapsed:focus-within {
          border-color: transparent;
        }
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
        .research-collapsed-input::placeholder {
          color: #525252;
          opacity: 1;
        }
        .research-collapsed-input:disabled {
          opacity: 0.6;
        }
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
        .research-collapsed-send:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }
        .research-collapsed-send-active {
          background: #e2e2e2;
          color: #0a0a0a;
        }
        .research-collapsed-send-active:hover {
          background: #ffffff;
          transform: scale(1.05);
        }
        .research-collapsed-send-active:active {
          transform: scale(0.95);
        }

        /* ═══════════════════════════════════════
           EXPANDED STATE — Floating pill with toolbar
           ═══════════════════════════════════════ */
        .research-container-expanded {
          width: 100%;
          background-color: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 20px;
          padding: 16px 16px 10px 16px;
          display: flex;
          flex-direction: column;
          transition: border-color 0.3s ease;
          animation: expandBar 0.25s ease-out;
          overflow: visible;
          position: relative;
        }
        @keyframes expandBar {
          from {
            opacity: 0.7;
            transform: scaleY(0.95);
            transform-origin: bottom;
          }
          to {
            opacity: 1;
            transform: scaleY(1);
            transform-origin: bottom;
          }
        }
        .research-container-expanded:focus-within {
          border-color: transparent;
        }
        .research-container-expanded:focus-within::before {
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

        .research-textarea-expanded {
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
        .research-textarea-expanded:focus {
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
          border-color: transparent !important;
        }
        .research-textarea-expanded::placeholder {
          color: #525252;
        }
        .research-textarea-expanded:disabled {
          opacity: 0.6;
        }

        .research-toolbar-expanded {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 6px;
          min-height: 38px;
        }
        .research-toolbar-left, .research-toolbar-right {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
        }
        .research-toolbar-left {
          flex-wrap: nowrap;
          gap: 2px;
        }

        .research-toolbar-btn {
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
        .research-toolbar-btn:hover {
          background-color: rgba(255,255,255,0.06);
          color: #e2e2e2;
        }
        .research-toolbar-btn-active {
          background-color: rgba(220, 38, 38, 0.12) !important;
          color: #ef4444 !important;
        }
        .research-toolbar-btn-active:hover {
          background-color: rgba(220, 38, 38, 0.18) !important;
          color: #f87171 !important;
        }

        .research-submit-btn {
          width: 36px;
          height: 36px;
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
        .research-submit-btn:disabled {
          cursor: not-allowed;
          opacity: 0.5;
        }
        .research-submit-btn-active {
          background: #e2e2e2;
          color: #0a0a0a;
        }
        .research-submit-btn-active:hover {
          background: #ffffff;
          transform: scale(1.05);
        }
        .research-submit-btn-active:active {
          transform: scale(0.95);
        }

        /* Scrollbar for textarea */
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-none {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }

        /* Citation numbers */
        .citation-number {
          color: #f87171;
          font-size: 11px;
          font-weight: 600;
          cursor: pointer;
          padding: 0 1px;
          transition: color 0.15s;
        }
        .citation-number:hover {
          color: #fca5a5;
        }

        /* Report content styling */
        .report-content h1 {
          font-size: 1.25rem;
          font-weight: 700;
          color: #ffffff;
          margin-top: 1rem;
          margin-bottom: 0.75rem;
        }
        .report-content h2 {
          font-size: 1.1rem;
          font-weight: 600;
          color: #ffffff;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
        }
        .report-content h3 {
          font-size: 1rem;
          font-weight: 600;
          color: #ffffff;
          margin-top: 1rem;
          margin-bottom: 0.5rem;
        }
        .report-content p {
          font-size: 0.875rem;
          color: #a0a0a0;
          line-height: 1.7;
          margin-bottom: 0.75rem;
        }
        .report-content ul {
          margin-bottom: 0.75rem;
          padding-left: 0.25rem;
        }
        .report-content li {
          font-size: 0.875rem;
          color: #a0a0a0;
          line-height: 1.7;
          padding-left: 0.25rem;
        }
        .report-content strong {
          color: #ffffff;
          font-weight: 600;
        }
        .report-content a {
          color: #f87171;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .report-content hr {
          border-color: #1a1a1a;
          margin: 1rem 0;
        }

        /* Pulse animation for loading dots */
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
