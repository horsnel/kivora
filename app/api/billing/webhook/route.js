export const runtime = 'edge'

import { createClient } from '@supabase/supabase-js'
import { getEnvVar } from '@/lib/cfEnv'
import { verifyWebhookSignature } from '@/lib/paystack'

/**
 * POST /api/billing/webhook
 *
 * Paystack webhook receiver. Paystack fires this for every transaction event:
 *   - charge.success  → upgrade the user's plan
 *   - charge.failed   → mark order as failed
 *   - subscription.disable → downgrade to free
 *
 * We MUST verify the signature using PAYSTACK_SECRET_KEY before processing.
 *
 * Configure the webhook URL in your Paystack dashboard:
 *   Settings → API Keys & Webhooks → Webhook → Add
 *   URL: https://kivora.pages.dev/api/billing/webhook
 */
export async function POST(req) {
  try {
    const payload = await req.text()
    const signature = req.headers.get('x-paystack-signature') || ''

    // ── Verify webhook signature ──
    const isValid = await verifyWebhookSignature(payload, signature)
    if (!isValid) {
      console.warn('[webhook] invalid signature — rejecting')
      return new Response('Invalid signature', { status: 401 })
    }

    const event = JSON.parse(payload)
    const eventType = event.event
    const txn = event.data

    console.log(`[webhook] received: ${eventType} ref=${txn?.reference}`)

    const supaUrl = await getEnvVar('NEXT_PUBLIC_SUPABASE_URL')
    const serviceKey = await getEnvVar('SUPABASE_SERVICE_ROLE_KEY')
    if (!supaUrl || !serviceKey) {
      console.error('[webhook] server not configured')
      return new Response('Server not configured', { status: 500 })
    }
    const admin = createClient(supaUrl, serviceKey)

    // ── Handle charge.success ──
    if (eventType === 'charge.success') {
      const reference = txn.reference
      const { data: order, error: orderErr } = await admin
        .from('paystack_orders')
        .select('*')
        .eq('reference', reference)
        .single()

      if (orderErr || !order) {
        console.warn(`[webhook] order not found for ref=${reference} —可能是 direct Paystack payment without Kivora order row`)
        return new Response('OK', { status: 200 })
      }

      // Already processed — idempotent
      if (order.status === 'success') {
        console.log(`[webhook] order ${reference} already processed`)
        return new Response('OK', { status: 200 })
      }

      // Update order
      await admin.from('paystack_orders').update({
        status: 'success',
        paystack_transaction_id: txn.id,
        paystack_response: txn,
        verified_at: new Date().toISOString(),
      }).eq('reference', reference)

      // Upgrade the user's plan
      const { error: upgradeErr } = await admin.rpc('upgrade_user_plan', {
        p_user_id: order.user_id,
        p_new_plan_code: order.plan_code,
        p_billing_cycle: order.billing_cycle,
        p_paystack_ref: reference,
      })
      if (upgradeErr) {
        console.error('[webhook] upgrade_user_plan failed:', upgradeErr)
      } else {
        console.log(`[webhook] upgraded user ${order.user_id} → ${order.plan_code}`)
      }
    }

    // ── Handle subscription.disable (user cancelled via Paystack dashboard) ──
    if (eventType === 'subscription.disable') {
      const subscriptionCode = txn.subscription_code
      // Downgrade the user to free at the end of their current cycle
      // We don't immediately revoke credits — they paid for this cycle already
      const { data: order } = await admin
        .from('paystack_orders')
        .select('user_id')
        .eq('paystack_response->>subscription_code', String(subscriptionCode))
        .limit(1)
        .single()
      if (order) {
        // Mark current_period_end as the natural end; monthly cron will downgrade to free
        // when current_period_end passes
        console.log(`[webhook] subscription cancelled for user ${order.user_id}; will downgrade at period end`)
      }
    }

    // ── Handle charge.failed ──
    if (eventType === 'charge.failed') {
      const reference = txn.reference
      await admin.from('paystack_orders').update({
        status: 'failed',
        paystack_response: txn,
        verified_at: new Date().toISOString(),
      }).eq('reference', reference)
    }

    return new Response('OK', { status: 200 })
  } catch (err) {
    console.error('[webhook] error:', err)
    return new Response('Server error', { status: 500 })
  }
}
