export const runtime = 'edge'
import { getSupabaseAdmin } from '@/lib/supabase'

// Uses user_id from body + service role key (bypasses RLS).
// Client validates auth before calling — API trusts user_id from client.

export async function POST(req) {
  try {
    const admin = getSupabaseAdmin()
    if (!admin) {
      return Response.json({ error: 'Database not configured' }, { status: 503 })
    }

    const { userId, goal, experience, location, interests } = await req.json()
    if (!userId) return Response.json({ error: 'userId required' }, { status: 400 })

    await admin.from('profiles').update({
      onboarding_done: true,
      onboarding_goal: goal,
      onboarding_experience: experience,
      onboarding_location: location,
      onboarding_interests: interests || [],
    }).eq('id', userId)

    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
