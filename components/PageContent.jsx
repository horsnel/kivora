'use client'
import { usePathname } from 'next/navigation'

// Pages that don't show the sidebar — no left padding needed
const NO_SIDEBAR = ['/auth', '/welcome', '/onboarding']

export default function PageContent({ children }) {
  const pathname = usePathname()
  const hasSidebar = !NO_SIDEBAR.some(p => pathname.startsWith(p))

  return (
    <div id="app-scroll-container" className={`flex-1 overflow-y-auto ${hasSidebar ? '' : ''}`}>
      {children}
    </div>
  )
}
