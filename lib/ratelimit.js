// ── Kivora Rate Limiting ────────────────────────────────────────
// IP-based rate limiting for API routes.
// Anonymous (unregistered) users get a tighter limit.
// Registered users get the standard limit.

const requests = new Map()

// Standard rate limit (registered users)
export function rateLimit(ip, max = 20) {
  _registerCleanup()
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

// ── Anonymous Daily Limit ─────────────────────────────────────────
// Tracks per-IP daily usage in Supabase (persists across edge isolates).
// Falls back to in-memory per-minute limit if Supabase table is unavailable.
//
// Limits (per IP, per calendar day UTC):
//   • explore / opportunities → 15/day
//   • chat                    → 5/day
//
// Usage:
//   const check = await anonymousDailyLimit(admin, ip, 'explore', 15)
//   if (!check.ok) return 429 with upgrade popup

export async function anonymousDailyLimit(admin, ip, action, max = 15) {
  // No admin client or IP — fall back to per-minute in-memory limit
  if (!admin || !ip || ip === 'unknown') {
    return anonymousRateLimit(ip, max)
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
      // Table doesn't exist or query failed — fall back to per-minute
      return anonymousRateLimit(ip, max)
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
      return anonymousRateLimit(ip, max)
    }

    return { ok: true, remaining: max - 1, limit: max, used: 1, daily: true }
  } catch {
    // Any failure — fall back to per-minute limit so we never block legit users
    return anonymousRateLimit(ip, max)
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
        for (const [ip, timestamps] of requests.entries()) {
          const recent = timestamps.filter(t => t > cutoff)
          if (recent.length === 0) requests.delete(ip)
          else requests.set(ip, recent)
        }
      }, 60000)
    } catch {
      // setInterval not available — ignore (edge runtime without nodejs_compat)
    }
  }
}
