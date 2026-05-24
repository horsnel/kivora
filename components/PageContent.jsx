'use client'
import { usePathname } from 'next/navigation'

// Pages that don't show the sidebar — no hamburger spacing needed
const NO_SIDEBAR = ['/auth', '/', '/onboarding', '/chat']

// Pages with a fixed top nav bar (minimal mode) — need top padding
const FIXED_NAV = ['/onboarding']

// Full-viewport pages that manage their own scrolling — no overflow-y-auto
const FULL_VIEWPORT = ['/chat']

export default function PageContent({ children }) {
  const pathname = usePathname()
  const hasSidebar = !NO_SIDEBAR.some(p => pathname === p || pathname.startsWith(p + '/'))
  const hasFixedNav = FIXED_NAV.some(p => pathname.startsWith(p))
  const isFullViewport = FULL_VIEWPORT.some(p => pathname === p || pathname.startsWith(p + '/'))

  // On mobile, sidebar pages show a fixed hamburger icon at top-left (48px tall).
  // Add mobile-only top padding so page titles don't overlap it.
  // On md+ the sidebar is always visible inline, so no extra padding needed.
  const hamburgerPadding = hasSidebar ? 'pt-14 lg:pt-0' : ''

  // Full-viewport pages (like chat) manage their own scrolling internally.
  // Use overflow-hidden so the page's own scroll containers work correctly.
  const overflowClass = isFullViewport ? 'overflow-hidden' : 'overflow-y-auto'

  return (
    <div id="app-scroll-container" className={`flex-1 ${overflowClass} ${hasFixedNav ? 'pt-12 sm:pt-14' : ''} ${hamburgerPadding}`}>
      {children}
    </div>
  )
}
