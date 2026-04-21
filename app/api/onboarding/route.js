import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req) {
  try {
    const { userId, goal, experience, location, interests } = await req.json()
    if (!userId) return Response.json({ error: 'userId required' }, { status: 400 })

    await supabaseAdmin.from('profiles').update({
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
