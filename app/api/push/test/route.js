// ── POST /api/push/test — v5.24 push-chain diagnostic ────────────────
// Sends a real test notification to every device registered for the
// signed-in user and returns a structured verdict, so "I never get push"
// stops being a guessing game:
//
//   { ok: true,  devices: 1, sent: 1 }                → chain works end-to-end
//   { ok: false, reason: 'no_subscriptions', ... }    → toggle never reached the server
//   { ok: false, reason: 'not_configured' }           → VAPID env missing
//   { ok: false, reason: 'db_error' }                 → push_subscriptions unreadable
//   { ok: false, reason: 'delivery_failed', ... }     → push service rejected (see error)
//
// Auth-gated (same contract as /api/push/subscribe). Dead subscriptions
// (404/410) are pruned as a side effect of the real send.
import { resolveUserAndAdmin } from '@/lib/authUser'
import { getSupabaseAdmin } from '@/lib/supabase'
import { sendPushToUser } from '@/lib/push'
import { getEnvVar } from '@/lib/cfEnv'

// Required for Cloudflare Pages edge runtime
export const runtime = 'edge'

export async function POST(req) {
  const { user } = await resolveUserAndAdmin(req)
  if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 })
  const admin = getSupabaseAdmin()
  if (!admin) return Response.json({ ok: false, reason: 'service_unconfigured' }, { status: 503 })

  // Count registered devices first so the UI can tell "nothing registered"
  // apart from "registered but delivery failed". last_receipt (v5.24.5) is
  // the device-side verdict from the previous test, posted by the service
  // worker itself — it survives page closes and phone reboots.
  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, created_at, last_receipt')
    .eq('user_id', user.id)
  if (error) return Response.json({ ok: false, reason: 'db_error' }, { status: 500 })

  const result = await sendPushToUser(admin, user.id, {
    title: 'Kivora',
    body: 'Test notification — the push chain works end to end.',
    tag: 'kivora-push-test',
    url: '/profile',
  }, getEnvVar)

  const sent = result?.sent || 0
  const latest = (subs || []).slice().sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))[0] || null
  return Response.json({
    ok: sent > 0,
    reason: result?.skipped || (sent > 0 ? null : 'delivery_failed'),
    devices: subs?.length || 0,
    sent,
    total: result?.total ?? (subs?.length || 0),
    error: result?.error || null,
    last_receipt: latest?.last_receipt || null,
    endpoint_tail: latest?.endpoint ? String(latest.endpoint).slice(-24) : null,
    subscription_created: latest?.created_at || null,
  })
}
