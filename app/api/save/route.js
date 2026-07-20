export const runtime = 'edge' 
import { getSupabaseAdmin } from '@/lib/supabase'

// Uses user_id from body/query + service role key (bypasses RLS).
// Client validates auth before calling — API trusts user_id from client.

// GET — check if a result is saved by a user
export async function GET(req) {
  try {
    const admin = getSupabaseAdmin()
    if (!admin) {
      return Response.json({ error: 'Database not configured' }, { status: 503 })
    }

    const url = new URL(req.url)
    const userId = url.searchParams.get('user_id')
    const slug = url.searchParams.get('slug')
    if (!userId || !slug) {
      return Response.json({ error: 'user_id and slug required' }, { status: 400 })
    }

    const { data } = await admin
      .from('saved_results')
      .select('id')
      .eq('user_id', userId)
      .eq('result_slug', slug)
      .single()

    return Response.json({ saved: !!data })
  } catch {
    return Response.json({ saved: false })
  }
}

// POST — save a result
export async function POST(req) {
  try {
    const admin = getSupabaseAdmin()
    if (!admin) {
      return Response.json({ error: 'Database not configured' }, { status: 503 })
    }

    const { userId, query, resultSlug } = await req.json()
    if (!userId || !resultSlug) {
      return Response.json({ error: 'userId and resultSlug required' }, { status: 400 })
    }

    // Check for duplicate
    const { data: existing } = await admin
      .from('saved_results')
      .select('id')
      .eq('user_id', userId)
      .eq('result_slug', resultSlug)
      .single()

    if (existing) {
      return Response.json({ saved: true, duplicate: true })
    }

    await admin.from('saved_results').insert({
      user_id: userId,
      query,
      result_slug: resultSlug
    })

    return Response.json({ saved: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

// DELETE — unsave a result
export async function DELETE(req) {
  try {
    const admin = getSupabaseAdmin()
    if (!admin) {
      return Response.json({ error: 'Database not configured' }, { status: 503 })
    }

    const { userId, resultSlug } = await req.json()
    if (!userId || !resultSlug) {
      return Response.json({ error: 'userId and resultSlug required' }, { status: 400 })
    }

    await admin
      .from('saved_results')
      .delete()
      .eq('user_id', userId)
      .eq('result_slug', resultSlug)

    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
