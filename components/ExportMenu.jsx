'use client'

/**
 * ExportMenu — shared "download report in different formats" dropdown.
 *
 * Used by research / reelpen / study / devtools. Trigger carries the
 * IconDownloadReport glyph; rows carry a format badge chip (MD / PDF /
 * DOCX / HTML / TXT) so each format is visually distinct.
 *
 * Props:
 *  - formats: [{ id, badge, label, run: async () => void }]   (required)
 *  - label: trigger text (default 'Export')
 *  - errorText: flash message on failure (default 'Export failed')
 *  - direction: 'down' | 'up'   (default 'down')
 *  - align: 'right' | 'left'    (default 'right')
 *  - compact: icon-only trigger (no label)
 *  - className: extra classes on the wrapper
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import { IconDownloadReport, IconSpinner } from '@/components/Icons'

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
    } catch (err) {
      console.error('[ExportMenu] export failed:', fmt.id, err)
      setFailed(true)
      setTimeout(() => setFailed(false), 2400)
    } finally {
      setBusyId(null)
    }
  }, [busy])

  if (!Array.isArray(formats) || formats.length === 0) return null

  return (
    <div ref={rootRef} className={`relative ${className}`} data-export-menu="">
      <button
        onClick={(e) => {
          if (stopPropagation) e.stopPropagation()
          if (!busy) setOpen((v) => !v)
        }}
        disabled={busy}
        className={`flex items-center gap-1 shrink-0 transition-colors ${
          failed
            ? 'text-red-400'
            : busy
            ? 'text-muted'
            : 'text-[#525252] hover:text-white'
        }`}
        title={failed ? errorText : label}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {busy
          ? <IconSpinner size={12} className="animate-spin" />
          : <IconDownloadReport size={12} />}
        {!compact && <span className="text-[10px]">{failed ? errorText : label}</span>}
      </button>

      {open && (
        <div
          role="menu"
          onClick={(e) => { if (stopPropagation) e.stopPropagation() }}
          className={`absolute ${direction === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'} ${
            align === 'right' ? 'right-0' : 'left-0'
          } w-48 bg-[#1c1c1c] border border-[#2a2a2a] rounded-xl shadow-2xl py-1.5 z-50 animate-scale-in`}
        >
          <p className="px-3 pt-0.5 pb-1.5 mb-1 text-[10px] text-muted2 font-medium border-b border-white/[0.06]">
            {label}
          </p>
          {formats.map((fmt) => (
            <button
              key={fmt.id}
              role="menuitem"
              disabled={busy}
              onClick={() => run(fmt)}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-[#d4d4d4] hover:text-white hover:bg-white/[0.05] transition-colors text-left disabled:opacity-50"
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
