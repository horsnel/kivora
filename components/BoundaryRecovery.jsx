'use client'

import { useEffect, useState } from 'react'

// Shared recovery machinery for the class error boundaries
// (components/ProvidersErrorBoundary.jsx + PageErrorBoundary in app/template.jsx).

export const BOUNDARY_RELOAD_KEY = '__kivora_boundary_reload_at'
const RELOAD_GUARD_MS = 60_000

// Retry ladder: fast invisible retries first (the common transient #300 blip
// recovers within the first few ticks), then progressively longer backoff to
// outlast a slow RSC-hydration window during navigation instead of giving up
// and surfacing an error card. Cumulative ≈ 3.5s (previously 0.75s).
export const RETRY_LADDER_MS = [50, 100, 200, 350, 600, 900, 1300]

function readReloadGuard() {
  try {
    return Number(sessionStorage.getItem(BOUNDARY_RELOAD_KEY) || 0)
  } catch {
    return 0
  }
}

function writeReloadGuard() {
  try {
    sessionStorage.setItem(BOUNDARY_RELOAD_KEY, String(Date.now()))
  } catch {
    // sessionStorage unavailable (privacy mode) — proceed without the guard
  }
}

/**
 * ExhaustedFallback — rendered after every retry in the ladder failed.
 * Attempts ONE timestamp-guarded full reload: a fresh document load reliably
 * clears the failed-hydration race that retries cannot. Guarded to once per
 * minute per tab so a genuinely persistent error still surfaces as the
 * manual fallback card instead of entering a reload loop. Until the guard
 * decision is made (and while the reload is in flight) `waiting` is shown —
 * keeps the recovery invisible, consistent with the retry placeholder.
 */
export function ExhaustedFallback({ waiting, children }) {
  const [showManual, setShowManual] = useState(false)

  useEffect(() => {
    if (Date.now() - readReloadGuard() > RELOAD_GUARD_MS) {
      writeReloadGuard()
      window.location.reload()
      // If the reload somehow doesn't happen (blocked embeds, odd webviews),
      // surface the manual card rather than an eternal blank
      const fallbackTimer = setTimeout(() => setShowManual(true), 3000)
      return () => clearTimeout(fallbackTimer)
    }
    setShowManual(true)
  }, [])

  return showManual ? children : waiting
}
