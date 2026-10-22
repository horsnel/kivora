'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

// XTerminal touches DOM — client-only dynamic import (same pattern as chat)
import dynamic from 'next/dynamic'
const XTerminal = dynamic(() => import('@/components/XTerminal'), { ssr: false })

// ── GlobalCodeRunner (v5.16) ─────────────────────────────────────────
// The Run button on ANY code block (chat, research reports, study, blog,
// explore, reelpen, devtools) now executes in a terminal that follows the
// user across the whole app: a bottom drawer slides up, echoes the code,
// streams the execution output, and stays until the user closes it.
//
// How it works:
//   1. MarkdownRenderer's CodeBlock dispatches `kivora:code-exec-start`
//      { code, languageId } and POSTs to /api/execute (Judge0).
//   2. This drawer listens, slides up, and mirrors the process into xterm.
//   3. `kivora:code-exec-done` { output, exitCode, success } prints the
//      result. The drawer stays open — the user closes it (no auto-hide:
//      outside chat there is no conversation to "return" to).
//
// The chat page hosts its own embedded Live Terminal and opts out via
// `window.__kivoraChatLive = true` (set on mount, cleared on unmount).

const LANG_NAMES = {
  46: 'bash', 71: 'python', 63: 'javascript', 74: 'typescript', 82: 'sql',
  62: 'java', 54: 'c++', 50: 'c', 60: 'go', 73: 'rust', 72: 'ruby', 68: 'php',
}

export default function GlobalCodeRunner() {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false) // xterm lazy-mounts on first open
  const [lang, setLang] = useState('')
  const [status, setStatus] = useState('idle') // idle | running | done | error
  const xtermRef = useRef(null)
  const writeQueueRef = useRef([])
  const retryTimerRef = useRef(null)
  const statusRef = useRef('idle')

  const write = useCallback((text, color) => {
    const term = xtermRef.current
    if (!term) { writeQueueRef.current.push(text); return }
    const colorMap = { green: '\x1b[32m', yellow: '\x1b[33m', red: '\x1b[31m', cyan: '\x1b[36m', gray: '\x1b[90m', reset: '\x1b[0m' }
    term.write(color ? `${colorMap[color] || ''}${text}${colorMap.reset}` : text)
  }, [])

  const writeln = useCallback((text, color) => write(`${text}\r\n`, color), [write])

  const flushQueue = useCallback(() => {
    const term = xtermRef.current
    if (!term) return
    const q = writeQueueRef.current
    writeQueueRef.current = []
    for (const t of q) term.write(t)
  }, [])

  // Wait for the lazily-loaded xterm chunk, then flush queued writes
  const flushWhenReady = useCallback((attempt = 0) => {
    if (!writeQueueRef.current.length) return
    if (xtermRef.current) { flushQueue(); return }
    if (attempt > 16) { writeQueueRef.current = []; return } // ~2s, give up
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
    retryTimerRef.current = setTimeout(() => flushWhenReady(attempt + 1), 120)
  }, [flushQueue])

  useEffect(() => {
    const onStart = (e) => {
      const d = e.detail || {}
      // Chat page mirrors exec runs inside its own embedded Live Terminal
      if (typeof window !== 'undefined' && window.__kivoraChatLive) return
      const code = String(d.code || '')
      const langName = LANG_NAMES[d.languageId] || 'code'
      setOpen(true)
      setMounted(true)
      setLang(langName)
      statusRef.current = 'running'
      setStatus('running')
      writeln('')
      writeln(`\x1b[90m── Kivora · running ${langName} ──\x1b[0m`)
      if (code) {
        const allLines = code.split('\n')
        const lines = allLines.slice(0, 50)
        write('\x1b[32m$\x1b[0m ', null)
        lines.forEach((l, i) => {
          const isLastEchoed = i === lines.length - 1 && allLines.length <= 50 && allLines.length === 1
          write((l.length > 160 ? l.slice(0, 160) + '…' : l) + (isLastEchoed ? '' : '\r\n'), 'cyan')
        })
        if (allLines.length > 50) writeln(`… ${allLines.length - 50} more lines`, 'gray')
      }
      writeln('\x1b[90mexecuting — output will appear here\x1b[0m')
      flushWhenReady()
    }

    const onDone = (e) => {
      const d = e.detail || {}
      if (typeof window !== 'undefined' && window.__kivoraChatLive) return
      const output = String(d.output || '')
      if (output) {
        writeln('')
        const outLines = output.split('\n')
        const shown = outLines.slice(0, 80)
        shown.forEach((l, i) => write(`${l.length > 200 ? l.slice(0, 200) + '…' : l}${i < shown.length - 1 ? '\r\n' : ''}`))
        if (outLines.length > 80) writeln(`… ${outLines.length - 80} more lines`, 'gray')
      } else {
        writeln('(no output)', 'gray')
      }
      const code_ = d.exitCode ?? d.exit_code
      const failed = d.success === false || (code_ != null && code_ !== 0)
      if (failed) writeln(`\x1b[31m[Exit code: ${code_ ?? 1}]\x1b[0m`)
      else writeln('\x1b[32m[Done]\x1b[0m')
      writeln('')
      statusRef.current = failed ? 'error' : 'done'
      setStatus(failed ? 'error' : 'done')
      flushWhenReady()
    }

    window.addEventListener('kivora:code-exec-start', onStart)
    window.addEventListener('kivora:code-exec-done', onDone)
    return () => {
      window.removeEventListener('kivora:code-exec-start', onStart)
      window.removeEventListener('kivora:code-exec-done', onDone)
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current)
    }
  }, [write, writeln, flushWhenReady])

  // Preload the xterm chunk after first paint so the first open is instant
  useEffect(() => { const t = setTimeout(() => { try { XTerminal.preload?.() } catch {} }, 2500); return () => clearTimeout(t) }, [])

  const close = () => {
    setOpen(false)
    statusRef.current = 'idle'
    setStatus('idle')
    // Keep xterm mounted (re-open is instant); clear the buffer so the next
    // run starts clean
    try { xtermRef.current?.clear() } catch {}
  }

  if (!open && !mounted) return null

  const statusChip = status === 'running'
    ? { label: 'running', color: '#facc15' }
    : status === 'done'
      ? { label: 'done', color: '#4ade80' }
      : status === 'error'
        ? { label: 'failed', color: '#ef4444' }
        : { label: 'ready', color: '#737373' }

  return (
    <div
      className="fixed inset-x-0 bottom-0 z-[9997] transition-transform duration-300 ease-out"
      style={{ transform: open ? 'translateY(0)' : 'translateY(110%)', pointerEvents: open ? 'auto' : 'none' }}
      aria-hidden={!open}
    >
      <div
        className="mx-auto max-w-4xl mx-3 sm:mx-auto mb-3 rounded-2xl overflow-hidden border border-[#2a2a2a]"
        style={{ background: '#0d0d0d', boxShadow: '0 -12px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.02)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-11 border-b border-[#222] bg-[#111]">
          <div className="flex items-center gap-2.5 min-w-0">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#00ff41" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4 17 10 11 4 5" />
              <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
            <span className="text-[12px] font-mono text-[#a3a3a3] uppercase tracking-wider truncate">Live Terminal{lang ? ` · ${lang}` : ''}</span>
            <span
              className="text-[10px] font-medium px-2 py-0.5 rounded-full border shrink-0"
              style={{ color: statusChip.color, borderColor: `${statusChip.color}44`, background: `${statusChip.color}11` }}
            >
              {statusChip.label}
            </span>
          </div>
          <button
            onClick={close}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#737373] hover:text-white hover:bg-[#222] transition-colors shrink-0"
            aria-label="Close terminal"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        {/* Terminal body */}
        <div style={{ height: '300px' }}>
          <XTerminal
            ref={xtermRef}
            options={{ fontSize: 12.5 }}
            className="w-full h-full"
          />
        </div>
      </div>
    </div>
  )
}
