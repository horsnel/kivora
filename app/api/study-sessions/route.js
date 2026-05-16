export const runtime = 'edge'
import { getSupabaseAdmin } from '@/lib/supabase'

// GET — fetch sessions for a user (for Dashboard)
// Uses user_id query param + service role key (bypasses RLS)
export async function GET(req) {
  try {
    const admin = getSupabaseAdmin()
    if (!admin) return Response.json({ error: 'Server configuration error' }, { status: 500 })

    const url = new URL(req.url)
    const userId = url.searchParams.get('user_id')
    const range = url.searchParams.get('range') || 'week'

    if (!userId) return Response.json({ error: 'user_id is required' }, { status: 400 })

    let query = admin
      .from('study_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (range === 'week') {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
      query = query.gte('created_at', weekAgo)
    } else if (range === 'month') {
      const monthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
      query = query.gte('created_at', monthAgo)
    }

    const { data, error } = await query.limit(500)
    if (error) throw error

    const sessions = data || []
    const totalTimeMs = sessions.reduce((sum, s) => {
      if (s.ended_at && s.started_at) {
        return sum + (new Date(s.ended_at) - new Date(s.started_at))
      }
      return sum
    }, 0)

    const toolBreakdown = {}
    sessions.forEach(s => {
      if (!toolBreakdown[s.tool_type]) {
        toolBreakdown[s.tool_type] = { count: 0, timeMs: 0 }
      }
      toolBreakdown[s.tool_type].count++
      if (s.ended_at && s.started_at) {
        toolBreakdown[s.tool_type].timeMs += (new Date(s.ended_at) - new Date(s.started_at))
      }
    })

    const subjectBreakdown = {}
    sessions.forEach(s => {
      if (s.subject) {
        subjectBreakdown[s.subject] = (subjectBreakdown[s.subject] || 0) + 1
      }
    })

    return Response.json({
      sessions,
      stats: {
        totalSessions: sessions.length,
        totalTimeMs,
        toolBreakdown,
        subjectBreakdown,
      }
    })
  } catch (err) {
    return Response.json({ error: err.message || 'Something went wrong' }, { status: 500 })
  }
}

// POST — start a new study session
export async function POST(req) {
  try {
    const admin = getSupabaseAdmin()
    if (!admin) return Response.json({ error: 'Server configuration error' }, { status: 500 })

    const { user_id, tool_type, subject, input_summary } = await req.json()
    if (!user_id || !tool_type) return Response.json({ error: 'user_id and tool_type are required' }, { status: 400 })

    const { data, error } = await admin
      .from('study_sessions')
      .insert({
        user_id,
        tool_type,
        subject: subject || null,
        input_summary: input_summary?.slice(0, 200) || null,
        started_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) throw error
    return Response.json({ id: data.id })
  } catch (err) {
    return Response.json({ error: err.message || 'Something went wrong' }, { status: 500 })
  }
}

// PATCH — end a session or mark events
export async function PATCH(req) {
  try {
    const admin = getSupabaseAdmin()
    if (!admin) return Response.json({ error: 'Server configuration error' }, { status: 500 })

    const { id, user_id, ended_at, result_copied, follow_up_asked } = await req.json()
    if (!id || !user_id) return Response.json({ error: 'id and user_id are required' }, { status: 400 })

    const updates = {}
    if (ended_at) updates.ended_at = ended_at
    if (result_copied !== undefined) updates.result_copied = result_copied
    if (follow_up_asked !== undefined) updates.follow_up_asked = follow_up_asked

    const { error } = await admin
      .from('study_sessions')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user_id)

    if (error) throw error
    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message || 'Something went wrong' }, { status: 500 })
  }
}
