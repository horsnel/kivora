export const runtime = 'edge'

import { createClient } from '@supabase/supabase-js'
import { getEnvVar } from '@/lib/cfEnv'
import { PLANS } from '@/lib/credits'
import { initializeTransaction } from '@/lib/paystack'
import { rateLimit } from '@/lib/ratelimit'

/**
 * POST /api/billing/checkout
 * Body: { plan: 'pro' | 'max' | 'team', billing?: 'monthly' | 'annual' }
 *
 * Initializes a Paystack transaction and returns the authorization URL.
 * The user is redirected there to enter payment, then Paystack redirects
 * them back to /api/billing/verify?reference=...
 *
 * Auth: requires a logged-in user (we read their email from the Supabase JWT).
 */
export async function POST(req) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!rateLimit(ip).ok) {
    return Response.json({ error: 'Too many requests. Please slow down.' }, { status: 429 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const planCode = (body.plan || '').toLowerCase()
    const billingCycle = (body.billing || 'monthly').toLowerCase()

    if (!['pro', 'max', 'team'].includes(planCode)) {
      return Response.json({ error: 'Invalid plan. Choose pro, max, or team.' }, { status: 400 })
    }
    if (!['monthly', 'annual'].includes(billingCycle)) {
      return Response.json({ error: 'Invalid billing cycle.' }, { status: 400 })
    }

    // ── Resolve the Supabase user from the access_token in the Authorization header ──
    const authHeader = req.headers.get('authorization') || ''
    const accessToken = authHeader.replace(/^Bearer\s+/i, '')
    if (!accessToken) {
      return Response.json({ error: 'Sign in to upgrade.' }, { status: 401 })
    }

    const supaUrl = await getEnvVar('NEXT_PUBLIC_SUPABASE_URL')
    const supaAnon = await getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    if (!supaUrl || !supaAnon) {
      return Response.json({ error: 'Auth not configured.' }, { status: 500 })
    }

    const userClient = createClient(supaUrl, supaAnon, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    })

    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) {
      return Response.json({ error: 'Session expired. Sign in again.' }, { status: 401 })
    }

    const email = user.email
    if (!email) {
      return Response.json({ error: 'No email on account.' }, { status: 400 })
    }

    // ── Compute amount ──
    const plan = PLANS[planCode]
    let amountNGN = plan.priceNGN
    if (billingCycle === 'annual') {
      // Annual = 12 × monthly × 0.8 (20% discount, mirrors Atoms.dev's annual pricing)
      amountNGN = Math.round(plan.priceNGN * 12 * 0.8)
    }
    const amountKobo = amountNGN * 100 // 1 NGN = 100 kobo

    // ── Generate unique reference ──
    const reference = `kivora-${planCode}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    // ── Write a pending order to Supabase via service role ──
    const serviceKey = await getEnvVar('SUPABASE_SERVICE_ROLE_KEY')
    if (!serviceKey) {
      return Response.json({ error: 'Server not configured for billing.' }, { status: 500 })
    }
    const admin = createClient(supaUrl, serviceKey)

    const { error: orderErr } = await admin.from('paystack_orders').insert({
      user_id: user.id,
      reference,
      plan_code: planCode,
      amount_kobo: amountKobo,
      currency: 'NGN',
      status: 'pending',
      billing_cycle: billingCycle,
    })
    if (orderErr) {
      console.error('[checkout] failed to write order:', orderErr)
      // Continue anyway — Paystack will still process the payment; we just lose the audit row
    }

    // ── Initialize Paystack transaction ──
    const txn = await initializeTransaction({
      amountKobo,
      email,
      reference,
      metadata: {
        user_id: user.id,
        plan_code: planCode,
        billing_cycle: billingCycle,
        amount_ngn: amountNGN,
        custom_fields: [
          { display_name: 'Plan', variable_name: 'plan', value: plan.name },
          { display_name: 'Billing', variable_name: 'billing_cycle', value: billingCycle },
          { display_name: 'User ID', variable_name: 'user_id', value: user.id },
        ],
      },
    })

    return Response.json({
      authorization_url: txn.authorization_url,
      access_code: txn.access_code,
      reference: txn.reference,
      amount_ngn: amountNGN,
      plan: planCode,
      billing_cycle: billingCycle,
    })
  } catch (err) {
    console.error('[checkout] error:', err)
    return Response.json(
      { error: err.message || 'Could not start checkout. Please try again.' },
      { status: 500 }
    )
  }
}
