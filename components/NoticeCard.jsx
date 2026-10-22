'use client'

import { useEffect, useRef } from 'react'
import { IconClose } from '@/components/Icons'

// ── NoticeCard — the ConfirmDialog design, generalized ──────────────
// v5.18 — users loved the "Are you sure you want to delete?" card so much
// it became the app's notice language: this component reproduces that
// exact visual DNA (same overlay, same card shell, same icon circle,
// same typography, same button treatment) for non-destructive messages —
// out-of-credits gates, rate limits, engine capacity, network errors.
//
// Nothing about ConfirmDialog changed — its 8 wired delete points stay
// untouched. This is a visual sibling, not a refactor.
//
// Keyboard: Escape closes, focus lands on the action button, Tab is
// trapped between the (up to two) buttons.
export default function NoticeCard({
  open,
  icon,            // optional custom icon node inside the accent circle
  title,
  message,
  actionLabel,     // primary button (accent filled)
  secondaryLabel,  // optional secondary button (dark outline)
  onAction,
  onSecondary,
  onClose,
  busy = false,
}) {
  const actionRef = useRef(null)
  const secondaryRef = useRef(null)

  useEffect(() => {
    if (!open) return
    actionRef.current?.focus?.()
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose?.() }
      if (e.key === 'Tab') {
        const order = secondaryLabel ? [actionRef.current, secondaryRef.current] : [actionRef.current]
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
  }, [open, onClose, secondaryLabel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-[360px] bg-[#141414] border border-[#2a2a2a] rounded-2xl p-5 shadow-[0_24px_64px_rgba(0,0,0,0.6)] animate-scale-in"
      >
        <div className="flex items-start justify-between gap-3 mb-2">
          <div
            className="w-9 h-9 rounded-full bg-[#FF3366]/12 border border-[#FF3366]/25 flex items-center justify-center shrink-0 text-[#FF3366]"
            aria-hidden="true"
          >
            {icon || (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 9v4M12 17h.01" />
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
              </svg>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-[#525252] hover:text-white transition-colors p-1 -m-1"
            aria-label="Close"
            tabIndex={-1}
          >
            <IconClose size={16} />
          </button>
        </div>
        <h3 className="text-body text-white font-semibold leading-snug mb-1.5">{title}</h3>
        {message && <p className="text-caption text-muted leading-relaxed mb-4 break-words">{message}</p>}
        <div className={!message ? 'mt-4' : ''}>
          <div className="flex gap-2.5">
            {secondaryLabel && (
              <button
                ref={secondaryRef}
                onClick={onSecondary}
                disabled={busy}
                className="flex-1 h-10 rounded-xl border border-[#2a2a2a] bg-[#1a1a1a] text-caption text-white font-medium hover:border-[#404040] transition-colors disabled:opacity-50"
              >
                {secondaryLabel}
              </button>
            )}
            <button
              ref={actionRef}
              onClick={onAction}
              disabled={busy}
              className="flex-1 h-10 rounded-xl bg-[#FF3366] text-caption text-white font-semibold hover:bg-[#e62e5c] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {busy && (
                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" aria-hidden="true" />
              )}
              {actionLabel || 'OK'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
