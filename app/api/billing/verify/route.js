export const runtime = 'edge' 

import { createClient } from '@supabase/supabase-js'
import { getEnvVar } from '@/lib/cfEnv'
import { verifyTransaction } from '@/lib/paystack'

/**
 * GET /api/billing/verify?reference=kivora-...
 *
 * Called by Paystack after the user completes checkout. We:
 *   1. Verify the transaction with Paystack's API (don't trust the redirect URL)
 *   2. Update the paystack_orders row to 'success'
 *   3. Call upgrade_user_plan() to upgrade the user's plan and refill credits
 *   4. Redirect to /pricing?upgrade=success
 *
 * If verification fails, we redirect to /pricing?upgrade=failed
 */
export async function GET(req) {
  const url = new URL(req.url)
  const reference = url.searchParams.get('reference')

  if (!reference) {
    return Response.redirect(new URL('/pricing?upgrade=failed&reason=missing_reference', url.origin))
  }

  try {
    const supaUrl = await getEnvVar('NEXT_PUBLIC_SUPABASE_URL')
    const serviceKey = await getEnvVar('SUPABASE_SERVICE_ROLE_KEY')
    if (!supaUrl || !serviceKey) {
      return Response.redirect(new URL('/pricing?upgrade=failed&reason=server_config', url.origin))
    }

    const admin = createClient(supaUrl, serviceKey)

    // ── Fetch the order ──
    const { data: order, error: orderErr } = await admin
      .from('paystack_orders')
      .select('*')
      .eq('reference', reference)
      .single()

    if (orderErr || !order) {
      console.error('[verify] order not found:', reference, orderErr)
      return Response.redirect(new URL('/pricing?upgrade=failed&reason=order_not_found', url.origin))
    }

    // ── If already verified, redirect with success ──
    if (order.status === 'success') {
      return Response.redirect(new URL(`/pricing?upgrade=success&plan=${order.plan_code}`, url.origin))
    }

    // ── Verify with Paystack ──
    const txn = await verifyTransaction(reference)

    if (txn.status !== 'success') {
      // Mark order as failed
      await admin.from('paystack_orders').update({
        status: txn.status === 'abandoned' ? 'abandoned' : 'failed',
        paystack_response: txn,
        verified_at: new Date().toISOString(),
      }).eq('reference', reference)

      return Response.redirect(new URL(`/pricing?upgrade=failed&reason=${txn.status}`, url.origin))
    }

    // ── Cross-check: amount & currency must match the order ──
    if (txn.amount !== order.amount_kobo || (txn.currency || 'NGN') !== order.currency) {
      console.error('[verify] amount mismatch:', txn.amount, order.amount_kobo)
      await admin.from('paystack_orders').update({
        status: 'failed',
        paystack_response: txn,
        verified_at: new Date().toISOString(),
      }).eq('reference', reference)
      return Response.redirect(new URL('/pricing?upgrade=failed&reason=amount_mismatch', url.origin))
    }

    // ── Update the order to success ──
    await admin.from('paystack_orders').update({
      status: 'success',
      paystack_transaction_id: txn.id,
      paystack_response: txn,
      verified_at: new Date().toISOString(),
    }).eq('reference', reference)

    // ── Upgrade the user's plan ──
    const { data: upgradeResult, error: upgradeErr } = await admin.rpc('upgrade_user_plan', {
      p_user_id: order.user_id,
      p_new_plan_code: order.plan_code,
      p_billing_cycle: order.billing_cycle,
      p_paystack_ref: reference,
    })

    if (upgradeErr) {
      console.error('[verify] upgrade_user_plan failed:', upgradeErr)
      // Payment succeeded but upgrade failed — flag for manual review
      // User will see pending state; support can re-trigger
      return Response.redirect(new URL('/pricing?upgrade=pending&reason=upgrade_failed', url.origin))
    }

    console.log('[verify] upgrade success:', order.user_id, '→', order.plan_code)
    return Response.redirect(new URL(`/pricing?upgrade=success&plan=${order.plan_code}`, url.origin))
  } catch (err) {
    console.error('[verify] error:', err)
    return Response.redirect(new URL('/pricing?upgrade=failed&reason=server_error', url.origin))
  }
}
