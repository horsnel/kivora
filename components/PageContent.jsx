'use client'
import { usePathname } from 'next/navigation'

// Pages that don't show the sidebar — no left padding needed
const NO_SIDEBAR = ['/auth', '/', '/onboarding']

// Pages with a fixed top nav bar (minimal mode) — need top padding
const FIXED_NAV = ['/onboarding']

export default function PageContent({ children }) {
  const pathname = usePathname()
  const hasSidebar = pathname !== '/' && !['/auth', '/onboarding'].some(p => pathname.startsWith(p))
  const hasFixedNav = FIXED_NAV.some(p => pathname.startsWith(p))

  return (
    <div id="app-scroll-container" className={`flex-1 overflow-y-auto ${hasFixedNav ? 'pt-12 sm:pt-14' : ''}`}>
      {children}
    </div>
  )
}
