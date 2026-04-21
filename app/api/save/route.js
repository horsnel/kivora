import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req) {
  try {
    if (!supabaseAdmin) {
      return Response.json({ error: 'Database not configured' }, { status: 503 })
    }
    const { userId, query, resultSlug } = await req.json()
    if (!userId || !resultSlug) {
      return Response.json({ error: 'userId and resultSlug required' }, { status: 400 })
    }

    // Check for duplicate
    const { data: existing } = await supabaseAdmin
      .from('saved_results')
      .select('id')
      .eq('user_id', userId)
      .eq('result_slug', resultSlug)
      .single()

    if (existing) {
      return Response.json({ saved: true, duplicate: true })
    }

    await supabaseAdmin.from('saved_results').insert({
      user_id: userId,
      query,
      result_slug: resultSlug
    })

    return Response.json({ saved: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
