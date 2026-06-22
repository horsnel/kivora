'use client'
import { usePathname } from 'next/navigation'

// Pages that don't show the sidebar — no hamburger spacing needed
const NO_SIDEBAR = ['/auth', '/', '/onboarding', '/chat']

// Pages with a fixed top nav bar (minimal mode) — need top padding
const FIXED_NAV = ['/onboarding']

// Full-viewport pages that manage their own scrolling — no overflow-y-auto
const FULL_VIEWPORT = ['/chat', '/research']

export default function PageContent({ children }) {
  const pathname = usePathname() ?? ''
  const hasSidebar = !NO_SIDEBAR.some(p => pathname === p || pathname.startsWith(p + '/'))
  const hasFixedNav = FIXED_NAV.some(p => pathname.startsWith(p))
  const isFullViewport = FULL_VIEWPORT.some(p => pathname === p || pathname.startsWith(p + '/'))

  // On mobile, sidebar pages have a scroll-away hamburger bar (48px tall) that's
  // part of the page flow — no extra padding needed since it scrolls with content.
  // On lg+ the sidebar is always visible inline, so no extra padding needed.
  const hamburgerPadding = ''

  // Full-viewport pages (like chat) manage their own scrolling internally.
  // Use overflow-hidden so the page's own scroll containers work correctly.
  const overflowClass = isFullViewport ? 'overflow-hidden' : 'overflow-y-auto'

  return (
    <div
      id="app-scroll-container"
      style={{ viewTransitionName: 'main-scroll' }}
      className={`flex-1 min-h-0 ${overflowClass} ${hasFixedNav ? 'pt-12 sm:pt-14' : ''} ${hamburgerPadding}`}
    >
      {children}
    </div>
  )
}
