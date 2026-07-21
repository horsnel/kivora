// ── Kivora Rate Limiting ────────────────────────────────────────
// IP-based rate limiting for API routes.
// Anonymous (unregistered) users get a tighter limit.
// Registered users get the standard limit.

const globalRequests = new Map()   // Standard rate limit (all users)
const anonRequests = new Map()     // Anonymous burst limit (separate bucket)
const anonDailyFallback = new Map() // Fallback daily tracking when Supabase unavailable

// ── Client IP Extraction ──────────────────────────────────────────
// Cloudflare Workers sets `cf-connecting-ip` (most reliable).
// Falls back to `x-forwarded-for` (first IP in chain) or `x-real-ip`.
// MUST be used instead of raw `x-forwarded-for` on CF Pages deployments.
export function getClientIP(req) {
  return (
    req.headers.get('cf-connecting-ip') ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown'
  )
}

// Standard rate limit (registered users) — 20 req/min per IP
export function rateLimit(ip, max = 20) {
  _registerCleanup()
  const now = Date.now()
  const window = now - 60000
  const hits = (globalRequests.get(ip) || []).filter(t => t > window)
  if (hits.length >= max) return { ok: false, remaining: 0, limit: max }
  globalRequests.set(ip, [...hits, now])
  return { ok: true, remaining: max - hits.length - 1, limit: max }
}

// Anonymous burst limit (separate from global) — 5 req/min per IP
export function anonymousRateLimit(ip, max = 5) {
  _registerCleanup()
  const now = Date.now()
  const window = now - 60000
  const hits = (anonRequests.get(ip) || []).filter(t => t > window)
  if (hits.length >= max) return { ok: false, remaining: 0, limit: max }
  anonRequests.set(ip, [...hits, now])
  return { ok: true, remaining: max - hits.length - 1, limit: max }
}

// ── In-Memory Daily Fallback ────────────────────────────────────
// When Supabase `anon_daily_usage` table is unavailable, we track
// daily counts in-memory using a separate Map keyed by ip:action:date.
// This is NOT shared with the per-minute rate limit Maps above.
function _dailyFallbackKey(ip, action) {
  const today = new Date().toISOString().slice(0, 10)
  return `${ip}:${action}:${today}`
}

function _dailyFallbackCheck(ip, action, max) {
  const key = _dailyFallbackKey(ip, action)
  const current = anonDailyFallback.get(key) || 0
  if (current >= max) {
    return { ok: false, remaining: 0, limit: max, used: current, daily: true }
  }
  anonDailyFallback.set(key, current + 1)
  return { ok: true, remaining: max - current - 1, limit: max, used: current + 1, daily: true }
}

// ── Anonymous Daily Limit ─────────────────────────────────────────
// Tracks per-IP daily usage in Supabase (persists across edge isolates).
// Falls back to in-memory daily limit if Supabase table is unavailable.
//
// Limits (per IP, per calendar day UTC):
//   • explore / opportunities → 15/day
//   • chat                    → 5/day
//
// Usage:
//   const check = await anonymousDailyLimit(admin, ip, 'explore', 15)
//   if (!check.ok) return 429 with upgrade popup

export async function anonymousDailyLimit(admin, ip, action, max = 15) {
  // No admin client or IP — fall back to in-memory daily tracking
  if (!admin || !ip || ip === 'unknown') {
    return _dailyFallbackCheck(ip, action, max)
  }

  const today = new Date().toISOString().slice(0, 10)

  try {
    // Try to fetch today's count for this IP + action
    const { data: existing, error } = await admin
      .from('anon_daily_usage')
      .select('count')
      .eq('ip', ip)
      .eq('action', action)
      .eq('date', today)
      .maybeSingle()

    if (error) {
      // Table doesn't exist or query failed — fall back to in-memory daily tracking
      // (NOT per-minute burst limit — that was the bug!)
      return _dailyFallbackCheck(ip, action, max)
    }

    if (existing) {
      if (existing.count >= max) {
        return { ok: false, remaining: 0, limit: max, used: existing.count, daily: true }
      }
      // Increment
      await admin
        .from('anon_daily_usage')
        .update({ count: existing.count + 1, updated_at: new Date().toISOString() })
        .eq('ip', ip)
        .eq('action', action)
        .eq('date', today)
      return { ok: true, remaining: max - existing.count - 1, limit: max, used: existing.count + 1, daily: true }
    }

    // No record yet — insert first usage
    const { error: insertErr } = await admin
      .from('anon_daily_usage')
      .insert({ ip, action, date: today, count: 1 })

    if (insertErr) {
      return _dailyFallbackCheck(ip, action, max)
    }

    return { ok: true, remaining: max - 1, limit: max, used: 1, daily: true }
  } catch {
    // Any failure — fall back to in-memory daily tracking so we never block legit users
    return _dailyFallbackCheck(ip, action, max)
  }
}

// Periodic cleanup — prevent memory leak in long-running edge function.
// IMPORTANT: setInterval at module load crashes Cloudflare Workers with
// "Disallowed operation called within global scope." We defer registration
// to the first rateLimit() call so it only runs inside a request handler.
let _cleanupRegistered = false
function _registerCleanup() {
  if (_cleanupRegistered) return
  _cleanupRegistered = true
  if (typeof setInterval !== 'undefined') {
    try {
      setInterval(() => {
        const cutoff = Date.now() - 120000 // 2 minutes
        for (const [ip, timestamps] of globalRequests.entries()) {
          const recent = timestamps.filter(t => t > cutoff)
          if (recent.length === 0) globalRequests.delete(ip)
          else globalRequests.set(ip, recent)
        }
        for (const [ip, timestamps] of anonRequests.entries()) {
          const recent = timestamps.filter(t => t > cutoff)
          if (recent.length === 0) anonRequests.delete(ip)
          else anonRequests.set(ip, recent)
        }
        // Clean up daily fallback entries older than 2 days
        const dayPrefix = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10)
        for (const [key] of anonDailyFallback.entries()) {
          // key format: ip:action:YYYY-MM-DD
          const keyDate = key.split(':').pop()
          if (keyDate < dayPrefix) anonDailyFallback.delete(key)
        }
      }, 60000)
    } catch {
      // setInterval not available — ignore (edge runtime without nodejs_compat)
    }
  }
}
