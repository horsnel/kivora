'use client'

import { usePathname } from 'next/navigation'
import { Component } from 'react'
import { ExhaustedFallback, RETRY_LADDER_MS } from '@/components/BoundaryRecovery'

// Full-viewport pages that manage their own scrolling — need h-full + overflow-hidden
// on the wrapper so child <main className="h-full"> is locked to the viewport height
// and the inner flex-1 min-h-0 overflow-y-auto can scroll properly.
const FULL_VIEWPORT = ['/chat', '/research']

/**
 * Per-page error boundary — catches render errors during client-side
 * navigation WITHOUT taking down the entire app.
 *
 * CRITICAL: Do NOT use key={pathname} on this boundary. Using key={pathname}
 * forces React to UNMOUNT the old boundary and MOUNT a new one on every
 * navigation, creating a brief gap where NO error boundary is active.
 * If the new page throws during its initial render in that gap, the error
 * propagates to global-error.jsx and crashes the entire app.
 *
 * Instead, we use componentDidUpdate to reset the error state when
 * pathname changes, which keeps the boundary active at all times.
 *
 * Auto-retry: Known issue with React 19 + @cloudflare/next-on-pages (deprecated)
 * causes transient error #300 during RSC hydration. Auto-retry through a
 * patient ladder with INVISIBLE fallback so users never see an error flash;
 * if every retry fails, one timestamp-guarded full reload runs automatically
 * (see components/BoundaryRecovery.jsx) before any manual UI appears.
 */
class PageErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, retryCount: 0 }
    this.retryTimer = null
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentWillUnmount() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
  }

  componentDidCatch(error, errorInfo) {
    const isTransient300 = error?.message?.includes?.('Objects are not valid as a React child')
      || error?.message?.includes?.('#300')

    // Only log on first occurrence to reduce console spam
    if (this.state.retryCount === 0) {
      console.warn('[PageErrorBoundary] Caught' + (isTransient300 ? ' transient #300' : '') + ' error, auto-retrying:', {
        error: error?.message || error,
        componentStack: errorInfo?.componentStack,
        pathname: this.props.pathname,
      })
    }

    // Auto-retry through the shared ladder — fast ticks catch the common
    // #300 blip, the long tail outlasts a slow RSC-hydration window
    if (this.state.retryCount < RETRY_LADDER_MS.length) {
      if (this.retryTimer) clearTimeout(this.retryTimer)
      const delay = RETRY_LADDER_MS[this.state.retryCount]
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null
        this.setState(prev => ({ hasError: false, error: null, retryCount: prev.retryCount + 1 }))
      }, delay)
    }
  }

  componentDidUpdate(prevProps) {
    // Reset error boundary when navigating to a new page
    // so a crash on /explore doesn't permanently block /chat.
    if (prevProps.pathname !== this.props.pathname) {
      if (this.retryTimer) {
        clearTimeout(this.retryTimer)
        this.retryTimer = null
      }
      this.setState({ hasError: false, error: null, retryCount: 0 })
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.state.retryCount < RETRY_LADDER_MS.length) {
        // During retry: render INVISIBLE placeholder
        // The page just takes a moment to appear — no error flash
        return <div className="flex-1 min-h-[50vh]" />
      }
      // After all retries exhausted: one timestamp-guarded auto-reload (a
      // fresh document load reliably clears the failed-hydration race), and
      // only if that is blocked (repeat within a minute) the manual card
      return (
        <ExhaustedFallback waiting={<div className="flex-1 min-h-[50vh]" />}>
          <div className="flex-1 flex items-center justify-center min-h-[50vh]">
            <div className="text-center max-w-sm px-4">
              <div className="w-10 h-10 bg-red-950/30 border border-red-900/30 rounded-xl flex items-center justify-center mx-auto mb-4">
                <span className="text-red-400 text-lg">!</span>
              </div>
              <p className="text-sm text-[#737373] mb-3">This page encountered an error.</p>
              <button
                onClick={() => this.setState({ hasError: false, error: null, retryCount: 0 })}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
              >
                Try again
              </button>
            </div>
          </div>
        </ExhaustedFallback>
      )
    }
    return this.props.children
  }
}

/**
 * App template — re-renders on every route change (unlike layout).
 * View Transitions removed: caused hydration mismatches on Cloudflare Pages.
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
      {/* NO key={pathname} — keeping the boundary mounted at all times
          prevents the error coverage gap during navigation transitions */}
      <PageErrorBoundary pathname={pathname}>
        {children}
      </PageErrorBoundary>
    </div>
  )
}
