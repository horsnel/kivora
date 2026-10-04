export const runtime = 'edge'
import { getSupabaseAdmin } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { getEnvVar } from '@/lib/cfEnv'

export async function GET(req) {
  try {
    const admin = getSupabaseAdmin()
    if (!admin) {
      return Response.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // ── Auth (two paths, both server-verified) ──
    // 1. Admin password sent as x-admin-key (checked against ADMIN_PASSWORD env var)
    // 2. Supabase JWT via Authorization: Bearer — must belong to a profile with is_admin
    // NOTE: client-supplied user IDs are never trusted — identity comes from the JWT.
    const adminKey = req.headers.get('x-admin-key')
    const envPassword = await getEnvVar('ADMIN_PASSWORD')

    let authorized = false

    if (envPassword && adminKey && adminKey === envPassword) {
      authorized = true
    } else {
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
            if (profile?.is_admin) authorized = true
          }
        } catch { /* invalid token — unauthorized */ }
      }
    }

    if (!authorized) {
      return Response.json({ error: 'Forbidden — admin access required' }, { status: 403 })
    }

    // Fetch all metrics in parallel
    const [
      usersResult,
      chatsResult,
      exploreResult,
      contactsResult,
      sessionsResult,
      recentSignupsResult,
      recentSessionsResult,
    ] = await Promise.all([
      admin.from('profiles').select('id', { count: 'exact', head: true }),
      admin.from('chat_sessions').select('id', { count: 'exact', head: true }),
      admin.from('explore_cache').select('id', { count: 'exact', head: true }),
      admin.from('contact_submissions').select('id', { count: 'exact', head: true }),
      admin.from('study_sessions').select('id', { count: 'exact', head: true }),
      admin.from('profiles').select('id, email, display_name, created_at').order('created_at', { ascending: false }).limit(10),
      admin.from('study_sessions').select('id, user_id, tool_type, subject, created_at').order('created_at', { ascending: false }).limit(20),
    ])

    return Response.json({
      metrics: {
        totalUsers: usersResult.count || 0,
        totalChats: chatsResult.count || 0,
        totalExplore: exploreResult.count || 0,
        totalContacts: contactsResult.count || 0,
        totalSessions: sessionsResult.count || 0,
      },
      recentSignups: recentSignupsResult.data || [],
      recentActivity: recentSessionsResult.data || [],
    })
  } catch (err) {
    return Response.json({ error: err.message || 'Something went wrong' }, { status: 500 })
  }
}
