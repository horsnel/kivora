'use client'

import { Component } from 'react'

/**
 * ProvidersErrorBoundary — wraps the context providers (CurrencyProvider,
 * LanguageProvider) to prevent provider-level errors from crashing the
 * entire app during client-side navigation.
 *
 * Known issue: React 19 + @cloudflare/next-on-pages (deprecated adapter)
 * can throw transient error #300 ("Objects are not valid as a React child")
 * during RSC hydration. This boundary auto-retries up to 3 times with
 * a small delay, since the error is usually transient and the page
 * renders correctly on subsequent attempts.
 */
export default class ProvidersErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, retryCount: 0 }
    this.maxRetries = 3
    this.retryTimer = null
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentWillUnmount() {
    // Clear any pending retry timer when the boundary unmounts
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ProvidersErrorBoundary] Provider error (attempt ' + (this.state.retryCount + 1) + '/' + this.maxRetries + '):', {
      error: error?.message || error,
      componentStack: errorInfo?.componentStack,
    })

    // Auto-retry for transient errors (like React #300 from RSC hydration)
    if (this.state.retryCount < this.maxRetries) {
      // Clear any existing timer before setting a new one
      if (this.retryTimer) clearTimeout(this.retryTimer)
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null
        this.setState(prev => ({ hasError: false, error: null, retryCount: prev.retryCount + 1 }))
      }, 100 * (this.state.retryCount + 1)) // Increasing delay: 100ms, 200ms, 300ms
    }
  }

  render() {
    if (this.state.hasError && this.state.retryCount >= this.maxRetries) {
      // After max retries, show a full-page reload button
      return (
        <div style={{
          minHeight: '100vh',
          background: '#0a0a0a',
          color: '#fafafa',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '1rem',
        }}>
          <div style={{ textAlign: 'center', maxWidth: '24rem' }}>
            <p style={{ color: '#737373', fontSize: '0.875rem', marginBottom: '1rem' }}>
              Something went wrong. Please try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#dc2626',
                color: 'white',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '0.5rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Refresh page
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
