export const runtime = 'edge'
import { getSupabaseAdmin } from '@/lib/supabase'
import { resolveUserAndAdmin } from '@/lib/authUser'

// SECURITY: account deletion requires a valid Supabase JWT and only ever
// deletes the authenticated user's own account. The userId in the request
// body is ignored — identity is derived from the token server-side.
export async function POST(req) {
  try {
    const { user, admin } = await resolveUserAndAdmin(req)
    if (!admin) return Response.json({ error: 'Server configuration error' }, { status: 500 })
    if (!user) return Response.json({ error: 'Authentication required' }, { status: 401 })

    // Delete the authenticated user from auth.users — cascading deletes handle profiles, study_sessions, etc.
    const { error } = await admin.auth.admin.deleteUser(user.id)
    if (error) throw error

    return Response.json({ success: true })
  } catch (err) {
    console.error('[profile/delete]', err)
    return Response.json({ error: err.message || 'Failed to delete account' }, { status: 500 })
  }
}
