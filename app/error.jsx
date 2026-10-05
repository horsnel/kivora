'use client'

import Link from 'next/link'
import { useEffect } from 'react'

const CHUNK_RELOAD_KEY = '__kivora_chunk_reload_at'

// Stale-chunk auto-recovery: after each deployment, an already-open tab still
// runs the previous build. Client-side navigation then requests route chunks
// that no longer exist in the new deployment → a render error that a manual
// refresh always fixed. We do that refresh automatically. Timestamp-guarded
// (once per minute per tab) so a genuinely broken page still shows this UI
// instead of entering a reload loop.
function isStaleChunkError(error) {
  const msg = String(error?.message || '') + ' ' + String(error?.digest || '')
  return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|missing required error components|An error occurred in the Server Components render/i.test(msg)
}

export default function Error({ error, reset }) {
  const staleChunk =
    typeof window !== 'undefined' &&
    isStaleChunkError(error) &&
    Date.now() - Number(sessionStorage.getItem(CHUNK_RELOAD_KEY) || 0) > 60_000

  useEffect(() => {
    if (staleChunk) {
      sessionStorage.setItem(CHUNK_RELOAD_KEY, String(Date.now()))
      window.location.reload()
      return
    }
    console.error('[ErrorBoundary]', error?.message || error, error?.stack || '')
  }, [error, staleChunk])

  // Reload in progress — render nothing for a frame instead of flashing the card
  if (staleChunk) return null

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
