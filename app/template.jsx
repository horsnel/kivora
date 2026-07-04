'use client'

import { usePathname } from 'next/navigation'
import { Component } from 'react'

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
 * causes transient error #300 during RSC hydration. Auto-retry up to 3 times.
 */
class PageErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, retryCount: 0 }
    this.maxRetries = 3
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    // Log the full error with component stack for debugging
    console.error('[PageErrorBoundary] Caught render error (attempt ' + (this.state.retryCount + 1) + '/' + this.maxRetries + '):', {
      error: error?.message || error,
      componentStack: errorInfo?.componentStack,
      pathname: this.props.pathname,
    })

    // Auto-retry for transient errors
    if (this.state.retryCount < this.maxRetries) {
      setTimeout(() => {
        this.setState(prev => ({ hasError: false, error: null, retryCount: prev.retryCount + 1 }))
      }, 150 * (this.state.retryCount + 1))
    }
  }

  componentDidUpdate(prevProps) {
    // Reset error boundary when navigating to a new page
    // so a crash on /explore doesn't permanently block /chat.
    // This is safe because the boundary stays mounted throughout,
    // so there's never a gap in error coverage.
    if (prevProps.pathname !== this.props.pathname) {
      this.setState({ hasError: false, error: null, retryCount: 0 })
    }
  }

  render() {
    if (this.state.hasError && this.state.retryCount >= this.maxRetries) {
      return (
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
