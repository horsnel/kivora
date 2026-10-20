'use client'

/**
 * FeedbackToast — HUSH-style action feedback, mounted once in the root layout.
 *
 * Two visual variants, both lifted from the HUSH design cards
 * (#FF3366 accent, glassy dark surfaces, spring slide animations):
 *
 *  - variant 'toast' — top-center pill (HUSH confirmation toast).
 *    Used for Copy confirmations: small, fast, non-blocking.
 *  - variant 'card'  — bottom slide-up notification card (HUSH notif card)
 *    with an accent progress bar that drains over its lifetime.
 *    Used for Export completions / failures: richer, dismissible.
 *
 * Any component can fire feedback without prop drilling:
 *
 *   import { showFeedback } from '@/components/FeedbackToast'
 *   showFeedback({ variant: 'toast', message: 'Copied to clipboard' })
 *   showFeedback({ variant: 'card', tone: 'error', title: 'Export failed', message: '…' })
 *
 * Animations live in globals.css (hush-toast-*, hush-card-*) so the
 * hash-based CSP on prerendered pages keeps working (no runtime styles).
 */

import { useEffect, useRef, useState } from 'react'
import { IconCheck, IconCopy, IconDownloadReport, IconWarning } from '@/components/Icons'

export const FEEDBACK_EVENT = 'kivora:feedback'

/**
 * Fire a feedback card/toast from anywhere.
 * @param {object} opts
 * @param {'toast'|'card'} [opts.variant='toast']  visual style
 * @param {'accent'|'success'|'error'} [opts.tone='accent'] color treatment
 * @param {string} [opts.title]    card headline (card variant)
 * @param {string}  opts.message   pill text / card body line
 * @param {number} [opts.duration] ms before auto-dismiss (toast 2200, card 3600)
 */
export function showFeedback(opts = {}) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(FEEDBACK_EVENT, { detail: { ...opts } }))
}

const MAX_CARDS = 3

export default function FeedbackToast() {
  const [toast, setToast] = useState(null)      // { message, tone, leaving }
  const [cards, setCards] = useState([])        // [{ id, title, message, tone, leaving }]
  const timers = useRef([])

  useEffect(() => {
    const track = (t) => timers.current.push(t)

    const onEvent = (e) => {
      const o = e.detail || {}
      const tone = o.tone || 'accent'
      const variant = o.variant || 'toast'

      if (variant === 'toast') {
        setToast({ message: o.message || '', tone, leaving: false })
        track(setTimeout(() => setToast((cur) => (cur ? { ...cur, leaving: true } : cur)), o.duration || 2200))
        track(setTimeout(() => setToast(null), (o.duration || 2200) + 300))
        return
      }

      // card variant — cap the stack, newest on top (flex-col-reverse)
      const id = `fb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
      const duration = o.duration || 3600
      setCards((cur) => {
        const next = [{ id, title: o.title || '', message: o.message || '', tone, leaving: false, duration }, ...cur]
        return next.slice(0, MAX_CARDS)
      })
      track(setTimeout(() => leaveCard(id), duration))
    }

    const leaveCard = (id) => {
      setCards((cur) => cur.map((c) => (c.id === id ? { ...c, leaving: true } : c)))
      track(setTimeout(() => setCards((cur) => cur.filter((c) => c.id !== id)), 380))
    }

    window.addEventListener(FEEDBACK_EVENT, onEvent)
    return () => {
      window.removeEventListener(FEEDBACK_EVENT, onEvent)
      timers.current.forEach(clearTimeout)
      timers.current = []
    }
  }, [])

  const dismissCard = (id) => {
    setCards((cur) => cur.map((c) => (c.id === id ? { ...c, leaving: true } : c)))
    setTimeout(() => setCards((cur) => cur.filter((c) => c.id !== id)), 380)
  }

  return (
    <>
      {/* ── Top-center pill toast (copy confirmations) ── */}
      {toast && (
        <div
          key={toast.message + String(toast.leaving)}
          role="status"
          aria-live="polite"
          className={`hush-toast fixed top-4 left-1/2 z-[90] flex items-center gap-2 px-5 py-3 rounded-full border shadow-2xl pointer-events-none ${
            toast.tone === 'error'
              ? 'bg-[#1a1a1a] border-red-500/40'
              : 'bg-[#1a1a1a] border-[#2a2a2a]'
          } ${toast.leaving ? 'hush-toast-out' : 'hush-toast-in'}`}
        >
          <span className={`hush-toast-icon flex items-center justify-center w-5 h-5 rounded-full shrink-0 ${
            toast.tone === 'error'
              ? 'bg-red-500/15 text-red-400'
              : 'bg-gradient-to-br from-[#FF3366] to-[#FF6B6B] text-white'
          }`}>
            {toast.tone === 'error' ? <IconWarning size={11} /> : <IconCheck size={11} />}
          </span>
          <span className="font-medium text-sm text-white whitespace-nowrap">{toast.message}</span>
        </div>
      )}

      {/* ── Bottom slide-up notification cards (export feedback) ── */}
      <div
        className="fixed bottom-6 left-0 right-0 z-[90] flex flex-col-reverse items-center gap-3 px-4 pointer-events-none"
        role="region"
        aria-label="Action feedback"
        aria-live="polite"
      >
        {cards.map((c) => (
          <div
            key={c.id}
            role="button"
            tabIndex={0}
            aria-label={`${c.title}: ${c.message}`}
            onClick={() => dismissCard(c.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') dismissCard(c.id) }}
            className={`hush-card pointer-events-auto w-full max-w-sm relative overflow-hidden cursor-pointer rounded-2xl border bg-[#1a1a1a] shadow-2xl ${
              c.tone === 'error' ? 'border-red-500/40' : 'border-[#2a2a2a]'
            } ${c.leaving ? 'hush-card-out' : 'hush-card-in'}`}
          >
            <div className="flex items-start gap-3 p-4">
              {/* Icon bubble with accent gradient ring */}
              <span className={`flex items-center justify-center w-10 h-10 rounded-xl shrink-0 ${
                c.tone === 'error'
                  ? 'bg-red-500/15 text-red-400'
                  : 'bg-gradient-to-br from-[#FF3366] to-[#FF6B6B] text-white shadow-lg shadow-[#FF3366]/25'
              }`}>
                {c.tone === 'error'
                  ? <IconWarning size={16} />
                  : c.tone === 'copy'
                  ? <IconCopy size={16} />
                  : <IconDownloadReport size={16} />}
              </span>

              {/* Body */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white leading-snug">{c.title}</p>
                {c.message && <p className="text-xs text-[#a3a3a3] mt-0.5 leading-relaxed break-words">{c.message}</p>}
              </div>

              {/* Dismiss X */}
              <button
                onClick={(e) => { e.stopPropagation(); dismissCard(c.id) }}
                className="w-6 h-6 -mr-1 -mt-1 rounded-full flex items-center justify-center text-[#525252] hover:text-[#FF3366] hover:bg-[#FF3366]/10 transition-colors shrink-0"
                aria-label="Dismiss"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Auto-dismiss progress bar (drains over lifetime) */}
            <div className="h-0.5 w-full bg-[#262626]">
              <div
                className={`h-full hush-card-progress ${
                  c.tone === 'error'
                    ? 'bg-gradient-to-r from-red-500 to-red-400'
                    : 'bg-gradient-to-r from-[#FF3366] to-[#FF6B6B]'
                }`}
                style={{ animationDuration: `${c.duration}ms` }}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
