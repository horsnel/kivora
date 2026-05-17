export const runtime = 'edge'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function GET(req) {
  try {
    const admin = getSupabaseAdmin()
    if (!admin) {
      return Response.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // Verify admin access — check for user_id header set by the client
    const userId = req.headers.get('x-user-id')
    if (!userId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('is_admin')
      .eq('id', userId)
      .single()

    if (profileError || !profile?.is_admin) {
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
