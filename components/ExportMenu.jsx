'use client'

/**
 * ExportMenu — shared "download report in different formats" dropdown.
 *
 * Used by research / reelpen / study / devtools. Trigger carries the
 * IconDownloadReport glyph; rows carry a format badge chip (MD / PDF /
 * DOCX / HTML / TXT) so each format is visually distinct.
 *
 * HUSH restyle (v5.9): trigger is an accent-hover pill matching
 * CopyButton; on completion a slide-up HUSH notification card confirms
 * the export (or reports a failure) via FeedbackToast.
 *
 * Props:
 *  - formats: [{ id, badge, label, run: async () => void }]   (required)
 *  - label: trigger text (default 'Export')
 *  - errorText: flash message on failure (default 'Export failed')
 *  - successText: card title on success (default 'Export complete')
 *  - startedText: card body on success (default 'Your download has started')
 *  - direction: 'down' | 'up'   (default 'down')
 *  - align: 'right' | 'left'    (default 'right')
 *  - compact: icon-only trigger (no label)
 *  - className: extra classes on the wrapper
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { IconDownloadReport, IconSpinner } from '@/components/Icons'
import { showFeedback } from '@/components/FeedbackToast'

// Format badge palette — keyed by badge text, subtle tinted chips
const BADGE_STYLES = {
  MD: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  PDF: 'bg-red-500/10 text-red-400 border-red-500/20',
  DOCX: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  HTML: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  TXT: 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20',
  CSV: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
}

export default function ExportMenu({
  formats,
  label = 'Export',
  errorText = 'Export failed',
  successText = 'Export complete',
  startedText = 'Your download has started',
  direction = 'down',
  align = 'right',
  compact = false,
  className = '',
  stopPropagation = true,
}) {
  const [open, setOpen] = useState(false)
  const [busyId, setBusyId] = useState(null)
  const [failed, setFailed] = useState(false)
  const rootRef = useRef(null)
  const busy = busyId !== null

  // Click-outside + Escape close
  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const run = useCallback(async (fmt) => {
    if (busy) return
    setBusyId(fmt.id)
    setFailed(false)
    try {
      await fmt.run()
      setOpen(false)
      // HUSH card — confirm the download with the format that ran
      showFeedback({
        variant: 'card',
        tone: 'accent',
        title: successText,
        message: `${fmt.label} · ${startedText}`,
      })
    } catch (err) {
      console.error('[ExportMenu] export failed:', fmt.id, err)
      setFailed(true)
      setTimeout(() => setFailed(false), 2400)
      showFeedback({
        variant: 'card',
        tone: 'error',
        title: errorText,
        message: fmt.label,
      })
    } finally {
      setBusyId(null)
    }
  }, [busy, successText, startedText, errorText])

  if (!Array.isArray(formats) || formats.length === 0) return null

  return (
    <div ref={rootRef} className={`relative ${className}`} data-export-menu="">
      <button
        onClick={(e) => {
          if (stopPropagation) e.stopPropagation()
          if (!busy) setOpen((v) => !v)
        }}
        disabled={busy}
        className={`inline-flex items-center gap-1.5 shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-medium transition-all duration-200 active:scale-[0.96] ${
          failed
            ? 'border-red-500/50 text-red-400 bg-red-500/[0.07]'
            : busy
            ? 'border-[#2a2a2a] bg-[#0a0a0a]/60 text-[#525252]'
            : 'border-[#2a2a2a] bg-[#0a0a0a]/60 text-[#a3a3a3] hover:border-[#FF3366]/60 hover:text-[#FF3366] hover:bg-[#FF3366]/[0.05]'
        }`}
        title={failed ? errorText : label}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {busy
          ? <IconSpinner size={12} className="animate-spin" />
          : <IconDownloadReport size={12} />}
        {!compact && <span>{failed ? errorText : label}</span>}
      </button>

      {open && (
        <div
          role="menu"
          onClick={(e) => { if (stopPropagation) e.stopPropagation() }}
          className={`absolute ${direction === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'} ${
            align === 'right' ? 'right-0' : 'left-0'
          } w-52 bg-[#1a1a1a] border border-[#2a2a2a] rounded-2xl shadow-2xl py-1.5 z-50 animate-scale-in overflow-hidden`}
        >
          <p className="px-3.5 pt-0.5 pb-1.5 mb-1 text-[10px] text-[#525252] font-medium uppercase tracking-wider border-b border-white/[0.06]">
            {label}
          </p>
          {formats.map((fmt) => (
            <button
              key={fmt.id}
              role="menuitem"
              disabled={busy}
              onClick={() => run(fmt)}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-[#d4d4d4] hover:text-white hover:bg-[#FF3366]/[0.07] transition-colors text-left disabled:opacity-50"
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
        </div>
      )}
    </div>
  )
}
