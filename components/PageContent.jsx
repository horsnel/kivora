'use client'
import { usePathname } from 'next/navigation'

// Pages that don't show the fixed navbar — no top padding needed
const NO_TOP_PADDING = ['/welcome']

export default function PageContent({ children }) {
  const pathname = usePathname()
  const needsPadding = !NO_TOP_PADDING.some(p => pathname.startsWith(p))

  return (
    <div id="app-scroll-container" className={`flex-1 overflow-y-auto ${needsPadding ? 'pt-12 sm:pt-14' : ''}`}>
      {children}
    </div>
  )
}
