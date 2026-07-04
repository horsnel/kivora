'use client'

import { Component } from 'react'

/**
 * NavbarErrorBoundary — wraps the Navbar to prevent sidebar/auth errors
 * from crashing the entire app during client-side navigation.
 *
 * If the Navbar throws during render (e.g., Supabase auth timing issue,
 * CurrencyProvider state mismatch during route transitions), this boundary
 * catches it and renders nothing instead of taking down the whole page.
 */
export default class NavbarErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[NavbarErrorBoundary] Navbar render error:', {
      error: error?.message || error,
      componentStack: errorInfo?.componentStack,
    })
  }

  render() {
    if (this.state.hasError) {
      // Render a minimal fallback — just empty space where the sidebar would be
      return null
    }
    return this.props.children
  }
}
