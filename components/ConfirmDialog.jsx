'use client'

import { useEffect, useRef } from 'react'
import { IconClose } from '@/components/Icons'

// ── ConfirmDialog — "Are you sure you want to delete?" card ─────────
// v5.17 — every destructive action in the app routes through this card:
// community posts/replies, research history, dashboard saves/messages/
// goals, chat conversations. No more instant, irreducible deletes.
//
// Styled in the HUSH theme (dark card, #FF3366 confirm), keyboard-
// accessible: Escape cancels, focus lands on the cancel button first
// (destructive actions should never confirm on a stray Enter).
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  busy = false,
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null)
  const confirmRef = useRef(null)

  useEffect(() => {
    if (!open) return
    // Cancel takes focus first — a stray Enter must never delete.
    cancelRef.current?.focus?.()
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onCancel?.() }
      if (e.key === 'Tab') {
        // Simple focus trap between the two buttons
        const order = [cancelRef.current, confirmRef.current]
        const idx = order.indexOf(document.activeElement)
        e.preventDefault()
        const next = e.shiftKey
          ? order[(idx - 1 + order.length) % order.length]
          : order[(idx + 1) % order.length]
        next?.focus?.()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel?.() }}
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-[360px] bg-[#141414] border border-[#2a2a2a] rounded-2xl p-5 shadow-[0_24px_64px_rgba(0,0,0,0.6)] animate-scale-in"
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="w-9 h-9 rounded-full bg-[#FF3366]/12 border border-[#FF3366]/25 flex items-center justify-center shrink-0" aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FF3366" strokeWidth="2" strokeLinecap="round">
              <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6M14 11v6" />
            </svg>
          </div>
          <button
            onClick={onCancel}
            className="text-[#525252] hover:text-white transition-colors p-1 -m-1"
            aria-label="Close"
            tabIndex={-1}
          >
            <IconClose size={16} />
          </button>
        </div>
        <h3 className="text-body text-white font-semibold leading-snug mb-1.5">{title}</h3>
        {message && <p className="text-caption text-muted leading-relaxed mb-4">{message}</p>}
        <div className={!message ? 'mt-4' : ''}>
          <div className="flex gap-2.5">
            <button
              ref={cancelRef}
              onClick={onCancel}
              disabled={busy}
              className="flex-1 h-10 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] text-caption text-white font-medium hover:border-[#404040] transition-colors disabled:opacity-50"
            >
              {cancelLabel || 'Cancel'}
            </button>
            <button
              ref={confirmRef}
              onClick={onConfirm}
              disabled={busy}
              className="flex-1 h-10 rounded-xl bg-[#FF3366] text-caption text-white font-semibold hover:bg-[#e62e5c] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {busy && (
                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" aria-hidden="true" />
              )}
              {confirmLabel || 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
