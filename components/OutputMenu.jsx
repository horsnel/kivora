'use client'

/**
 * OutputMenu — the single 3-dot (⋮) action menu, unified across all
 * output cards (ReelPen, DevTools, StudyDesk, Research).
 *
 * One button per output card. Clicking it opens a compact menu with
 * three actions:
 *
 *   • Share  — Web Share API when available (title/text/url from
 *              `shareData`); on unsupported browsers falls back to
 *              copying the url (or text) with a HUSH toast.
 *   • Copy   — writes `getText()` to the clipboard (execCommand
 *              fallback) + HUSH top toast, same feedback as v5.9.
 *   • Export — flips the menu to a format list (MD / PDF / DOCX /
 *              HTML / TXT badge chips) with a back row; runs the
 *              format's `run()` and confirms via a HUSH slide-up card.
 *
 * Rows whose data is absent are hidden, so the same component serves
 * cards with or without export/share capability.
 *
 * Props:
 *  - getText: () => string            text for Copy (+ share fallback)
 *  - copyLabel / copiedLabel          Copy row + toast text
 *  - onCopied: () => void             extra callback after a copy
 *  - shareData: () => ({title,text,url})  absent → Share row hidden
 *  - shareLabel                       Share row text
 *  - shareFallbackLabel               toast when share falls back to copy
 *  - formats: [{id,badge,label,run}]  absent/empty → Export row hidden
 *  - exportLabel / errorText / successText / startedText
 *  - direction: 'down' | 'up'         menu opens below/above the trigger
 *  - align: 'right' | 'left'
 *  - title                            trigger aria-label
 *  - className                        extra classes on the wrapper
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import {
  IconDotsVertical, IconShare, IconCopy, IconCheck,
  IconDownloadReport, IconSpinner,
} from '@/components/Icons'
import { XGlyph, CHEV_D } from '@/components/BackButton'
import { showFeedback } from '@/components/FeedbackToast'

// Format badge palette — same chips as the v5.9 ExportMenu
const BADGE_STYLES = {
  MD: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  PDF: 'bg-red-500/10 text-red-400 border-red-500/20',
  DOCX: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  HTML: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  TXT: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  CSV: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
}

async function writeClipboard(text) {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    // Clipboard API can be missing on http:// or older webviews —
    // legacy execCommand fallback keeps the action functional.
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    document.body.removeChild(ta)
  }
}

export default function OutputMenu({
  getText,
  copyLabel = 'Copy',
  copiedLabel = 'Copied',
  onCopied,
  shareData,
  shareLabel = 'Share',
  shareFallbackLabel = 'Copied to clipboard',
  formats,
  exportLabel = 'Export',
  errorText = 'Export failed',
  successText = 'Export complete',
  startedText = 'Your download has started',
  direction = 'down',
  align = 'right',
  title = 'Actions',
  className = '',
  stopPropagation = true,
}) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState('main')       // 'main' | 'export'
  const [busyId, setBusyId] = useState(null)     // running export format id
  const [copied, setCopied] = useState(false)    // copy-row check flash
  const rootRef = useRef(null)
  const timer = useRef(null)
  const busy = busyId !== null

  const hasShare = typeof shareData === 'function'
  const hasFormats = Array.isArray(formats) && formats.length > 0

  const close = useCallback(() => {
    setOpen(false)
    setView('main')
  }, [])

  // Click-outside + Escape close (reset to the main view)
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) close()
    }
    const onKey = (e) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  useEffect(() => () => clearTimeout(timer.current), [])

  // ── Copy ──
  const handleCopy = async () => {
    const text = typeof getText === 'function' ? getText() : ''
    if (!text) return
    await writeClipboard(text)
    setCopied(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), 2000)
    showFeedback({ variant: 'toast', message: copiedLabel })
    if (onCopied) onCopied()
    close()
  }

  // ── Share ──
  const handleShare = async () => {
    const data = shareData() || {}
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: data.title,
          text: data.text,
          url: data.url,
        })
        close()          // native sheet handled the feedback
        return
      } catch (err) {
        if (err && err.name === 'AbortError') { close(); return }  // user cancelled
        // otherwise fall through to the clipboard fallback
      }
    }
    const fallback = data.url || data.text || (typeof getText === 'function' ? getText() : '')
    if (fallback) {
      await writeClipboard(fallback)
      showFeedback({ variant: 'toast', message: shareFallbackLabel })
    }
    close()
  }

  // ── Export ──
  const runExport = useCallback(async (fmt) => {
    if (busy) return
    setBusyId(fmt.id)
    try {
      await fmt.run()
      close()
      // HUSH card — confirm the download with the format that ran
      showFeedback({
        variant: 'card',
        tone: 'accent',
        title: successText,
        message: `${fmt.label} · ${startedText}`,
      })
    } catch (err) {
      console.error('[OutputMenu] export failed:', fmt.id, err)
      showFeedback({
        variant: 'card',
        tone: 'error',
        title: errorText,
        message: fmt.label,
      })
    } finally {
      setBusyId(null)
    }
  }, [busy, successText, startedText, errorText, close])

  const menuRow = 'w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-[#d4d4d4] hover:text-white hover:bg-[#FF3366]/[0.07] transition-colors text-left disabled:opacity-50'

  return (
    <div ref={rootRef} className={`relative ${className}`} data-output-menu="">
      {/* ── Trigger: 3-dot kebab ── */}
      <button
        onClick={(e) => {
          if (stopPropagation) e.stopPropagation()
          if (open) { close(); return }
          if (!busy) { setOpen(true); setView('main') }
        }}
        disabled={busy}
        className="inline-flex items-center justify-center w-[30px] h-[30px] shrink-0 rounded-full border border-[#2a2a2a] bg-[#0a0a0a]/60 text-[#a3a3a3] hover:border-[#FF3366]/60 hover:text-[#FF3366] hover:bg-[#FF3366]/[0.05] transition-all duration-200 active:scale-[0.96]"
        title={title}
        aria-label={title}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {busy ? <IconSpinner size={13} className="animate-spin" /> : <IconDotsVertical size={14} />}
      </button>

      {open && (
        <div
          role="menu"
          onClick={(e) => { if (stopPropagation) e.stopPropagation() }}
          className={`absolute ${direction === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'} ${
            align === 'right' ? 'right-0' : 'left-0'
          } w-52 bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl shadow-2xl py-1.5 z-50 animate-scale-in overflow-hidden`}
        >
          {/* ── header: menu name + soft-circle-X close (reference design #2) ── */}
          <div className="flex items-center justify-between pl-4 pr-2 pt-1.5 pb-2 mb-1 border-b border-white/[0.06]">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#737373] truncate">{title}</span>
            <button
              type="button"
              role="menuitem"
              onClick={close}
              aria-label="Close"
              className="shrink-0 w-7 h-7 rounded-full bg-[#1c1c1c] text-[#a3a3a3] hover:bg-[#262626] hover:text-[#fafafa] active:scale-95 flex items-center justify-center transition-all duration-200"
            >
              <XGlyph size={13} />
            </button>
          </div>
          {view === 'main' ? (
            <>
              {/* ── Main view: Share / Copy / Export ── */}
              {hasShare && (
                <button role="menuitem" onClick={handleShare} className={menuRow}>
                  <IconShare size={14} className="shrink-0 text-[#737373]" />
                  <span className="flex-1">{shareLabel}</span>
                </button>
              )}
              {typeof getText === 'function' && (
                <button role="menuitem" onClick={handleCopy} className={menuRow}>
                  {copied
                    ? <IconCheck size={14} className="shrink-0 text-[#FF3366]" />
                    : <IconCopy size={14} className="shrink-0 text-[#737373]" />}
                  <span className="flex-1">{copied ? copiedLabel : copyLabel}</span>
                </button>
              )}
              {hasFormats && (
                <button role="menuitem" onClick={() => setView('export')} className={menuRow}>
                  <IconDownloadReport size={14} className="shrink-0 text-[#737373]" />
                  <span className="flex-1">{exportLabel}</span>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 rotate-180 text-[#737373]" aria-hidden="true">
                    <path d={CHEV_D} />
                  </svg>
                </button>
              )}
            </>
          ) : (
            <>
              {/* ── Export view: chevron-back row (reference design #1, drawn
                  inline — a BackButton here would nest a button inside a
                  role=menuitem button, which is invalid HTML) ── */}
              <button
                role="menuitem"
                onClick={() => setView('main')}
                className="w-full flex items-center gap-2.5 px-3.5 pt-0.5 pb-2 mb-1 text-[10px] text-[#737373] hover:text-white font-medium uppercase tracking-wider border-b border-white/[0.06] transition-colors text-left"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0" aria-hidden="true">
                  <path d={CHEV_D} />
                </svg>
                <span className="flex-1">{exportLabel}</span>
              </button>
              {formats.map((fmt) => (
                <button
                  key={fmt.id}
                  role="menuitem"
                  disabled={busy}
                  onClick={() => runExport(fmt)}
                  className={menuRow}
                >
                  <span
                    className={`shrink-0 inline-flex items-center justify-center min-w-[34px] px-1.5 py-0.5 rounded border text-[9px] font-bold tracking-wide font-mono ${
                      BADGE_STYLES[fmt.badge] || 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20'
                    }`}
                  >
                    {fmt.badge}
                  </span>
                  <span className="flex-1">{fmt.label}</span>
                  {busyId === fmt.id && <IconSpinner size={12} className="animate-spin shrink-0" />}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}
