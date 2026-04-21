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
