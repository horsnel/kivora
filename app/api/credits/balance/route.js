export const runtime = 'edge'

import { createClient } from '@supabase/supabase-js'
import { getEnvVar } from '@/lib/cfEnv'
import { getCreditBalance, getReferralCode, PLANS, formatBalance } from '@/lib/credits'

/**
 * GET /api/credits/balance
 *
 * Returns the user's current credit balance, plan info, and referral code.
 * Used by the Navbar credit pill and the /pricing page.
 *
 * Auth: requires logged-in user (Authorization: Bearer <access_token>).
 */
export async function GET(req) {
  try {
    const authHeader = req.headers.get('authorization') || ''
    const accessToken = authHeader.replace(/^Bearer\s+/i, '')
    if (!accessToken) {
      return Response.json({ error: 'Sign in to view credits.' }, { status: 401 })
    }

    const supaUrl = await getEnvVar('NEXT_PUBLIC_SUPABASE_URL')
    const supaAnon = await getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    const serviceKey = await getEnvVar('SUPABASE_SERVICE_ROLE_KEY')
    if (!supaUrl || !supaAnon || !serviceKey) {
      return Response.json({ error: 'Server not configured.' }, { status: 500 })
    }

    // Resolve the user via the access token
    const userClient = createClient(supaUrl, supaAnon, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    })
    const { data: { user }, error } = await userClient.auth.getUser()
    if (error || !user) {
      return Response.json({ error: 'Session expired.' }, { status: 401 })
    }

    // Use service role to read/write credit balance
    const admin = createClient(supaUrl, serviceKey)
    const balance = await getCreditBalance(admin, user.id)
    const refCode = await getReferralCode(admin, user.id)
    const plan = balance ? (PLANS[balance.plan_code] || PLANS.free) : PLANS.free
    const formatted = formatBalance(balance)

    return Response.json({
      user_id: user.id,
      plan: {
        code: plan.code,
        name: plan.name,
        price_ngn: plan.priceNGN,
      },
      balance: formatted,
      raw_balance: balance,
      referral_code: refCode?.code || null,
      referral_stats: refCode ? {
        signups: refCode.total_signups,
        credits_earned: refCode.total_credits_earned,
      } : null,
      current_period_end: balance?.current_period_end || null,
    })
  } catch (err) {
    console.error('[balance] error:', err)
    return Response.json({ error: 'Server error.' }, { status: 500 })
  }
}
