'use client'
// ════════════════════════════════════════════════════════════════════
// BackButton — the platform's two canonical exit gestures (v5.25)
//
// The user supplied two reference designs; both now live here so every
// page draws the exact same glyphs:
//
//   1. chevron  — bare chevron-left ("‹"), transparent hit area, grows
//                 brighter on hover. Used wherever the user moves BACK
//                 through a flow (detail pages, settings panes, export
//                 sub-views). Rendered at 24px, stroke-width 2.
//   2. circle   — soft filled circle with a bold X, 36px. Used wherever
//                 the gesture DISMISSES something (close a panel, close
//                 a menu card, abort a composer).
//
// Both are adapted to the HUSH dark palette: the reference's #4b5563 /
// #f3f4f6 grays map to the platform's #a3a3a3 muted / #1c1c1c fill with
// the standard hover lift to #fafafa / #262626.
//
// Rendered as <button> when `onClick` is given, as a next/link <Link>
// when `href` is given (real anchor semantics — middle-click, SEO),
// and both accept an optional text label as children.
// ════════════════════════════════════════════════════════════════════
import Link from 'next/link'

const CHEV_D = 'M15 19l-7-7 7-7' // exact path from the reference design
const X_D = 'M6 18L18 6M6 6l12 12'

function ChevronGlyph({ size = 24 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={CHEV_D} />
    </svg>
  )
}

function XGlyph({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <path d={X_D} />
    </svg>
  )
}

// ── shared class strings (HUSH adaptation of the two references) ──
const chevronCls =
  'inline-flex items-center justify-center bg-transparent border-none p-2 text-[#a3a3a3] hover:text-[#fafafa] active:scale-95 transition-all duration-200 cursor-pointer'

const circleCls =
  'inline-flex items-center justify-center shrink-0 w-9 h-9 border-none rounded-full bg-[#1c1c1c] text-[#a3a3a3] hover:bg-[#262626] hover:text-[#fafafa] active:scale-95 transition-all duration-200 cursor-pointer'

/**
 * @param {object} props
 * @param {'chevron'|'circle'} [props.variant]  default 'chevron'
 * @param {string}  [props.href]   renders a next/link instead of a button
 * @param {Function} [props.onClick]
 * @param {string}  [props.label]  aria-label (required when icon-only)
 * @param {string}  [props.className]
 * @param {number}  [props.glyph]  glyph px size override
 * @param {boolean} [props.disabled]
 * @param {React.ReactNode} [props.children] optional text beside the glyph
 */
export default function BackButton({
  variant = 'chevron',
  href,
  onClick,
  label,
  className = '',
  glyph,
  disabled,
  children,
  ...rest
}) {
  const isCircle = variant === 'circle'
  const cls = `${isCircle ? circleCls : chevronCls} ${className}`
  const glyphEl = isCircle ? <XGlyph size={glyph || 20} /> : <ChevronGlyph size={glyph || 24} />

  if (href) {
    return (
      <Link href={href} onClick={onClick} aria-label={label} className={cls} {...rest}>
        {glyphEl}
        {children}
      </Link>
    )
  }
  return (
    <button type="button" onClick={onClick} aria-label={label} className={cls} disabled={disabled} {...rest}>
      {glyphEl}
      {children}
    </button>
  )
}

export { ChevronGlyph, XGlyph, CHEV_D, X_D }
