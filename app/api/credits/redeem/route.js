export const runtime = 'edge' 

import { createClient } from '@supabase/supabase-js'
import { getEnvVar } from '@/lib/cfEnv'
import { rateLimit, getClientIP } from '@/lib/ratelimit'

/**
 * POST /api/credits/redeem
 * Body: { code: 'LAUNCH100' | 'KIV-AB12CD' }
 *
 * Two redemption flows:
 *   1. Promo code (LAUNCH100) — looks up promo_codes, grants bonus_credits
 *   2. Referral code (KIV-XXXXXX) — looks up referral_codes, grants both
 *      referrer and new user 25 bonus credits each
 *
 * Auth: requires logged-in user.
 */
export async function POST(req) {
  const ip = getClientIP(req)
  if (!rateLimit(ip, 5).ok) {
    return Response.json({ error: 'Too many attempts. Please slow down.' }, { status: 429 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const code = (body.code || '').trim().toUpperCase()
    if (!code) {
      return Response.json({ error: 'Enter a code.' }, { status: 400 })
    }

    // ── Resolve user ──
    const authHeader = req.headers.get('authorization') || ''
    const accessToken = authHeader.replace(/^Bearer\s+/i, '')
    if (!accessToken) {
      return Response.json({ error: 'Sign in to redeem.' }, { status: 401 })
    }

    const supaUrl = await getEnvVar('NEXT_PUBLIC_SUPABASE_URL')
    const supaAnon = await getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY')
    const serviceKey = await getEnvVar('SUPABASE_SERVICE_ROLE_KEY')
    if (!supaUrl || !supaAnon || !serviceKey) {
      return Response.json({ error: 'Server not configured.' }, { status: 500 })
    }

    const userClient = createClient(supaUrl, supaAnon, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
    })
    const { data: { user }, error } = await userClient.auth.getUser()
    if (error || !user) {
      return Response.json({ error: 'Session expired.' }, { status: 401 })
    }

    const admin = createClient(supaUrl, serviceKey)

    // ── Try promo code first ──
    if (!code.startsWith('KIV-')) {
      const { data: promo, error: promoErr } = await admin
        .from('promo_codes')
        .select('*')
        .eq('code', code)
        .eq('is_active', true)
        .single()

      if (promo && !promoErr) {
        // Check expiry
        if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
          return Response.json({ error: 'This code has expired.' }, { status: 400 })
        }
        // Check max uses
        if (promo.max_uses !== null && promo.uses >= promo.max_uses) {
          return Response.json({ error: 'This code has been fully redeemed.' }, { status: 400 })
        }
        // Check if user already redeemed
        const { data: existing } = await admin
          .from('promo_redemptions')
          .select('id')
          .eq('user_id', user.id)
          .eq('code', code)
          .maybeSingle()
        if (existing) {
          return Response.json({ error: 'You already redeemed this code.' }, { status: 400 })
        }

        // Grant the bonus
        const { error: grantErr } = await admin.rpc('grant_credits', {
          p_user_id: user.id,
          p_amount: promo.bonus_credits,
          p_action: 'redemption',
          p_description: `Redeemed promo code ${code}`,
          p_metadata: { code },
        })
        if (grantErr) {
          console.error('[redeem] grant failed:', grantErr)
          return Response.json({ error: 'Could not grant credits.' }, { status: 500 })
        }

        // Record redemption + increment uses
        await admin.from('promo_redemptions').insert({
          user_id: user.id,
          code,
          bonus_granted: promo.bonus_credits,
        })
        await admin.from('promo_codes')
          .update({ uses: promo.uses + 1 })
          .eq('code', code)

        return Response.json({
          ok: true,
          message: `Redeemed! +${promo.bonus_credits} bonus credits added to your account.`,
          granted: promo.bonus_credits,
        })
      }
      return Response.json({ error: 'Invalid code.' }, { status: 400 })
    }

    // ── Referral code (KIV-XXXXXX) ──
    const { data: referral, error: refErr } = await admin
      .from('referral_codes')
      .select('code, user_id')
      .eq('code', code)
      .single()

    if (!referral || refErr) {
      return Response.json({ error: 'Invalid referral code.' }, { status: 400 })
    }

    // Can't redeem your own code
    if (referral.user_id === user.id) {
      return Response.json({ error: 'You cannot redeem your own referral code.' }, { status: 400 })
    }

    // Check if user already redeemed any referral
    const { data: existingRedemption } = await admin
      .from('referral_redemptions')
      .select('id')
      .eq('new_user_id', user.id)
      .maybeSingle()
    if (existingRedemption) {
      return Response.json({ error: 'You have already redeemed a referral code.' }, { status: 400 })
    }

    const BONUS = 25

    // Grant the new user 25 credits
    const { error: newUserGrantErr } = await admin.rpc('grant_credits', {
      p_user_id: user.id,
      p_amount: BONUS,
      p_action: 'referral_bonus',
      p_description: `Welcome bonus from referral ${code}`,
      p_metadata: { code, referrer_id: referral.user_id, role: 'new_user' },
    })
    if (newUserGrantErr) {
      console.error('[redeem] new user grant failed:', newUserGrantErr)
      return Response.json({ error: 'Could not grant welcome bonus.' }, { status: 500 })
    }

    // Grant the referrer 25 credits
    const { error: referrerGrantErr } = await admin.rpc('grant_credits', {
      p_user_id: referral.user_id,
      p_amount: BONUS,
      p_action: 'referral_bonus',
      p_description: `Referral bonus: ${user.email} signed up with your code`,
      p_metadata: { code, new_user_id: user.id, role: 'referrer' },
    })
    if (referrerGrantErr) {
      console.error('[redeem] referrer grant failed:', referrerGrantErr)
      // Don't fail the user's redemption — they got their credits
    }

    // Record the redemption
    await admin.from('referral_redemptions').insert({
      referrer_id: referral.user_id,
      new_user_id: user.id,
      code,
      bonus_granted: BONUS,
    })

    // Update referral stats
    await admin.from('referral_codes')
      .update({
        total_signups: 1, // will increment below
        total_credits_earned: BONUS,
      })
      .eq('code', code)
    // Actually increment (the above sets; let's do an RPC-style increment)
    const { data: refData } = await admin
      .from('referral_codes')
      .select('total_signups, total_credits_earned')
      .eq('code', code)
      .single()
    if (refData) {
      await admin.from('referral_codes')
        .update({
          total_signups: (refData.total_signups || 0) + 1,
          total_credits_earned: (refData.total_credits_earned || 0) + BONUS,
        })
        .eq('code', code)
    }

    return Response.json({
      ok: true,
      message: `Welcome bonus! +${BONUS} credits added.`,
      granted: BONUS,
    })
  } catch (err) {
    console.error('[redeem] error:', err)
    return Response.json({ error: 'Server error.' }, { status: 500 })
  }
}
