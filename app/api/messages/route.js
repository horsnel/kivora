export const runtime = 'edge'
import { getSupabaseAdmin } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { getEnvVar } from '@/lib/cfEnv'

// SECURITY: contact submissions are admin-only. Access requires either the
// admin password (x-admin-key, checked against ADMIN_PASSWORD env var) or a
// Supabase JWT belonging to a profile with is_admin = true.

async function requireAdmin(req, admin) {
  const adminKey = req.headers.get('x-admin-key')
  const envPassword = await getEnvVar('ADMIN_PASSWORD')

  if (envPassword && adminKey && adminKey === envPassword) return true

  const authHeader = req.headers.get('authorization') || ''
  const accessToken = authHeader.replace(/^Bearer\s+/i, '')
  const supaUrl = await getEnvVar('NEXT_PUBLIC_SUPABASE_URL')
  const supaAnon = await getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY')

  if (accessToken && supaUrl && supaAnon) {
    try {
      const userClient = createClient(supaUrl, supaAnon, {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
      })
      const { data: { user } } = await userClient.auth.getUser()
      if (user) {
        const { data: profile } = await admin
          .from('profiles')
          .select('is_admin')
          .eq('id', user.id)
          .single()
        if (profile?.is_admin) return true
      }
    } catch { /* invalid token */ }
  }

  return false
}

export async function GET(req) {
  try {
    const admin = getSupabaseAdmin()
    if (!admin) {
      return Response.json({ error: 'Database not configured' }, { status: 503 })
    }

    if (!(await requireAdmin(req, admin))) {
      return Response.json({ error: 'Forbidden — admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(req.url)
    const markRead = searchParams.get('markRead')

    // If marking as read
    if (markRead) {
      await admin.from('contact_submissions').update({ read: true }).eq('id', markRead)
      return Response.json({ success: true })
    }

    // Fetch all submissions (admin view for the site owner)
    const { data, error } = await admin
      .from('contact_submissions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error

    return Response.json({ submissions: data })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req) {
  try {
    const admin = getSupabaseAdmin()
    if (!admin) {
      return Response.json({ error: 'Database not configured' }, { status: 503 })
    }

    if (!(await requireAdmin(req, admin))) {
      return Response.json({ error: 'Forbidden — admin access required' }, { status: 403 })
    }

    const { id } = await req.json()
    if (!id) return Response.json({ error: 'id required' }, { status: 400 })

    const { error } = await admin.from('contact_submissions').delete().eq('id', id)
    if (error) throw error

    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
