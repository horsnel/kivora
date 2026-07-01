'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({ error, reset }) {
  useEffect(() => {
    // Log the actual error so we can debug in browser console
    console.error('[Kivora Error Boundary]', error?.message || error, error?.stack || '')
  }, [error])

  // Extract a user-friendly message
  const msg = error?.message || ''
  const isHydration = msg.includes('Hydration') || msg.includes('hydration') || msg.includes('minified')

  return (
    <main className="min-h-screen bg-[#0a0a0a] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-14 h-14 bg-red-950/30 border border-red-900/30 rounded-xl flex items-center justify-center mx-auto mb-6">
          <span className="text-red-400 text-xl">!</span>
        </div>
        <h1 className="font-semibold text-2xl tracking-tight mb-2">Something went wrong</h1>
        <p className="text-muted text-sm mb-6">
          {isHydration
            ? 'A page rendering conflict occurred. This usually resolves itself.'
            : 'An unexpected error occurred. This has been noted and we\'re working on it.'}
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => window.location.reload()}
            className="bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors"
          >
            Refresh page
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
