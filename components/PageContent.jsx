'use client'
import { usePathname } from 'next/navigation'

// Pages that don't show the sidebar — no hamburger spacing needed
const NO_SIDEBAR = ['/auth', '/', '/onboarding', '/chat']

// Pages with a fixed top nav bar (minimal mode) — need top padding
const FIXED_NAV = ['/onboarding']

export default function PageContent({ children }) {
  const pathname = usePathname()
  const hasSidebar = !NO_SIDEBAR.some(p => pathname === p || pathname.startsWith(p + '/'))
  const hasFixedNav = FIXED_NAV.some(p => pathname.startsWith(p))

  // On mobile, sidebar pages show a fixed hamburger icon at top-left (48px tall).
  // Add mobile-only top padding so page titles don't overlap it.
  // On md+ the sidebar is always visible inline, so no extra padding needed.
  const hamburgerPadding = hasSidebar ? 'pt-14 md:pt-0' : ''

  return (
    <div id="app-scroll-container" className={`flex-1 overflow-y-auto ${hasFixedNav ? 'pt-12 sm:pt-14' : ''} ${hamburgerPadding}`}>
      {children}
    </div>
  )
}
