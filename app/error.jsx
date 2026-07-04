'use client'

import Link from 'next/link'
import { useEffect } from 'react'

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error('[ErrorBoundary]', error?.message || error, error?.stack || '')
  }, [error])

  // Detect hydration errors specifically
  const isHydrationError = error?.message?.includes('hydrat') ||
    error?.message?.includes('Minified React error') ||
    error?.message?.includes('did not match')

  return (
    <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-14 h-14 bg-red-950/30 border border-red-900/30 rounded-xl flex items-center justify-center mx-auto mb-6">
          <span className="text-red-400 text-xl">!</span>
        </div>
        <h1 className="font-semibold text-2xl tracking-tight mb-2">Something went wrong</h1>
        <p className="text-muted text-sm mb-2">
          {isHydrationError
            ? 'A page rendering error occurred. This usually resolves on refresh.'
            : 'An unexpected error occurred. This has been noted and we\'re working on it.'}
        </p>
        {error?.message && (
          <p className="text-red-400/80 text-xs font-mono bg-[#1a1a1a] rounded-lg px-3 py-2 mb-4 break-all">
            {error.message}
          </p>
        )}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          >
            Try again
          </button>
          <Link
            href="/research"
            className="bg-[#141414] border border-[#262626] hover:border-[#3a3a3a] text-[#d4d4d4] px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
          >
            Go to Research
          </Link>
        </div>
      </div>
    </main>
  )
}
