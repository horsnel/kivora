// POST /api/push/subscribe — register (or refresh) a Web Push subscription
// DELETE /api/push/subscribe — remove a subscription (endpoint in body)
// Auth: Supabase bearer token (anonymous users can't have subscriptions —
// they have no identity to deliver to after the tab closes anyway).
import { resolveUserAndAdmin } from '@/lib/authUser'
import { getSupabaseAdmin } from '@/lib/supabase'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req) {
  const { user } = await resolveUserAndAdmin(req)
  if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 })
  const admin = getSupabaseAdmin()
  if (!admin) return Response.json({ error: 'Service not configured' }, { status: 503 })

  const body = await req.json().catch(() => null)
  const endpoint = String(body?.subscription?.endpoint || '')
  const p256dh = String(body?.subscription?.keys?.p256dh || '')
  const auth = String(body?.subscription?.keys?.auth || '')
  if (!/^https:\/\//.test(endpoint) || endpoint.length > 2048 || !p256dh || !auth) {
    return Response.json({ error: 'Invalid subscription' }, { status: 400 })
  }

  const row = {
    user_id: user.id,
    endpoint,
    p256dh: p256dh.slice(0, 512),
    auth: auth.slice(0, 256),
    user_agent: (req.headers.get('user-agent') || '').slice(0, 300) || null,
  }
  const { error } = await admin
    .from('push_subscriptions')
    .upsert(row, { onConflict: 'endpoint' })
  if (error) return Response.json({ error: 'Failed to save subscription' }, { status: 500 })
  return Response.json({ ok: true })
}

export async function DELETE(req) {
  const { user } = await resolveUserAndAdmin(req)
  if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 })
  const admin = getSupabaseAdmin()
  if (!admin) return Response.json({ error: 'Service not configured' }, { status: 503 })

  const body = await req.json().catch(() => null)
  const endpoint = String(body?.endpoint || '')
  if (!endpoint || endpoint.length > 2048 || !UUID_RE.test(user.id)) {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }
  await admin.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('user_id', user.id)
  return Response.json({ ok: true })
}
