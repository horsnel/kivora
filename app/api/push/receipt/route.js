// ── POST /api/push/receipt — v5.24.5 device-side push telemetry ─────
// The service worker POSTs here after every push display attempt, keyed by
// the subscription endpoint's unguessable 24-char suffix. The verdict lands
// in push_subscriptions.last_receipt so it SURVIVES page closes and phone
// reboots — the profile test then reads it back server-side.
//
// No session auth by design (SW context has none), but the tail must match
// an existing row's endpoint suffix — a 24-char random URL fragment, not
// guessable, and the only thing writable is a diagnostic verdict.
import { getSupabaseAdmin } from '@/lib/supabase'

export const runtime = 'edge'

export async function POST(req) {
  const b = await req.json().catch(() => null)
  const tail = String(b?.tail || '').replace(/[^A-Za-z0-9_-]/g, '')
  if (tail.length < 8) return Response.json({ ok: false, reason: 'bad_tail' }, { status: 400 })
  const admin = getSupabaseAdmin()
  if (!admin) return Response.json({ ok: false, reason: 'service_unconfigured' }, { status: 503 })

  const { data, error } = await admin
    .from('push_subscriptions')
    .select('id, last_receipt')
    .like('endpoint', `%${tail}`)
  if (error || !data?.length) {
    return Response.json({ ok: false, reason: error ? 'db_error' : 'unknown_endpoint' }, { status: error ? 500 : 404 })
  }

  const incoming = {
    displayed: !!b.displayed,
    error: b.error ? String(b.error).slice(0, 160) : null,
    sw: String(b.sw || '').slice(0, 24),
    at: Number(b.at) || Date.now(),
  }
  const row = data[0]
  const prevAt = (row?.last_receipt && Number(row.last_receipt.at)) || 0
  if (incoming.at >= prevAt) {
    const { error: upErr } = await admin
      .from('push_subscriptions')
      .update({ last_receipt: incoming })
      .eq('id', row.id)
    if (upErr) return Response.json({ ok: false, reason: 'db_error' }, { status: 500 })
  }
  return Response.json({ ok: true })
}
