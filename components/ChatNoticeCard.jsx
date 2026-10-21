'use client'

import Link from 'next/link'

// ── Chat Notice Card ───────────────────────────────────────────
// In-chat notification card that mirrors the ComingSoonPopup design
// language: dark neutral surface (#111 / #262626 border, rounded-2xl),
// centered tinted icon badge, bold title, muted body and a full-width
// action button. Used for upgrade nudges, quota / daily-limit notices
// and error messages inside the AI chat stream.
//
// v5.15 — the `error` tone got a bold dedicated treatment: deep red
// gradient surface, glowing #FF3366 frame, oversized icon badge and a
// solid accent action button, so a failure reads as a deliberate,
// premium state — not a washed-out afterthought.

const ICON_PATHS = {
  bolt: (
    <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </>
  ),
  hourglass: (
    <>
      <path d="M5 22h14M5 2h14" />
      <path d="M17 22v-4.17a2 2 0 0 0-.59-1.42L12 12l-4.41 4.41A2 2 0 0 0 7 17.83V22" />
      <path d="M7 2v4.17a2 2 0 0 0 .59 1.42L12 12l4.41-4.41A2 2 0 0 0 17 6.17V2" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  warning: (
    <>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </>
  ),
}

const TONES = {
  upgrade: { badge: 'bg-red-950/30 border-red-900/30', color: '#ef4444' },
  quota: { badge: 'bg-amber-950/30 border-amber-900/30', color: '#f59e0b' },
  error: { badge: 'bg-[#FF3366]/15 border-[#FF3366]/40', color: '#FF3366' },
}

export default function ChatNoticeCard({
  tone = 'error',
  icon = 'warning',
  title,
  body,
  actionLabel,
  actionHref,
  onAction,
}) {
  const t = TONES[tone] || TONES.error
  const glyph = ICON_PATHS[icon] || ICON_PATHS.warning
  const isError = tone === 'error'
  return (
    <div
      className={
        isError
          ? // Bold error surface — deep red gradient + glowing accent frame
            'relative overflow-hidden rounded-2xl border border-[#FF3366]/45 bg-gradient-to-b from-[#340d18] via-[#1d070d] to-[#12040a] px-6 py-7 max-w-sm text-center shadow-[0_0_40px_-8px_rgba(255,51,102,0.45)]'
          : 'bg-[#111] border border-[#262626] rounded-2xl px-6 py-6 max-w-sm text-center shadow-2xl'
      }
      data-chat-notice={tone}
    >
      {/* Error tone: top accent hairline + corner aura */}
      {isError && (
        <>
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[#FF3366] to-transparent" />
          <div className="pointer-events-none absolute -top-16 left-1/2 h-32 w-56 -translate-x-1/2 rounded-full bg-[#FF3366]/25 blur-3xl" />
        </>
      )}
      <div className={`w-14 h-14 border rounded-2xl flex items-center justify-center mx-auto mb-4 ${t.badge} ${isError ? 'shadow-[0_0_24px_-4px_rgba(255,51,102,0.6)]' : ''}`}>
        <svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          stroke={t.color}
          strokeWidth={isError ? '2.4' : '2'}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {glyph}
        </svg>
      </div>
      <h3 className={`text-white mb-2 ${isError ? 'text-[17px] font-extrabold tracking-tight' : 'text-[15px] font-bold'}`}>{title}</h3>
      {body && <p className={`text-[13px] leading-relaxed mb-4 break-words ${isError ? 'text-[#f4c9d3] font-medium' : 'text-[#a3a3a3]'}`}>{body}</p>}
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className={
            isError
              ? 'block w-full py-3 bg-[#FF3366] hover:bg-[#ff1f57] text-white rounded-xl text-sm font-bold tracking-wide transition-colors shadow-[0_4px_20px_-4px_rgba(255,51,102,0.55)]'
              : 'block w-full py-2.5 bg-[#1a1a1a] border border-[#262626] hover:border-[#3a3a3a] text-white rounded-xl text-sm font-medium transition-colors'
          }
        >
          {actionLabel}
        </Link>
      )}
      {actionLabel && !actionHref && onAction && (
        <button
          onClick={onAction}
          className={
            isError
              ? 'w-full py-3 bg-[#FF3366] hover:bg-[#ff1f57] text-white rounded-xl text-sm font-bold tracking-wide transition-colors shadow-[0_4px_20px_-4px_rgba(255,51,102,0.55)] active:scale-[0.98]'
              : 'w-full py-2.5 bg-[#1a1a1a] border border-[#262626] hover:border-[#3a3a3a] text-white rounded-xl text-sm font-medium transition-colors'
          }
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
