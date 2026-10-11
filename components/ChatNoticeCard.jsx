'use client'

import Link from 'next/link'

// ── Chat Notice Card ───────────────────────────────────────────
// In-chat notification card that mirrors the ComingSoonPopup design
// language: dark neutral surface (#111 / #262626 border, rounded-2xl),
// centered tinted icon badge, bold title, muted body and a full-width
// action button. Used for upgrade nudges, quota / daily-limit notices
// and error messages inside the AI chat stream.

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
  error: { badge: 'bg-red-950/30 border-red-900/30', color: '#ef4444' },
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
  return (
    <div className="bg-[#111] border border-[#262626] rounded-2xl px-6 py-6 max-w-sm text-center shadow-2xl" data-chat-notice={tone}>
      <div className={`w-12 h-12 border rounded-xl flex items-center justify-center mx-auto mb-4 ${t.badge}`}>
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke={t.color}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {glyph}
        </svg>
      </div>
      <h3 className="text-[15px] font-bold text-white mb-2">{title}</h3>
      {body && <p className="text-[13px] text-[#a3a3a3] leading-relaxed mb-4 break-words">{body}</p>}
      {actionLabel && actionHref && (
        <Link
          href={actionHref}
          className="block w-full py-2.5 bg-[#1a1a1a] border border-[#262626] hover:border-[#3a3a3a] text-white rounded-xl text-sm font-medium transition-colors"
        >
          {actionLabel}
        </Link>
      )}
      {actionLabel && !actionHref && onAction && (
        <button
          onClick={onAction}
          className="w-full py-2.5 bg-[#1a1a1a] border border-[#262626] hover:border-[#3a3a3a] text-white rounded-xl text-sm font-medium transition-colors"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}
