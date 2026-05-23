export const runtime = 'edge'
import { getSupabaseAdmin } from '@/lib/supabase'

export async function POST(req) {
  try {
    const admin = getSupabaseAdmin()
    if (!admin) return Response.json({ error: 'Server configuration error' }, { status: 500 })

    const { userId } = await req.json()
    if (!userId) return Response.json({ error: 'userId is required' }, { status: 400 })

    // Delete the user from auth.users — cascading deletes handle profiles, study_sessions, etc.
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) throw error

    return Response.json({ success: true })
  } catch (err) {
    console.error('[profile/delete]', err)
    return Response.json({ error: err.message || 'Failed to delete account' }, { status: 500 })
  }
}
