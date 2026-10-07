'use client'

import { Component } from 'react'
import { ExhaustedFallback, RETRY_LADDER_MS } from './BoundaryRecovery'

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
 * - During retry, renders an invisible shell instead of error UI (no flash)
 * - Retries through a patient ladder (components/BoundaryRecovery.jsx) that
 *   outlasts slow RSC-hydration windows during navigation
 * - After all retries: ONE timestamp-guarded full reload (a fresh document
 *   load reliably clears the race); only if that is blocked within a minute
 *   does the manual "Refresh page" card appear
 */
export default class ProvidersErrorBoundary extends Component {
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
      console.warn('[ProvidersErrorBoundary] Caught' + (isTransient300 ? ' transient #300' : '') + ' error, auto-retrying:', {
        error: error?.message || error,
        componentStack: errorInfo?.componentStack,
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

  render() {
    if (this.state.hasError) {
      const waiting = (
        <div style={{
          minHeight: '100vh',
          background: '#0a0a0a',
          color: 'transparent',
        }} />
      )
      if (this.state.retryCount < RETRY_LADDER_MS.length) {
        // During retry: render INVISIBLE placeholder with matching background
        // This prevents any visual flash — the page just appears after retry
        return waiting
      }
      // After all retries exhausted: one timestamp-guarded auto-reload (a
      // fresh document load reliably clears the failed-hydration race), and
      // only if that is blocked (repeat within a minute) the manual card
      return (
        <ExhaustedFallback waiting={waiting}>
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
        </ExhaustedFallback>
      )
    }
    return this.props.children
  }
}
