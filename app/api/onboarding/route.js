export const runtime = 'edge'
import { getSupabaseAdmin } from '@/lib/supabase'
import { resolveUserAndAdmin } from '@/lib/authUser'

// SECURITY: the profile being updated is derived from the Supabase JWT —
// the userId in the body is ignored.
export async function POST(req) {
  try {
    const { user, admin } = await resolveUserAndAdmin(req)
    if (!admin) {
      return Response.json({ error: 'Database not configured' }, { status: 503 })
    }
    if (!user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { goal, experience, location, interests } = await req.json()

    await admin.from('profiles').update({
      onboarding_done: true,
      onboarding_goal: goal,
      onboarding_experience: experience,
      onboarding_location: location,
      onboarding_interests: interests || [],
    }).eq('id', user.id)

    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
