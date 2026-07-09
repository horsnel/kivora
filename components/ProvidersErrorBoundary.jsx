'use client'

import { Component } from 'react'

/**
 * ProvidersErrorBoundary — wraps the context providers (CurrencyProvider,
 * LanguageProvider) to prevent provider-level errors from crashing the
 * entire app during client-side navigation.
 *
 * Known issue: React 19 + @cloudflare/next-on-pages (deprecated adapter)
 * can throw transient error #300 ("Objects are not valid as a React child")
 * during RSC hydration. This boundary auto-retries with INVISIBLE fallback
 * so users never see an error flash — the page just takes a moment to appear.
 *
 * Key design decisions:
 * - During retry, renders `null` (invisible) instead of error UI
 * - Uses more retries with shorter delays since error is very transient
 * - Only shows error UI after all retries exhausted
 * - Wraps children in a div with the correct background to prevent flash
 */
export default class ProvidersErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, retryCount: 0 }
    this.maxRetries = 5
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
      console.warn('[ProvidersErrorBoundary] Caught' + (isTransient300 ? ' transient #300' : '') + ' error, auto-retrying:', {
        error: error?.message || error,
        componentStack: errorInfo?.componentStack,
      })
    }

    // Auto-retry — for transient #300 errors, use very short delays
    if (this.state.retryCount < this.maxRetries) {
      if (this.retryTimer) clearTimeout(this.retryTimer)
      const delay = isTransient300
        ? 50 * (this.state.retryCount + 1)  // 50ms, 100ms, 150ms, 200ms, 250ms for #300
        : 150 * (this.state.retryCount + 1)  // 150ms, 300ms, ... for other errors
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null
        this.setState(prev => ({ hasError: false, error: null, retryCount: prev.retryCount + 1 }))
      }, delay)
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.state.retryCount < this.maxRetries) {
        // During retry: render INVISIBLE placeholder with matching background
        // This prevents any visual flash — the page just appears after retry
        return (
          <div style={{
            minHeight: '100vh',
            background: '#0a0a0a',
            color: 'transparent',
          }} />
        )
      }
      // After all retries exhausted: show error UI
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
