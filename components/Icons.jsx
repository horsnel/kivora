// components/Icons.jsx
// All SVG icons used across Kivora — clean, consistent, 20x20 default

export function IconMoney({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="1" y="3" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.25"/>
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M4 8h.5M11.5 8H12" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  )
}

export function IconRobot({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="3" y="6" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M6 9.5h.5M9.5 9.5H10" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <path d="M8 6V4M6 4h4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <circle cx="8" cy="3.5" r=".75" fill="currentColor"/>
      <path d="M1 10v-1M15 10v-1" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  )
}

export function IconVideo({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="1" y="3.5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M10 6.5l4-2v7l-4-2V6.5z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
    </svg>
  )
}

export function IconShop({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M2 3h12l-1.5 5H3.5L2 3z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      <path d="M3.5 8v4a1 1 0 001 1h7a1 1 0 001-1V8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <path d="M6 11v-2M8 11V9M10 11V9" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  )
}

export function IconWrite({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M9.5 2.5l4 4-7 7H2.5v-4l7-7z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      <path d="M7.5 4.5l4 4" stroke="currentColor" strokeWidth="1.25"/>
    </svg>
  )
}

export function IconCode({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M5 5L2 8l3 3M11 5l3 3-3 3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M9.5 3.5l-3 9" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  )
}

export function IconChat({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M2 3a1 1 0 011-1h10a1 1 0 011 1v7a1 1 0 01-1 1H9l-3 3v-3H3a1 1 0 01-1-1V3z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      <path d="M5 6h6M5 8.5h3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  )
}

export function IconSearch({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M10.5 10.5l3 3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  )
}

export function IconTrending({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M1.5 11.5l4-4 3 3 5-6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M10.5 4.5H14v3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function IconFlame({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 14c3 0 5-2 5-5 0-2-1.5-3.5-2-4.5C10.5 6 9.5 6.5 9 7c0-2-1-3.5-2.5-5C6 4.5 4 6.5 4 9c0 2.5 1.5 5 4 5z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      <path d="M8 14c1.5 0 2.5-1 2.5-2.5S9 9.5 8 9c-.5 1-.5 1.5-.5 2.5S7 14 8 14z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
    </svg>
  )
}

export function IconLightning({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M9 2L4 9h4l-1 5 6-7H9l1-5z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
    </svg>
  )
}

export function IconClock({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M8 5v3.5l2 1.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function IconTool({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M10.5 2a3 3 0 00-3 3c0 .4.08.8.2 1.1L2.5 11.3a1.2 1.2 0 000 1.7l.5.5c.5.5 1.2.5 1.7 0l5.2-5.2c.3.12.7.2 1.1.2a3 3 0 000-6l-1.5 1.5L8 5l1-1.5z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
    </svg>
  )
}

export function IconGlobe({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M8 2c-2 2-2 4 0 6s2 4 0 6M2 8h12" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M3.5 5h9M3.5 11h9" stroke="currentColor" strokeWidth="1" strokeDasharray="1 1"/>
    </svg>
  )
}

export function IconCheck({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function IconClose({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export function IconArrowRight({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function IconArrowLeft({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M13 8H3M7 4L3 8l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function IconChevronDown({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function IconMenu({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M2 4h12M2 8h12M2 12h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export function IconCopy({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="6" y="6" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M10 6V4a1 1 0 00-1-1H3a1 1 0 00-1 1v6a1 1 0 001 1h2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  )
}

export function IconShare({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="12.5" cy="3.5" r="1.5" stroke="currentColor" strokeWidth="1.25"/>
      <circle cx="12.5" cy="12.5" r="1.5" stroke="currentColor" strokeWidth="1.25"/>
      <circle cx="3.5" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M5 7L11 4M5 9l6 3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  )
}

export function IconBookmark({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M3 2h10v13l-5-3-5 3V2z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
    </svg>
  )
}

export function IconBookmarkFill({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M3 2h10v13l-5-3-5 3V2z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" fill="currentColor"/>
    </svg>
  )
}

export function IconSend({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M14 8L2 2l3 6-3 6 12-6z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      <path d="M5 8h4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  )
}

export function IconSpinner({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={`animate-spin ${className}`}>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.2"/>
      <path d="M14 8a6 6 0 00-6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export function IconStar({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 1.5l1.8 3.6 4 .6-2.9 2.8.7 4L8 10.4l-3.6 1.9.7-4L2.2 5.7l4-.6L8 1.5z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
    </svg>
  )
}

export function IconWarning({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 2L1.5 13h13L8 2z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      <path d="M8 7v3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <circle cx="8" cy="11.5" r=".5" fill="currentColor"/>
    </svg>
  )
}

export function IconVpn({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 2a6 6 0 100 12A6 6 0 008 2z" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M8 2c-1.5 1.5-2 3-2 6s.5 4.5 2 6" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M8 2c1.5 1.5 2 3 2 6s-.5 4.5-2 6" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M2.5 6h11M2.5 10h11" stroke="currentColor" strokeWidth="1.1"/>
    </svg>
  )
}

export function IconCard({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M1.5 7h13" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M4 10.5h2M9 10.5h3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  )
}

export function IconUser({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="5.5" r="2.5" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M2.5 14c0-3 2.5-5 5.5-5s5.5 2 5.5 5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  )
}

export function IconDashboard({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.25"/>
      <rect x="9" y="1.5" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.25"/>
      <rect x="1.5" y="9" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.25"/>
      <rect x="9" y="9" width="5.5" height="5.5" rx="1" stroke="currentColor" strokeWidth="1.25"/>
    </svg>
  )
}

export function IconBulb({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 2a4 4 0 014 4c0 1.5-.8 2.8-2 3.5V11H6V9.5C4.8 8.8 4 7.5 4 6a4 4 0 014-4z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      <path d="M6 13h4M6.5 11.5h3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  )
}

export function IconBook({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M3 2h8a1 1 0 011 1v10a1 1 0 01-1 1H3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <path d="M3 2a1 1 0 00-1 1v10a1 1 0 001 1" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M3 2v12" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M6 6h4M6 9h3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  )
}

export function IconMicroscope({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M7 3l2 4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <path d="M5 2l4 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M3 14h10" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <path d="M8 10v4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <circle cx="9" cy="5" r="3" stroke="currentColor" strokeWidth="1.25"/>
    </svg>
  )
}

export function IconQuote({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M3 4.5C3 3.7 3.7 3 4.5 3S6 3.7 6 4.5c0 1.5-2 2.5-3 5h3M9 4.5C9 3.7 9.7 3 10.5 3S12 3.7 12 4.5c0 1.5-2 2.5-3 5h3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function IconFilter({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M2 4h12M4 8h8M6 12h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export function IconDatabase({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <ellipse cx="8" cy="4.5" rx="5" ry="2" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M3 4.5v3c0 1.1 2.2 2 5 2s5-.9 5-2v-3" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M3 7.5v3c0 1.1 2.2 2 5 2s5-.9 5-2v-3" stroke="currentColor" strokeWidth="1.25"/>
    </svg>
  )
}

export function IconExternal({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M7 3H3a1 1 0 00-1 1v9a1 1 0 001 1h9a1 1 0 001-1V9" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <path d="M10 2h4v4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14 2L8 8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  )
}

export function IconEye({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z" stroke="currentColor" strokeWidth="1.25"/>
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.25"/>
    </svg>
  )
}

export function IconLogout({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M10 5l3 3-3 3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M13 8H6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <path d="M7 3H3a1 1 0 00-1 1v8a1 1 0 001 1h4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  )
}

export function IconPlus({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export function IconTrash({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M2.5 4.5h11M6 4.5V3h4v1.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <path d="M4 4.5l.7 8a1 1 0 001 .9h4.6a1 1 0 001-.9l.7-8" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  )
}

export function IconPulse({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M1.5 8h3l2-5 3 10 2-5h3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function IconTarget({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.25"/>
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.25"/>
      <circle cx="8" cy="8" r=".75" fill="currentColor"/>
    </svg>
  )
}

export function IconStack({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M2 5.5l6-3 6 3-6 3-6-3z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      <path d="M2 8.5l6 3 6-3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2 11.5l6 3 6-3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function IconHome({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M3 8l5-5 5 5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M4 7v5.5a.5.5 0 00.5.5H7V10h2v3h2.5a.5.5 0 00.5-.5V7" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function IconPaperclip({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M12.5 7.5l-5 5a3 3 0 01-4.24-4.24l5-5a2 2 0 012.83 2.83l-5 5a1 1 0 01-1.42-1.42l4.6-4.58" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function IconDownload({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 2v8M4.5 7L8 10.5 11.5 7" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2 12v1.5a1 1 0 001 1h10a1 1 0 001-1V12" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  )
}

export function IconLock({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M5.5 7V5a2.5 2.5 0 015 0v2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <circle cx="8" cy="10" r=".75" fill="currentColor"/>
    </svg>
  )
}

export function IconFile({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M4 2h5l4 4v7a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      <path d="M9 2v4h4" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
    </svg>
  )
}

export function IconMail({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="1.5" y="3" width="13" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M1.5 5l6.5 4L14.5 5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function IconMapPin({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 14s5-4.5 5-8A5 5 0 003 6c0 3.5 5 8 5 8z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      <circle cx="8" cy="6" r="2" stroke="currentColor" strokeWidth="1.25"/>
    </svg>
  )
}

export function IconMicrophone({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="6" y="1.5" width="4" height="7" rx="2" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M3.5 7A4.5 4.5 0 008 11.5 4.5 4.5 0 0012.5 7" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <path d="M8 11.5V14M5.5 14h5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  )
}

export function IconSpeaker({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M2.5 5.5H5l3.5-3v11L5 10.5H2.5a1 1 0 01-1-1v-3a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      <path d="M11 5.5a3.5 3.5 0 010 5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <path d="M12.5 3.5a6 6 0 010 9" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  )
}

export function IconSliders({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M2 4h3M7 4h7" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <circle cx="5.5" cy="4" r="1.5" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M2 8h7M11 8h3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <circle cx="9.5" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M2 12h5M9 12h5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <circle cx="7.5" cy="12" r="1.5" stroke="currentColor" strokeWidth="1.25"/>
    </svg>
  )
}

export function IconSettings({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  )
}

export function IconMaximize({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M2 6V3a1 1 0 011-1h3M10 2h3a1 1 0 011 1v3M14 10v3a1 1 0 01-1 1h-3M6 14H3a1 1 0 01-1-1v-3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function IconMinimize({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M2 10h4v4M14 6h-4V2M10 6l4-4M6 10l-4 4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function IconLink({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M6.5 9.5l3-3" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <path d="M8.5 11.5l-1 1a2.5 2.5 0 01-3.54-3.54l1-1" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <path d="M7.5 4.5l1-1a2.5 2.5 0 013.54 3.54l-1 1" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  )
}

export function IconImage({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.25"/>
      <circle cx="5" cy="6" r="1.25" stroke="currentColor" strokeWidth="1"/>
      <path d="M1.5 11l3.5-3 2.5 2 3-3 4 4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function IconBuild({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M2 14V7l3-3 3 3v7H2z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      <path d="M8 14V10l2.5-3 2.5 3v4H8z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      <path d="M4 10h1M11 12h1" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <path d="M3.5 7.5V6a1.5 1.5 0 013 0v1.5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
    </svg>
  )
}

export function IconFolder({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M1.5 4.5V12a1 1 0 001 1h11a1 1 0 001-1V5.5a1 1 0 00-1-1H8l-1.5-2H2.5a1 1 0 00-1 1v1z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      <path d="M1.5 7h13" stroke="currentColor" strokeWidth="1.25"/>
    </svg>
  )
}

export function IconPlay({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M4 2.5v11l9-5.5-9-5.5z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
    </svg>
  )
}

/* ── 3D Viewer Icons ── */

export function IconGrid({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="4" cy="4" r="1.5" fill="currentColor"/>
      <circle cx="8" cy="4" r="1.5" fill="currentColor"/>
      <circle cx="12" cy="4" r="1.5" fill="currentColor"/>
      <circle cx="4" cy="8" r="1.5" fill="currentColor"/>
      <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
      <circle cx="12" cy="8" r="1.5" fill="currentColor"/>
      <circle cx="4" cy="12" r="1.5" fill="currentColor"/>
      <circle cx="8" cy="12" r="1.5" fill="currentColor"/>
      <circle cx="12" cy="12" r="1.5" fill="currentColor"/>
    </svg>
  )
}

export function IconPlanet({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="7.5" cy="8" r="4.5" stroke="currentColor" strokeWidth="1.25"/>
      <ellipse cx="7.5" cy="8" rx="6.5" ry="2.5" stroke="currentColor" strokeWidth="1.25" transform="rotate(-25 7.5 8)"/>
    </svg>
  )
}

export function IconNebula({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 1l.5 1.5L10 3l-1.5.5L8 5l-.5-1.5L6 3l1.5-.5L8 1z" fill="currentColor"/>
      <path d="M3 5l.3 1L4.5 6.5l-1.2.5L3 8l-.3-1L1.5 6.5l1.2-.5L3 5z" fill="currentColor"/>
      <path d="M13 4l.4 1.2L14.5 6l-1.1.4L13 7.5l-.4-1.1L11.5 6l1.1-.4L13 4z" fill="currentColor"/>
      <path d="M4.5 9l.3 1L6 11l-1.2.5L4.5 12l-.3-1L3 10.5l1.2-.5L4.5 9z" fill="currentColor"/>
      <path d="M11.5 10l.4 1.1L13 12l-1.1.4L11.5 14l-.4-1.1L10 12l1.1-.4L11.5 10z" fill="currentColor"/>
      <circle cx="8" cy="8" r="1.5" stroke="currentColor" strokeWidth="1.25"/>
    </svg>
  )
}

export function IconNature({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M3 14l3-5h-2l4-6h-2l5-3-2 5h2L7 12h2l-6 2z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
    </svg>
  )
}

export function IconBuildings({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M3 14V3l5-1v3" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      <path d="M8 14V5l5 1v8" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      <path d="M1 14h14" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <path d="M5 6h1M5 8.5h1M5 11h1" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
      <path d="M10.5 7.5h1M10.5 10h1M10.5 12.5h1" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
    </svg>
  )
}

export function IconMoon({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M13.5 9A6 6 0 017 2.5 6 6 0 108 13.5a6 6 0 005.5-4.5z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      <circle cx="11" cy="5.5" r=".75" fill="currentColor"/>
      <circle cx="10" cy="9" r=".5" fill="currentColor"/>
    </svg>
  )
}

export function IconEarth({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M2.5 9.5c1.5-.5 3 0 4 1s2.5 1 4 .5 2.5-1 3.5-.5" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M5 2.5c.5 1.5 1 3 .5 4.5s.5 3 2 4" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M11 3c-.5 1-1.5 2.5-1 4s.5 3-.5 4.5" stroke="currentColor" strokeWidth="1.25"/>
    </svg>
  )
}

export function IconSun({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <circle cx="8" cy="8" r="1" fill="currentColor"/>
    </svg>
  )
}

export function IconTelescope({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M2 9l9-5 2 3.5-9 5L2 9z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      <path d="M11 4l1.5 2.5" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <path d="M5 12L3.5 14M8 10.5L9.5 14" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <circle cx="12.5" cy="3.5" r="1.5" stroke="currentColor" strokeWidth="1"/>
    </svg>
  )
}

export function IconWaves({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M1.5 5c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <path d="M1.5 8.5c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <path d="M1.5 12c1.5-1.5 3-1.5 4.5 0s3 1.5 4.5 0 3-1.5 4.5 0" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  )
}

export function IconMountain({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M1 14l4.5-8 3 4 2-3L15 14H1z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      <path d="M5.5 6L7 3.5 8.5 6" stroke="currentColor" strokeWidth="1" strokeLinejoin="round" opacity="0.5"/>
      <circle cx="11.5" cy="4" r="1.5" stroke="currentColor" strokeWidth="1"/>
    </svg>
  )
}

export function IconMuseum({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M2 14h12" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <path d="M3 14V6l5-4 5 4v8" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      <path d="M2 6h12" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M5.5 14V9M8 14V9M10.5 14V9" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
      <circle cx="8" cy="3" r=".75" fill="currentColor"/>
    </svg>
  )
}

export function IconCube({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 1.5l5.5 3v7L8 14.5l-5.5-3v-7L8 1.5z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      <path d="M8 14.5V8M8 8L2.5 4.5M8 8l5.5-3.5" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
    </svg>
  )
}

export function IconMars({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.25"/>
      <circle cx="6" cy="6" r="1.5" stroke="currentColor" strokeWidth="0.75" opacity="0.5"/>
      <circle cx="10" cy="9" r="1" stroke="currentColor" strokeWidth="0.75" opacity="0.5"/>
      <path d="M5 10Q8 12 11 10" stroke="currentColor" strokeWidth="0.75" opacity="0.4"/>
    </svg>
  )
}

export function IconSaturn({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="4" stroke="currentColor" strokeWidth="1.25"/>
      <ellipse cx="8" cy="8" rx="7" ry="2" stroke="currentColor" strokeWidth="1" opacity="0.7"/>
    </svg>
  )
}

export function IconBlackHole({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="2.5" fill="currentColor" opacity="0.9"/>
      <circle cx="8" cy="8" r="4" stroke="currentColor" strokeWidth="0.75" opacity="0.6"/>
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="0.5" opacity="0.3"/>
      <path d="M3 6Q5 4 8 5Q11 6 13 4" stroke="currentColor" strokeWidth="0.75" opacity="0.5"/>
      <path d="M3 10Q5 12 8 11Q11 10 13 12" stroke="currentColor" strokeWidth="0.75" opacity="0.5"/>
    </svg>
  )
}

export function IconGalaxy({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="1.5" fill="currentColor" opacity="0.8"/>
      <path d="M8 6.5C6 5 4 6 3.5 8C3 10 5 12 7 11.5C9 11 11 12 12.5 10C14 8 12 5 10 5.5C9 5.8 8 6.5 8 6.5Z" stroke="currentColor" strokeWidth="0.75" opacity="0.6"/>
      <path d="M8 5C5.5 3 3 5 2.5 7.5C2 10 4.5 13 7 12C9.5 11 12 13 13.5 10.5C15 8 12 4 9.5 4.5" stroke="currentColor" strokeWidth="0.5" opacity="0.3"/>
    </svg>
  )
}

export function IconAsteroid({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="5" cy="5" r="1.2" stroke="currentColor" strokeWidth="0.75" opacity="0.7"/>
      <circle cx="11" cy="4" r="0.8" stroke="currentColor" strokeWidth="0.75" opacity="0.5"/>
      <circle cx="8" cy="8" r="1.5" stroke="currentColor" strokeWidth="0.75" opacity="0.8"/>
      <circle cx="4" cy="11" r="0.6" stroke="currentColor" strokeWidth="0.75" opacity="0.4"/>
      <circle cx="12" cy="10" r="1" stroke="currentColor" strokeWidth="0.75" opacity="0.6"/>
      <circle cx="9" cy="13" r="0.7" stroke="currentColor" strokeWidth="0.75" opacity="0.5"/>
    </svg>
  )
}

export function IconVolcano({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M3 14L6 6H10L13 14H3Z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      <path d="M7 6L7.5 3M8 6L8 2.5M9 6L8.5 3" stroke="currentColor" strokeWidth="0.75" strokeLinecap="round" opacity="0.7"/>
      <path d="M6.5 4Q8 3 9.5 4" stroke="currentColor" strokeWidth="0.5" opacity="0.4"/>
    </svg>
  )
}

export function IconForest({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M4 14L4 8L2 8L4.5 4L3.5 4L5 1L6.5 4L5.5 4L8 8L6 8L6 14H4Z" stroke="currentColor" strokeWidth="0.75" strokeLinejoin="round"/>
      <path d="M10 14L10 9L8.5 9L10.5 5.5L9.8 5.5L11 3L12.2 5.5L11.5 5.5L13.5 9L12 9L12 14H10Z" stroke="currentColor" strokeWidth="0.75" strokeLinejoin="round"/>
    </svg>
  )
}

export function IconCastle({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="2" y="7" width="4" height="7" stroke="currentColor" strokeWidth="1" rx="0.5"/>
      <rect x="10" y="7" width="4" height="7" stroke="currentColor" strokeWidth="1" rx="0.5"/>
      <rect x="5" y="5" width="6" height="9" stroke="currentColor" strokeWidth="1" rx="0.5"/>
      <path d="M3 7V5M4 7V5M12 7V5M13 7V5M6 5V3M7 5V3M8 5V3M9 5V3" stroke="currentColor" strokeWidth="0.75"/>
      <rect x="7" y="10" width="2" height="4" stroke="currentColor" strokeWidth="0.75" rx="0.3"/>
    </svg>
  )
}

export function IconCrystal({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 1L11 5L10 14H6L5 5L8 1Z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      <path d="M5 5H11" stroke="currentColor" strokeWidth="0.75"/>
      <path d="M6.5 5L6 14M9.5 5L10 14" stroke="currentColor" strokeWidth="0.5" opacity="0.4"/>
      <path d="M4 8L2 10L3 14L5.5 14M12 8L14 10L13 14L10.5 14" stroke="currentColor" strokeWidth="0.75" strokeLinejoin="round" opacity="0.6"/>
    </svg>
  )
}

export function IconJupiter({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M2.5 6.5h11M3 8.5h10M3.5 10.5h9" stroke="currentColor" strokeWidth="0.75" opacity="0.6"/>
      <ellipse cx="10" cy="7" rx="1.5" ry="1" stroke="currentColor" strokeWidth="0.75" opacity="0.5"/>
    </svg>
  )
}

export function IconVenus({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M3.5 7c1.5-1 3-.5 4.5 0s3 1 4.5 0" stroke="currentColor" strokeWidth="0.75" opacity="0.5"/>
      <path d="M4 9.5c1.5-.5 3 0 4.5.5s2.5 0 4-.5" stroke="currentColor" strokeWidth="0.75" opacity="0.4"/>
    </svg>
  )
}

export function IconMercury({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.25"/>
      <circle cx="6" cy="6" r="1" stroke="currentColor" strokeWidth="0.5" opacity="0.4"/>
      <circle cx="10" cy="9" r="0.7" stroke="currentColor" strokeWidth="0.5" opacity="0.3"/>
      <circle cx="7" cy="10.5" r="0.5" stroke="currentColor" strokeWidth="0.5" opacity="0.3"/>
    </svg>
  )
}

export function IconNeptune({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M3.5 7.5c2-1.5 4-1 5 0s3 1 4-.5" stroke="currentColor" strokeWidth="0.75" opacity="0.5"/>
      <path d="M4 9.5c1.5-1 3.5 0 5 0s2.5-1 3.5 0" stroke="currentColor" strokeWidth="0.75" opacity="0.4"/>
    </svg>
  )
}

export function IconUranus({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1.25"/>
      <ellipse cx="8" cy="8" rx="2" ry="7" stroke="currentColor" strokeWidth="0.75" opacity="0.5"/>
    </svg>
  )
}

export function IconComet({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="11" cy="5" r="2" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M9.5 6L2 13" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <path d="M9 4.5L3 2.5" stroke="currentColor" strokeWidth="0.75" strokeLinecap="round" opacity="0.4"/>
      <path d="M9 5.5L4 8" stroke="currentColor" strokeWidth="0.75" strokeLinecap="round" opacity="0.3"/>
    </svg>
  )
}

export function IconSupernova({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="2" fill="currentColor" opacity="0.8"/>
      <path d="M8 1v3M8 12v3M1 8h3M12 8h3M3 3l2 2M11 11l2 2M13 3l-2 2M5 11l-2 2" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.6"/>
      <path d="M4.5 4.5L8 8M11.5 4.5L8 8M4.5 11.5L8 8M11.5 11.5L8 8" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" opacity="0.3"/>
    </svg>
  )
}

export function IconPulsar({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="8" cy="8" r="1.5" fill="currentColor" opacity="0.8"/>
      <path d="M6.5 8H1M9.5 8H15" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.7"/>
      <path d="M7.5 6.5L4 2M8.5 6.5L12 2M7.5 9.5L4 14M8.5 9.5L12 14" stroke="currentColor" strokeWidth="0.5" strokeLinecap="round" opacity="0.3"/>
    </svg>
  )
}

export function IconDesert({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <circle cx="12" cy="3.5" r="1.5" stroke="currentColor" strokeWidth="1"/>
      <path d="M1 14l4-5 3 3 4-6 3 8H1z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round" opacity="0.7"/>
      <path d="M1 14h14" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  )
}

export function IconCave({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M2 14V6c0-3 2.5-5 6-5s6 2 6 5v8" stroke="currentColor" strokeWidth="1.25"/>
      <path d="M5 14V8c0-1.5 1.5-2.5 3-2.5S11 6.5 11 8v6" stroke="currentColor" strokeWidth="0.75" opacity="0.5"/>
      <circle cx="7.5" cy="6.5" r="0.5" fill="currentColor" opacity="0.5"/>
      <circle cx="9.5" cy="5.5" r="0.4" fill="currentColor" opacity="0.4"/>
    </svg>
  )
}

export function IconWaterfall({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M2 3h12v2H2z" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
      <path d="M4 5c-.5 2 .5 4 0 6M6.5 5c.3 2-.3 4 0 6M9.5 5c-.3 2 .3 4 0 6M12 5c.5 2-.5 4 0 6" stroke="currentColor" strokeWidth="0.75" strokeLinecap="round" opacity="0.6"/>
      <path d="M2 11c2-1 4-1 6 0s4 1 6 0" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  )
}

export function IconArctic({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 1L9 4L8 3L7 4L8 1z" fill="currentColor" opacity="0.7"/>
      <path d="M3 14l2-4h6l2 4H3z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      <path d="M5 10l1.5-3h3L11 10" stroke="currentColor" strokeWidth="0.75" strokeLinejoin="round" opacity="0.5"/>
      <path d="M2 14h12" stroke="currentColor" strokeWidth="1" strokeLinecap="round" opacity="0.5"/>
    </svg>
  )
}

export function IconPyramid({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M8 2L14 14H2L8 2z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      <path d="M5 14L8 8M11 14L8 8" stroke="currentColor" strokeWidth="0.75" opacity="0.4"/>
    </svg>
  )
}

export function IconLighthouse({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M6 14L7 5h2l1 9H6z" stroke="currentColor" strokeWidth="1.25" strokeLinejoin="round"/>
      <path d="M6 5h4" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
      <path d="M7.5 5V3h1v2" stroke="currentColor" strokeWidth="0.75"/>
      <path d="M5 2.5L3 1M11 2.5L13 1M8 1.5V0" stroke="currentColor" strokeWidth="0.75" strokeLinecap="round" opacity="0.6"/>
    </svg>
  )
}

export function IconBridge({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <path d="M1 10Q4 5 8 10Q12 5 15 10" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <path d="M1 10h14" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <path d="M3 10v4M7 10v4M9 10v4M13 10v4" stroke="currentColor" strokeWidth="0.75" strokeLinecap="round" opacity="0.6"/>
    </svg>
  )
}

export function IconSkyscraper({ size = 16, className = '' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}>
      <rect x="3" y="4" width="4" height="10" stroke="currentColor" strokeWidth="1" rx="0.5"/>
      <rect x="9" y="1" width="4" height="13" stroke="currentColor" strokeWidth="1" rx="0.5"/>
      <path d="M4.5 6h1M4.5 8h1M4.5 10h1M10.5 3h1M10.5 5h1M10.5 7h1M10.5 9h1M10.5 11h1" stroke="currentColor" strokeWidth="0.75" strokeLinecap="round" opacity="0.5"/>
      <path d="M1 14h14" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
    </svg>
  )
}
