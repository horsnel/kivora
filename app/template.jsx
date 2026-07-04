'use client'

import { usePathname } from 'next/navigation'
import { Component } from 'react'

// Full-viewport pages that manage their own scrolling — need h-full + overflow-hidden
// on the wrapper so child <main className="h-full"> is locked to the viewport height
// and the inner flex-1 min-h-0 overflow-y-auto can scroll properly.
const FULL_VIEWPORT = ['/chat', '/research']

/**
 * Per-page error boundary — catches render errors during client-side
 * navigation WITHOUT taking down the entire app. If a page crashes,
 * the user sees a retry button instead of a blank screen.
 */
class PageErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidUpdate(prevProps) {
    // Reset error boundary when navigating to a new page
    // so a crash on /explore doesn't permanently block /research
    if (prevProps.pathname !== this.props.pathname && this.state.hasError) {
      this.setState({ hasError: false, error: null })
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex-1 flex items-center justify-center min-h-[50vh]">
          <div className="text-center max-w-sm px-4">
            <div className="w-10 h-10 bg-red-950/30 border border-red-900/30 rounded-xl flex items-center justify-center mx-auto mb-4">
              <span className="text-red-400 text-lg">!</span>
            </div>
            <p className="text-sm text-[#737373] mb-3">This page encountered an error.</p>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
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
 *
 * The key={pathname} on PageErrorBoundary ensures each page gets a fresh
 * error boundary on navigation, preventing cross-page error bleed.
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
      <PageErrorBoundary key={pathname} pathname={pathname}>
        {children}
      </PageErrorBoundary>
    </div>
  )
}
