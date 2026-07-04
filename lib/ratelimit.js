// ── Kivora Rate Limiting ────────────────────────────────────────
// IP-based rate limiting for API routes.
// Anonymous (unregistered) users get a tighter limit.
// Registered users get the standard limit.

const requests = new Map()

// Standard rate limit (registered users)
export function rateLimit(ip, max = 20) {
  const now = Date.now()
  const window = now - 60000
  const hits = (requests.get(ip) || []).filter(t => t > window)
  if (hits.length >= max) return { ok: false, remaining: 0, limit: max }
  requests.set(ip, [...hits, now])
  return { ok: true, remaining: max - hits.length - 1, limit: max }
}

// Anonymous rate limit (visitors without account) — tighter constraints
export function anonymousRateLimit(ip, max = 5) {
  return rateLimit(ip, max)
}

// Periodic cleanup — prevent memory leak in long-running edge function
// (Maps grow indefinitely without cleanup)
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const cutoff = Date.now() - 120000 // 2 minutes
    for (const [ip, timestamps] of requests.entries()) {
      const recent = timestamps.filter(t => t > cutoff)
      if (recent.length === 0) requests.delete(ip)
      else requests.set(ip, recent)
    }
  }, 60000)
}
