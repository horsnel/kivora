// ── Feature Daily Usage (tiered rate limiting) ───────────────────
// ReelPen & DevTools are no longer hard-locked to Pro. Instead:
//
//   • Pro / Max / Team → unlimited (credits still charged by the route)
//   • Free (signed-in) → FEATURE_LIMITS.free runs per day, keyed `user:<id>`
//   • Anonymous        → FEATURE_LIMITS.anonymous runs per day, keyed by IP
//
// Both free tiers share the existing `anon_daily_usage` table — its `ip`
// column is plain text, so `user:<uuid>` keys fit without a migration.
// Limits reset at 00:00 UTC (same calendar-day semantics the table already
// uses). On DB failure we fail OPEN, matching requireCredits' soft-fail
// philosophy: never punish a user for our infrastructure problems.

export const FEATURE_LIMITS = { anonymous: 5, free: 15 }

// Next 00:00 UTC as an ISO string — the moment the daily counters reset.
export function nextUTCResetISO() {
  const now = new Date()
  const reset = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 0, 0, 0, 0)
  return new Date(reset).toISOString()
}

const todayUTC = () => new Date().toISOString().slice(0, 10)

async function getPlanCode(admin, userId) {
  if (!admin || !userId) return null
  try {
    const { data } = await admin
      .from('user_credits')
      .select('plan_code')
      .eq('user_id', userId)
      .single()
    return data?.plan_code || 'free'
  } catch {
    return null
  }
}

// ── Resolve which tier this caller belongs to ──────────────────────
export async function resolveFeatureTier(admin, userId) {
  const plan = await getPlanCode(admin, userId)
  if (plan === 'pro' || plan === 'max' || plan === 'team') {
    return { tier: 'paid', plan, limit: null }
  }
  if (userId) return { tier: 'free', plan: 'free', limit: FEATURE_LIMITS.free }
  return { tier: 'anonymous', plan: null, limit: FEATURE_LIMITS.anonymous }
}

// ── Read-only usage snapshot (for the GET /api/<feature> probe) ────
export async function getFeatureUsage(admin, userId, ip, action) {
  const tier = await resolveFeatureTier(admin, userId)
  const reset_at = nextUTCResetISO()

  if (tier.tier === 'paid') {
    return { tier: tier.tier, plan: tier.plan, used: 0, limit: null, remaining: null, unlimited: true, reset_at }
  }

  const key = tier.tier === 'free' ? `user:${userId}` : ip
  let used = 0
  if (admin && key && key !== 'unknown') {
    try {
      const { data } = await admin
        .from('anon_daily_usage')
        .select('count')
        .eq('ip', key)
        .eq('action', action)
        .eq('date', todayUTC())
        .maybeSingle()
      used = data?.count || 0
    } catch {
      used = 0 // fail open — can't read, assume unused
    }
  }

  return {
    tier: tier.tier,
    plan: tier.plan,
    used,
    limit: tier.limit,
    remaining: Math.max(0, tier.limit - used),
    unlimited: false,
    reset_at,
  }
}

// ── Consume one run (call right before executing the work) ────────
// Returns { ok: true,  tier, plan, limit, used, remaining, reset_at }
//     or  { ok: false, ... same fields, remaining: 0 }  → caller returns 429
export async function consumeFeatureUsage(admin, userId, ip, action) {
  const tier = await resolveFeatureTier(admin, userId)
  const reset_at = nextUTCResetISO()

  if (tier.tier === 'paid') {
    return { ok: true, tier: tier.tier, plan: tier.plan, limit: null, used: 0, remaining: null, unlimited: true, reset_at }
  }

  const key = tier.tier === 'free' ? `user:${userId}` : ip
  const limit = tier.limit

  // No admin client / no usable key — fail open (can't meter, don't block)
  if (!admin || !key || key === 'unknown') {
    return { ok: true, tier: tier.tier, plan: tier.plan, limit, used: null, remaining: null, reset_at, untracked: true }
  }

  const date = todayUTC()
  let used = 0
  let readable = true
  try {
    const { data } = await admin
      .from('anon_daily_usage')
      .select('count')
      .eq('ip', key)
      .eq('action', action)
      .eq('date', date)
      .maybeSingle()
    used = data?.count || 0
  } catch {
    readable = false
  }

  if (readable && used >= limit) {
    return { ok: false, tier: tier.tier, plan: tier.plan, limit, used, remaining: 0, reset_at }
  }

  // Upsert count+1 — unique index on (ip, action, date) makes this safe.
  try {
    const { error } = await admin
      .from('anon_daily_usage')
      .upsert(
        { ip: key, action, date, count: used + 1, updated_at: new Date().toISOString() },
        { onConflict: 'ip,action,date' }
      )
    if (error) throw error
  } catch {
    // Write failed — allow the run (fail open), flag it so callers know metering slipped
    return { ok: true, tier: tier.tier, plan: tier.plan, limit, used: used + 1, remaining: Math.max(0, limit - used - 1), reset_at, soft_fail: true }
  }

  return { ok: true, tier: tier.tier, plan: tier.plan, limit, used: used + 1, remaining: Math.max(0, limit - used - 1), reset_at }
}
