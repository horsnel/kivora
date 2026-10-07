'use client'
import { useEffect, useMemo, useState, useId } from 'react'

// ── UsageTimerButton — execute button with a built-in SVG countdown ──
//
// Three states:
//   normal     → [ ▶ Run Code Explainer ]              (red CTA)
//   loading    → [ ◌ Running… ]                        (disabled CTA)
//   exhausted  → [ ◔ 04:23:11  Daily limit reached ]   (SVG countdown timer)
//                 Need more? Upgrade to Pro →          (link underneath)
//
// The countdown ticks to the next 00:00 UTC reset. The SVG ring fills up
// as the reset approaches (progress = elapsed share of the 24h window),
// giving an at-a-glance feel of "how long is left". When the countdown
// crosses zero, onResetComplete fires so the parent can re-enable.

const DAY_MS = 24 * 60 * 60 * 1000

function splitTime(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return {
    h: String(Math.floor(s / 3600)).padStart(2, '0'),
    m: String(Math.floor((s % 3600) / 60)).padStart(2, '0'),
    sec: String(s % 60).padStart(2, '0'),
  }
}

export default function UsageTimerButton({
  exhausted = false,
  resetAt = null,
  loading = false,
  disabled = false,
  onClick,
  label,
  loadingLabel,
  limitReachedLabel,
  resetsAtLabel,
  upgradeLabel,
  upgradeUrl = '/pricing',
  onResetComplete,
}) {
  const gradientId = useId()
  const [now, setNow] = useState(null) // null until mounted — no SSR/client mismatch
  const [firedReset, setFiredReset] = useState(false)

  useEffect(() => {
    if (!exhausted || !resetAt) { setNow(null); setFiredReset(false); return }
    setNow(Date.now())
    const iv = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(iv)
  }, [exhausted, resetAt])

  const remainingMs = useMemo(() => {
    if (!resetAt || now === null) return null
    return new Date(resetAt).getTime() - now
  }, [resetAt, now])

  // Countdown crossed zero — tell the parent once so it can refetch usage.
  useEffect(() => {
    if (remainingMs !== null && remainingMs <= 0 && !firedReset) {
      setFiredReset(true)
      onResetComplete?.()
    }
  }, [remainingMs, firedReset, onResetComplete])

  // ── Ring geometry ────────────────────────────────────────────────
  const R = 15.5
  const C = 2 * Math.PI * R
  const progress = useMemo(() => {
    if (remainingMs === null) return 0
    const p = 1 - remainingMs / DAY_MS
    return Math.min(1, Math.max(0, p))
  }, [remainingMs])

  const time = splitTime(remainingMs ?? 0)

  // ── Normal / loading state — the regular execute CTA ─────────────
  if (!exhausted) {
    return (
      <button
        onClick={onClick}
        disabled={loading || disabled}
        className="mt-5 w-full bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white py-3 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2 press"
      >
        {loading ? (
          <><IconSpinnerInline /> {loadingLabel}</>
        ) : label}
      </button>
    )
  }

  // ── Exhausted state — the countdown timer ─────────────────────────
  return (
    <div className="mt-5">
      <div
        aria-live="polite"
        aria-label={`${limitReachedLabel} — ${time.h}:${time.m}:${time.sec}`}
        className="w-full relative overflow-hidden bg-gradient-to-r from-[#1d1406] via-[#231705] to-[#1d1406] border border-amber-500/30 py-3 rounded-xl flex items-center justify-center gap-3.5 select-none"
      >
        {/* soft animated sheen */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.35] animate-pulse bg-[radial-gradient(120px_40px_at_20%_120%,rgba(245,158,11,0.18),transparent)]" />

        {/* SVG countdown ring */}
        <span className="relative inline-flex shrink-0" style={{ width: 40, height: 40 }}>
          <svg viewBox="0 0 36 36" width="40" height="40" className="-rotate-90">
            <defs>
              <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#f97316" />
              </linearGradient>
            </defs>
            {/* track */}
            <circle cx="18" cy="18" r={R} fill="none" stroke="rgba(245,158,11,0.14)" strokeWidth="2.4" />
            {/* progress — fills as the reset approaches */}
            <circle
              cx="18" cy="18" r={R}
              fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - progress)}
              style={{ transition: 'stroke-dashoffset 0.9s linear', filter: 'drop-shadow(0 0 3px rgba(251,191,36,0.45))' }}
            />
          </svg>
          {/* tiny clock hands inside the ring */}
          <span className="absolute inset-0 flex items-center justify-center">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="9" strokeOpacity="0.35" />
              <path d="M12 7v5l3.2 1.9" />
            </svg>
          </span>
        </span>

        {/* countdown text */}
        <span className="flex flex-col items-start leading-none min-w-0">
          <span className="font-mono text-xl font-semibold text-amber-300 tabular-nums tracking-[0.08em] drop-shadow-[0_0_8px_rgba(251,191,36,0.25)]">
            {remainingMs === null ? '--:--:--' : `${time.h}:${time.m}:${time.sec}`}
          </span>
          <span className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-500/80 whitespace-nowrap">
            {limitReachedLabel}
          </span>
        </span>

        {/* resets caption */}
        <span className="ml-1 hidden sm:flex flex-col items-end leading-tight shrink-0">
          <span className="text-[9px] uppercase tracking-[0.12em] text-amber-200/40">{resetsAtLabel}</span>
          <span className="text-[10px] font-medium text-amber-300/70 font-mono mt-0.5">00:00 UTC</span>
        </span>
      </div>

      {/* upgrade path out of the limit */}
      <a
        href={upgradeUrl}
        className="mt-2 flex items-center justify-center gap-1 text-[11px] text-muted hover:text-amber-400 transition-colors"
      >
        {upgradeLabel}
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
      </a>
    </div>
  )
}

// Minimal inline spinner so the component has zero icon dependencies
function IconSpinnerInline() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}
