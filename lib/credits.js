// ── Kivora Credits System ─────────────────────────────────────────
// Atoms.dev-style credit accounting for Kivora.
//
// Three credit pools drain in this priority order:
//   1. daily  (resets every day at 00:00 UTC, use-them-or-lose-them)
//   2. rolled_over  (leftover monthly credits from the previous cycle, expire at next renewal)
//   3. monthly  (subscription credits, refilled on each billing cycle)
//   4. bonus  (referral grants, promo redemptions, refunds)
//
// Every API route calls `chargeCredits(supabaseAdmin, userId, action)` BEFORE
// running the user's request. If the user is out of credits we return 402.
// Anonymous users (no userId) skip charging — they're rate-limited via IP.

import { getEnvVar } from '@/lib/cfEnv'
// Re-export client-safe constants so server code can import everything from one place
export { PLANS, PLAN_LIST, CREDIT_COSTS, formatBalance } from '@/lib/plans'

// Import the same constants for internal use
import { PLANS, CREDIT_COSTS } from '@/lib/plans'

// ── Charge Credits ────────────────────────────────────────────────
// Calls the Postgres `charge_credits` function atomically.
// Returns:
//   { ok: true, charged, breakdown, balance } on success
//   { ok: false, error: 'insufficient_credits', needed, available, shortfall, balance } on failure
//   { ok: false, error: 'no_user' } if no userId (anonymous — caller should skip)
export async function chargeCredits(admin, userId, action, opts = {}) {
  if (!userId) return { ok: false, error: 'no_user' }
  if (!admin) return { ok: false, error: 'no_admin' }

  const cost = opts.cost ?? CREDIT_COSTS[action] ?? 1
  const description = opts.description ?? null
  const metadata = opts.metadata ?? {}

  const { data, error } = await admin.rpc('charge_credits', {
    p_user_id: userId,
    p_action: action,
    p_cost: cost,
    p_description: description,
    p_metadata: metadata,
  })

  if (error) {
    console.error('[credits] charge_credits RPC failed:', error)
    return { ok: false, error: 'rpc_error', message: error.message }
  }

  return data
}

// ── Grant Credits (admin only) ────────────────────────────────────
export async function grantCredits(admin, userId, amount, action, description = null, metadata = {}) {
  if (!admin || !userId || amount <= 0) return { ok: false, error: 'invalid_args' }

  const { data, error } = await admin.rpc('grant_credits', {
    p_user_id: userId,
    p_amount: amount,
    p_action: action,
    p_description: description,
    p_metadata: metadata,
  })

  if (error) {
    console.error('[credits] grant_credits RPC failed:', error)
    return { ok: false, error: 'rpc_error', message: error.message }
  }
  return data
}

// ── Get Current Balance ───────────────────────────────────────────
// Returns the live balance plus the plan info. Auto-provisions a row if missing.
export async function getCreditBalance(admin, userId) {
  if (!admin || !userId) return null

  const { data, error } = await admin
    .from('user_credits')
    .select('plan_code, daily_credits, daily_credits_date, monthly_credits, rolled_over_credits, bonus_credits, total_spent, current_period_end')
    .eq('user_id', userId)
    .single()

  if (error && error.code === 'PGRST116') {
    // Row doesn't exist — auto-provision via the upsert pattern
    await admin.from('user_credits').upsert({
      user_id: userId,
      plan_code: 'free',
      daily_credits: PLANS.free.daily,
      monthly_credits: PLANS.free.monthly,
      daily_credits_date: new Date().toISOString().slice(0, 10),
    }, { onConflict: 'user_id' })

    const { data: fresh } = await admin
      .from('user_credits')
      .select('plan_code, daily_credits, daily_credits_date, monthly_credits, rolled_over_credits, bonus_credits, total_spent, current_period_end')
      .eq('user_id', userId)
      .single()
    return fresh
  }
  if (error) {
    console.error('[credits] getCreditBalance failed:', error)
    return null
  }
  return data
}

// ── Check Plan Feature Access ─────────────────────────────────────
// Returns true if the user's plan grants the requested feature.
// `feature` is a key from PLANS[plan].features (e.g., 'deepResearch').
export async function hasFeatureAccess(admin, userId, feature) {
  const balance = await getCreditBalance(admin, userId)
  if (!balance) return false
  const plan = PLANS[balance.plan_code] || PLANS.free
  return Boolean(plan.features[feature])
}

// ── Check + Charge in One Call ────────────────────────────────────
// Convenience wrapper used by API routes. Returns either:
//   { ok: true, balance } — proceed with the request
//   { ok: false, status, error, response } — short-circuit with this Response
//
// Usage:
//   const check = await requireCredits(req, admin, user, 'research_deep', { description: query })
//   if (!check.ok) return check.response
export async function requireCredits(req, admin, user, action, opts = {}) {
  // Anonymous user — let it through (rate-limited separately by IP)
  if (!user?.id) {
    return { ok: true, anonymous: true }
  }

  // Feature gate: if this action requires a feature, check it first
  const featureGate = opts.feature // e.g., 'deepResearch'
  if (featureGate) {
    const hasAccess = await hasFeatureAccess(admin, user.id, featureGate)
    if (!hasAccess) {
      return {
        ok: false,
        status: 403,
        error: 'feature_not_available',
        response: Response.json({
          error: 'This feature requires a higher plan.',
          feature: featureGate,
          upgrade_url: '/pricing',
        }, { status: 403 }),
      }
    }
  }

  const result = await chargeCredits(admin, user.id, action, opts)
  if (!result.ok) {
    if (result.error === 'insufficient_credits') {
      return {
        ok: false,
        status: 402,
        error: 'insufficient_credits',
        response: Response.json({
          error: 'You are out of credits for this period.',
          needed: result.needed,
          available: result.available,
          shortfall: result.shortfall,
          balance: result.balance,
          upgrade_url: '/pricing',
        }, { status: 402 }),
      }
    }
    // Other RPC error — let the request through (don't punish the user for our DB issue)
    console.warn('[credits] charge failed, allowing request:', result.error)
    return { ok: true, soft_fail: true }
  }

  return { ok: true, balance: result.balance, charged: result.charged, breakdown: result.breakdown }
}

// ── Refund Credits (refund on failure) ────────────────────────────
// If an API call fails AFTER charging (e.g., the LLM returns 500), call this
// to grant the credits back as bonus credits.
export async function refundCredits(admin, userId, amount, action, reason = null) {
  return grantCredits(admin, userId, amount, 'refund', `Refund for ${action}: ${reason || 'API failure'}`, { original_action: action })
}

// ── Run Daily Reset (called by cron) ──────────────────────────────
export async function runDailyReset(admin) {
  const { data, error } = await admin.rpc('reset_daily_credits')
  if (error) {
    console.error('[credits] daily reset failed:', error)
    return { ok: false, error: error.message }
  }
  return data
}

// ── Run Monthly Reset (called by cron on the 1st) ─────────────────
export async function runMonthlyReset(admin) {
  const { data, error } = await admin.rpc('reset_monthly_credits')
  if (error) {
    console.error('[credits] monthly reset failed:', error)
    return { ok: false, error: error.message }
  }
  return data
}

// ── Get User Referral Code ────────────────────────────────────────
export async function getReferralCode(admin, userId) {
  if (!admin || !userId) return null
  const { data, error } = await admin
    .from('referral_codes')
    .select('code, total_signups, total_credits_earned')
    .eq('user_id', userId)
    .single()
  if (error) return null
  return data
}

// ── Get Recent Transactions (for /dashboard) ──────────────────────
export async function getRecentTransactions(admin, userId, limit = 50) {
  if (!admin || !userId) return []
  const { data, error } = await admin
    .from('credit_transactions')
    .select('id, delta, credit_type, action, description, metadata, balance_after, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) return []
  return data || []
}
