'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

// Full-viewport pages that manage their own scrolling — need h-full + overflow-hidden
// on the wrapper so child <main className="h-full"> is locked to the viewport height
// and the inner flex-1 min-h-0 overflow-y-auto can scroll properly.
// Pattern from research scroll fix commit 40cd66c.
const FULL_VIEWPORT = ['/chat', '/research']

/**
 * App template — re-renders on every route change (unlike layout).
 * Triggers the View Transitions API for smooth cross-page animations.
 * Falls back gracefully on browsers that don't support it.
 */
export default function Template({ children }) {
  const pathname = usePathname()
  const prevPathname = useRef(pathname)
  const isFullViewport = FULL_VIEWPORT.some(p => pathname === p || pathname.startsWith(p + '/'))

  useEffect(() => {
    // Only trigger transition on actual route changes, not initial load
    if (prevPathname.current === pathname) return
    prevPathname.current = pathname

    // The browser handles the transition using ::view-transition CSS rules.
    // Next.js experimental.viewTransition wraps route changes in startViewTransition(),
    // so we don't need to call it manually here — this effect is just for any
    // additional per-route setup (scroll reset, etc.)
  }, [pathname])

  return (
    <div
      style={{ viewTransitionName: 'page-content' }}
      className={isFullViewport
        ? 'min-h-0 h-full flex-1 flex flex-col overflow-hidden'
        : 'min-h-full flex-1 flex flex-col'
      }
    >
      {children}
    </div>
  )
}
