'use client'

import { usePathname } from 'next/navigation'

// Full-viewport pages that manage their own scrolling — need h-full + overflow-hidden
// on the wrapper so child <main className="h-full"> is locked to the viewport height
// and the inner flex-1 min-h-0 overflow-y-auto can scroll properly.
const FULL_VIEWPORT = ['/chat', '/research']

/**
 * App template — re-renders on every route change (unlike layout).
 */
export default function Template({ children }) {
  const pathname = usePathname() ?? ''
  const isFullViewport = FULL_VIEWPORT.some(p => pathname === p || pathname.startsWith(p + '/'))

  return (
    <div
      className={isFullViewport
        ? 'min-h-0 h-full flex-1 flex flex-col overflow-hidden'
        : 'min-h-full flex-1 flex flex-col'
      }
    >
      {children}
    </div>
  )
}
