'use client'
import { useState, useEffect, useRef, useCallback } from 'react'

/* ═══════════════════════════════════════════════════════════════
   ThinkingState — Professional AI thinking indicator
   5 unique visual modes for each focus mode:
     • compact  → All focus (professional pill with gradient border)
     • orb      → Code focus (neural node with pipeline + depth)
     • academic → Academic focus (research cards + source counter)
     • writing  → Writing focus (typewriter cursor + word count)
     • math     → Math focus (equation symbols + derivation chain)
     • full     → DevTools/Study/Explore (full vertical stage list)
   ═══════════════════════════════════════════════════════════════ */

// ── Stage Icons ──────────────────────────────────────────────
function StageIcon({ type, size = 14, className = '' }) {
  const icons = {
    brain: (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
        <path d="M8 2C5.5 2 3.5 4 3.5 6c0 1 .4 1.9 1 2.6C3.8 9 3 10 3 11.2 3 13 4.6 14 6.2 14c.7 0 1.3-.2 1.8-.6V8M8 2c2.5 0 4.5 2 4.5 4 0 1-.4 1.9-1 2.6C12.2 9 13 10 13 11.2 13 13 11.4 14 9.8 14c-.7 0-1.3-.2-1.8-.6V8" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M5 6h2M9 6h2M5 11h2M9 11h2" stroke="currentColor" strokeWidth="0.75" strokeLinecap="round"/>
      </svg>
    ),
    search: (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
        <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.25"/>
        <path d="M10 10l4 4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      </svg>
    ),
    code: (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
        <path d="M5 4L2 8l3 4M11 4l3 4-3 4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    sparkle: (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
        <path d="M8 1v4M8 11v4M1 8h4M11 8h4" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
        <path d="M3 3l2.5 2.5M10.5 10.5L13 13M13 3l-2.5 2.5M5.5 10.5L3 13" stroke="currentColor" strokeWidth="0.75" strokeLinecap="round"/>
      </svg>
    ),
    book: (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
        <path d="M2 3h5a1 1 0 011 1v9a0.5 0.5 0 00-.5-.5H2V3zM14 3H9a1 1 0 00-1 1v9a0.5 0.5 0 01.5-.5H14V3z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
      </svg>
    ),
    globe: (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeWidth="1"/>
        <path d="M1.5 8h13M8 1.5c-2 2-2 9 0 13M8 1.5c2 2 2 9 0 13" stroke="currentColor" strokeWidth="0.75"/>
      </svg>
    ),
    terminal: (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
        <path d="M3 4l4 4-4 4M9 12h4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    shield: (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
        <path d="M8 2l5 2v4c0 3-2 5-5 6-3-1-5-3-5-6V4l5-2z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      </svg>
    ),
    file: (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
        <path d="M9 2H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V6L9 2zM9 2v4h4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      </svg>
    ),
    database: (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
        <ellipse cx="8" cy="4" rx="5.5" ry="2" stroke="currentColor" strokeWidth="1"/>
        <path d="M2.5 4v4c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2V4" stroke="currentColor" strokeWidth="1"/>
        <path d="M2.5 8v4c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2V8" stroke="currentColor" strokeWidth="1"/>
      </svg>
    ),
    zap: (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
        <path d="M9 2L4 9h4l-1 5 5-7H8l1-5z" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    mail: (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
        <path d="M2 4h12v8H2zM2 4l6 5 6-5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      </svg>
    ),
    check: (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
        <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
    pen: (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
        <path d="M11.5 2.5l2 2-9 9H2.5v-2l9-9z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" strokeLinecap="round"/>
      </svg>
    ),
    lightbulb: (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
        <path d="M6 13h4M8 1a4.5 4.5 0 00-3 7.8V11h6V8.8A4.5 4.5 0 008 1z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  }
  return icons[type] || icons.sparkle
}

// ── Spinning indicator for active stage ──────────────────────
function ActiveSpinner({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className="animate-spin">
      <circle cx="8" cy="8" r="6" stroke="url(#thinkGrad)" strokeWidth="1.5" strokeOpacity="0.3"/>
      <path d="M14 8a6 6 0 00-6-6" stroke="url(#thinkGrad)" strokeWidth="1.5" strokeLinecap="round"/>
      <defs>
        <linearGradient id="thinkGrad" x1="0" y1="0" x2="16" y2="16" gradientUnits="userSpaceOnUse">
          <stop stopColor="#a855f7"/>
          <stop offset="1" stopColor="#ef4444"/>
        </linearGradient>
      </defs>
    </svg>
  )
}

// ── Completed checkmark ──────────────────────────────────────
function CompletedCheck({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" fill="rgba(34,197,94,0.1)" stroke="rgba(34,197,94,0.3)" strokeWidth="1"/>
      <path d="M5.5 8l2 2 3-3.5" stroke="#22c55e" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ── Stage Configs for different contexts ─────────────────────
export const STAGE_CONFIGS = {
  chat: [
    { label: 'Understanding your message', icon: 'brain', duration: 1800 },
    { label: 'Searching knowledge base', icon: 'search', duration: 2200 },
    { label: 'Analyzing context', icon: 'sparkle', duration: 2000 },
    { label: 'Generating response', icon: 'pen', duration: Infinity },
  ],
  chatWithSearch: [
    { label: 'Understanding your message', icon: 'brain', duration: 1500 },
    { label: 'Searching the web', icon: 'globe', duration: 3000 },
    { label: 'Processing search results', icon: 'database', duration: 1800 },
    { label: 'Generating response', icon: 'pen', duration: Infinity },
  ],
  chatWithCode: [
    { label: 'Understanding your message', icon: 'brain', duration: 1500 },
    { label: 'Writing and executing code', icon: 'terminal', duration: 3500 },
    { label: 'Processing results', icon: 'code', duration: 1500 },
    { label: 'Generating response', icon: 'pen', duration: Infinity },
  ],
  chatWithImage: [
    { label: 'Understanding your request', icon: 'brain', duration: 1500 },
    { label: 'Generating image', icon: 'sparkle', duration: 5000 },
    { label: 'Finalizing output', icon: 'zap', duration: 1000 },
  ],
  chatWithVision: [
    { label: 'Analyzing image', icon: 'brain', duration: 2000 },
    { label: 'Identifying elements', icon: 'search', duration: 2500 },
    { label: 'Generating description', icon: 'pen', duration: Infinity },
  ],
  devtools: [
    { label: 'Analyzing input', icon: 'brain', duration: 1500 },
    { label: 'Processing with tool', icon: 'terminal', duration: 3000 },
    { label: 'Generating results', icon: 'sparkle', duration: Infinity },
  ],
  devtoolsCode: [
    { label: 'Parsing code', icon: 'code', duration: 1500 },
    { label: 'Running analysis', icon: 'terminal', duration: 3000 },
    { label: 'Generating results', icon: 'sparkle', duration: Infinity },
  ],
  devtoolsData: [
    { label: 'Parsing data', icon: 'database', duration: 1500 },
    { label: 'Processing with tool', icon: 'terminal', duration: 2500 },
    { label: 'Formatting output', icon: 'sparkle', duration: Infinity },
  ],
  devtoolsContent: [
    { label: 'Understanding requirements', icon: 'brain', duration: 1500 },
    { label: 'Generating content', icon: 'pen', duration: 3000 },
    { label: 'Polishing output', icon: 'sparkle', duration: Infinity },
  ],
  study: [
    { label: 'Understanding the question', icon: 'brain', duration: 1800 },
    { label: 'Researching topic', icon: 'book', duration: 2500 },
    { label: 'Generating content', icon: 'pen', duration: Infinity },
  ],
  studyCoding: [
    { label: 'Understanding the problem', icon: 'brain', duration: 1500 },
    { label: 'Writing solution', icon: 'code', duration: 3000 },
    { label: 'Explaining approach', icon: 'book', duration: Infinity },
  ],
  explore: [
    { label: 'Searching the web', icon: 'globe', duration: 2500 },
    { label: 'Analyzing results', icon: 'search', duration: 2000 },
    { label: 'Generating response', icon: 'pen', duration: Infinity },
  ],
  academic: [
    { label: 'Analyzing research question', icon: 'brain', duration: 1500 },
    { label: 'Searching academic sources', icon: 'book', duration: 2500 },
    { label: 'Verifying citations', icon: 'search', duration: 1800 },
    { label: 'Structuring response', icon: 'file', duration: Infinity },
  ],
  academicSearch: [
    { label: 'Analyzing research question', icon: 'brain', duration: 1500 },
    { label: 'Searching the web', icon: 'globe', duration: 3000 },
    { label: 'Cross-referencing sources', icon: 'book', duration: 1800 },
    { label: 'Structuring response', icon: 'file', duration: Infinity },
  ],
  writing: [
    { label: 'Understanding your vision', icon: 'brain', duration: 1500 },
    { label: 'Crafting narrative', icon: 'pen', duration: 2500 },
    { label: 'Refining voice & style', icon: 'lightbulb', duration: 1800 },
    { label: 'Polishing output', icon: 'sparkle', duration: Infinity },
  ],
  math: [
    { label: 'Parsing problem', icon: 'brain', duration: 1200 },
    { label: 'Setting up equations', icon: 'code', duration: 2000 },
    { label: 'Computing solution', icon: 'terminal', duration: 2500 },
    { label: 'Verifying result', icon: 'shield', duration: 1500 },
    { label: 'Writing explanation', icon: 'pen', duration: Infinity },
  ],
}

export default function ThinkingState({
  stages = STAGE_CONFIGS.chat,
  active = false,
  compact = false,
  orb = false,
  academic = false,
  writing = false,
  math = false,
  className = '',
  onComplete,
}) {
  const [currentStage, setCurrentStage] = useState(0)
  const [completedStages, setCompletedStages] = useState([])
  const [elapsedMs, setElapsedMs] = useState(0)
  const [finishing, setFinishing] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const timerRef = useRef(null)
  const stageTimerRef = useRef(null)
  const startTimeRef = useRef(null)

  // Reset state when activated
  const resetState = useCallback(() => {
    setCurrentStage(0)
    setCompletedStages([])
    setElapsedMs(0)
    setFinishing(false)
    setDetailsOpen(false)
    startTimeRef.current = Date.now()
  }, [])

  // Master timer — update elapsed time every 100ms
  useEffect(() => {
    if (!active) {
      clearInterval(timerRef.current)
      clearInterval(stageTimerRef.current)
      return
    }

    resetState()
    timerRef.current = setInterval(() => {
      if (startTimeRef.current) {
        setElapsedMs(Date.now() - startTimeRef.current)
      }
    }, 100)

    return () => {
      clearInterval(timerRef.current)
      clearInterval(stageTimerRef.current)
    }
  }, [active, resetState])

  // Stage progression — advance through stages based on durations
  useEffect(() => {
    if (!active || finishing) return
    if (currentStage >= stages.length) return

    const stageDuration = stages[currentStage]?.duration
    if (!stageDuration || stageDuration === Infinity) return

    stageTimerRef.current = setTimeout(() => {
      setCompletedStages(prev => [...prev, currentStage])
      setCurrentStage(prev => prev + 1)
    }, stageDuration)

    return () => clearTimeout(stageTimerRef.current)
  }, [active, currentStage, stages, finishing])

  // When active becomes false, quickly complete all remaining stages
  useEffect(() => {
    if (active || currentStage === 0) return

    setFinishing(true)
    let remaining = []
    for (let i = 0; i < stages.length; i++) {
      if (!completedStages.includes(i) && i !== currentStage) {
        remaining.push(i)
      }
    }

    setCompletedStages(prev => [...new Set([...prev, currentStage])])

    remaining.forEach((stageIdx, i) => {
      setTimeout(() => {
        setCompletedStages(prev => [...new Set([...prev, stageIdx])])
        if (i === remaining.length - 1) {
          setCurrentStage(stages.length)
          setFinishing(false)
          if (onComplete) onComplete()
        }
      }, 120 * (i + 1))
    })

    if (remaining.length === 0) {
      setTimeout(() => {
        setCurrentStage(stages.length)
        setFinishing(false)
        if (onComplete) onComplete()
      }, 200)
    }
  }, [active]) // eslint-disable-line react-hooks/exhaustive-deps

  // Format elapsed time
  const formatTime = (ms) => {
    const s = Math.floor(ms / 1000)
    const frac = Math.floor((ms % 1000) / 100)
    return `${s}.${frac}s`
  }

  if (!active && currentStage === 0 && completedStages.length === 0) return null

  const allDone = currentStage >= stages.length
  const activeIdx = Math.min(currentStage, stages.length - 1)
  const completedCount = completedStages.length
  const progress = stages.length > 0 ? (completedCount / stages.length) * 100 : 0

  // ── Compact mode (All focus — professional pill with gradient border) ──
  if (compact) {
    return (
      <div
        className={`thinking-compact ${allDone ? 'thinking-compact-done' : ''} ${className}`}
        onMouseEnter={() => setDetailsOpen(true)}
        onMouseLeave={() => setDetailsOpen(false)}
      >
        <div className="thinking-compact-header">
          <div className="thinking-compact-orb">
            {allDone ? (
              <CompletedCheck size={12} />
            ) : (
              <ActiveSpinner size={12} />
            )}
          </div>
          <span className="thinking-compact-label">
            {!allDone && (
              <span className="thinking-compact-prefix">thinking</span>
            )}
            <span className="thinking-compact-stage-text">
              {allDone ? 'Done' : stages[activeIdx]?.label || 'Thinking'}
            </span>
          </span>
          <span className="thinking-compact-time">{formatTime(elapsedMs)}</span>
        </div>

        {/* Progress bar replacing dots */}
        <div className="thinking-compact-bar-track">
          <div
            className="thinking-compact-bar-fill"
            style={{ width: `${allDone ? 100 : progress}%` }}
          />
        </div>

        {/* Expandable stage details with slide animation */}
        <div className={`thinking-compact-details ${detailsOpen ? 'open' : ''}`}>
          {stages.map((stage, i) => {
            const isDone = completedStages.includes(i)
            const isActive = i === activeIdx && !allDone
            return (
              <div
                key={i}
                className={`thinking-compact-step ${isDone ? 'done' : isActive ? 'active' : 'pending'}`}
              >
                {isDone ? (
                  <CompletedCheck size={10} />
                ) : isActive ? (
                  <ActiveSpinner size={10} />
                ) : (
                  <div className="thinking-step-dot-pending" />
                )}
                <span className="thinking-step-label">{stage.label}</span>
                {isDone && <span className="thinking-step-check">&#10003;</span>}
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Orb mode (Code focus — neural node with pipeline + depth counter) ──
  if (orb) {
    return (
      <div className={`thinking-orb ${allDone ? 'thinking-orb-done' : ''} ${className}`}>
        {/* Faint matrix background */}
        <div className="thinking-orb-matrix" />

        <div className="thinking-orb-inner">
          <div className="thinking-orb-glow" />
          <div className="thinking-orb-svg">
            <svg width="18" height="18" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" className="thinking-orb-node thinking-orb-top" />
              <circle cx="7" cy="24" r="3" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" className="thinking-orb-node thinking-orb-left" />
              <circle cx="25" cy="24" r="3" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" className="thinking-orb-node thinking-orb-right" />
              <line x1="16" y1="11.5" x2="7" y2="21" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" className="thinking-orb-line" />
              <line x1="16" y1="11.5" x2="25" y2="21" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" className="thinking-orb-line" />
              <line x1="7" y1="24" x2="25" y2="24" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" className="thinking-orb-line" />
            </svg>
          </div>
          <div className="thinking-orb-text-block">
            <div className="thinking-orb-label-row">
              <span className="thinking-orb-label">
                {allDone ? 'Complete' : stages[activeIdx]?.label || 'Thinking'}
              </span>
              <span className="thinking-orb-blink">|</span>
            </div>
            <div className="thinking-orb-meta">
              <span className="thinking-orb-depth">depth:{' '}{allDone ? stages.length : activeIdx + 1}</span>
              <span className="thinking-orb-time">{formatTime(elapsedMs)}</span>
            </div>
          </div>
        </div>

        {/* Pipeline visualization */}
        <div className="thinking-orb-pipeline">
          {stages.map((_, i) => (
            <div key={i} className="thinking-orb-pipe-segment">
              <div
                className={`thinking-orb-pipe-node ${
                  completedStages.includes(i) ? 'done' :
                  i === activeIdx && !allDone ? 'active' : 'pending'
                }`}
              />
              {i < stages.length - 1 && (
                <div
                  className={`thinking-orb-pipe-line ${
                    completedStages.includes(i) ? 'done' :
                    i === activeIdx && !allDone ? 'active' : 'pending'
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Academic mode (research cards + source counter + peer review stamps) ──
  if (academic) {
    return (
      <div className={`thinking-academic ${allDone ? 'thinking-academic-done' : ''} ${className}`}>
        {/* Faint lined-paper texture */}
        <div className="thinking-academic-paper" />

        <div className="thinking-academic-inner">
          <div className="thinking-academic-icon">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 3h5a2 2 0 012 2v1M2 3a1 1 0 00-1 1v10l3-2 3 2V6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="thinking-academic-book"/>
              <path d="M10 6h3a1 1 0 011 1v8l-2.5-1.5L9 15V7a1 1 0 011-1z" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="thinking-academic-book2"/>
            </svg>
          </div>
          <div className="thinking-academic-text">
            <span className="thinking-academic-label">
              {allDone ? 'Research complete' : stages[activeIdx]?.label || 'Researching'}
            </span>
            <span className="thinking-academic-sources">
              {completedCount}{completedCount === 1 ? ' source' : ' sources'} consulted
            </span>
          </div>
          <span className="thinking-academic-time">{formatTime(elapsedMs)}</span>
        </div>

        {/* Citation index cards */}
        <div className="thinking-academic-cards">
          {stages.map((_, i) => (
            <div
              key={i}
              className={`thinking-academic-card ${
                completedStages.includes(i) ? 'done' :
                i === activeIdx && !allDone ? 'active' : 'pending'
              }`}
            >
              {completedStages.includes(i) && (
                <span className="thinking-academic-stamp">&#10003;</span>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Writing mode (typewriter cursor + word count + draft badge) ──
  if (writing) {
    return (
      <div className={`thinking-writing ${allDone ? 'thinking-writing-done' : ''} ${className}`}>
        {/* Faint paper texture */}
        <div className="thinking-writing-paper" />

        <div className="thinking-writing-inner">
          <div className="thinking-writing-pen">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path d="M11.5 2.5l2 2-9 9H2.5v-2l9-9z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" strokeLinecap="round" className="thinking-writing-pen-path"/>
              <path d="M10 4l2 2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" className="thinking-writing-pen-line"/>
            </svg>
          </div>
          <div className="thinking-writing-text">
            <span className="thinking-writing-label">
              {allDone ? 'Final draft ready' : stages[activeIdx]?.label || 'Writing'}
            </span>
            <span className="thinking-writing-cursor">|</span>
          </div>
          <span className={`thinking-writing-badge ${allDone ? 'final' : 'draft'}`}>
            {allDone ? 'final' : 'draft'}
          </span>
          <span className="thinking-writing-time">{formatTime(elapsedMs)}</span>
        </div>

        {/* Word count + ink strokes */}
        <div className="thinking-writing-ink">
          <span className="thinking-writing-wordcount">
            {Math.min(Math.floor(elapsedMs / 40), 500)} words crafted
          </span>
          <div className="thinking-writing-strokes">
            {stages.map((_, i) => (
              <div
                key={i}
                className={`thinking-writing-ink-segment ${
                  completedStages.includes(i) ? 'done' :
                  i === activeIdx && !allDone ? 'active' : 'pending'
                }`}
              />
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Math mode (equation symbols + derivation chain + verification badges) ──
  if (math) {
    const mathSymbols = ['\u222B', '\u2211', '\u2202', '\u2200', '\u221A', '\u2220']
    const connectors = ['\u2192', '\u21D2', '\u2234']

    return (
      <div className={`thinking-math ${allDone ? 'thinking-math-done' : ''} ${className}`}>
        {/* Faint graph paper texture */}
        <div className="thinking-math-grid" />

        <div className="thinking-math-inner">
          <div className="thinking-math-symbol">
            <span className="thinking-math-sym-char">
              {mathSymbols[activeIdx % mathSymbols.length]}
            </span>
          </div>
          <div className="thinking-math-text">
            <span className="thinking-math-label">
              {allDone ? 'Solution verified' : stages[activeIdx]?.label || 'Computing'}
            </span>
            <span className="thinking-math-ops">
              {completedCount} op{completedCount !== 1 ? 's' : ''}
            </span>
          </div>
          <span className="thinking-math-time">{formatTime(elapsedMs)}</span>
        </div>

        {/* Derivation chain */}
        <div className="thinking-math-chain">
          {stages.map((_, i) => (
            <div key={i} className="thinking-math-chain-step">
              <div
                className={`thinking-math-chain-node ${
                  completedStages.includes(i) ? 'done' :
                  i === activeIdx && !allDone ? 'active' : 'pending'
                }`}
              >
                <span className="thinking-math-chain-num">{i + 1}</span>
                {completedStages.includes(i) && (
                  <span className="thinking-math-chain-check">&#10003;</span>
                )}
              </div>
              {i < stages.length - 1 && (
                <span className="thinking-math-chain-connector">
                  {connectors[i % connectors.length]}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Full mode (for DevTools, Study, Explore) ────────────
  return (
    <div className={`thinking-full ${allDone ? 'thinking-full-done' : ''} ${className}`}>
      {/* Header */}
      <div className="thinking-full-header">
        <div className="thinking-full-orb">
          {allDone ? (
            <CompletedCheck size={16} />
          ) : (
            <ActiveSpinner size={16} />
          )}
        </div>
        <div className="thinking-full-title-area">
          <span className="thinking-full-title">{allDone ? 'Complete' : 'Thinking'}</span>
          <span className="thinking-full-time">{formatTime(elapsedMs)}</span>
        </div>
      </div>

      {/* Stage list */}
      <div className="thinking-full-stages">
        {stages.map((stage, i) => {
          const isDone = completedStages.includes(i)
          const isActive = i === activeIdx && !allDone
          const isPending = !isDone && !isActive
          return (
            <div key={i} className="thinking-full-stage-row">
              {i < stages.length - 1 && (
                <div className={`thinking-connector ${isDone ? 'done' : ''}`} />
              )}
              <div className={`thinking-stage-icon-wrap ${
                isDone ? 'done' : isActive ? 'active' : 'pending'
              }`}>
                {isDone ? (
                  <CompletedCheck size={12} />
                ) : isActive ? (
                  <ActiveSpinner size={12} />
                ) : (
                  <div className="thinking-stage-dot-pending" />
                )}
              </div>
              <div className={`thinking-stage-content ${
                isDone ? 'done' : isActive ? 'active' : 'pending'
              }`}>
                <div className="thinking-stage-icon-label">
                  {!isPending && <StageIcon type={stage.icon} size={12} className="thinking-stage-sicon" />}
                  <span className="thinking-stage-text">{stage.label}</span>
                </div>
                {isActive && (
                  <div className="thinking-stage-pulse" />
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Bottom shimmer */}
      {!allDone && (
        <div className="thinking-full-shimmer-bar">
          <div className="thinking-shimmer-progress" />
        </div>
      )}
    </div>
  )
}
