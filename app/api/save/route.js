export const runtime = 'edge'
import { getSupabaseAdmin } from '@/lib/supabase'
import { resolveUserAndAdmin } from '@/lib/authUser'

// SECURITY: the user identity is ALWAYS derived from the Supabase JWT
// (Authorization: Bearer header) — never from the query string or body.
// Service-role client is used only for the lookup after auth.

// GET — check if a result is saved by the authenticated user
export async function GET(req) {
  try {
    const { user, admin } = await resolveUserAndAdmin(req)
    if (!admin) {
      return Response.json({ error: 'Database not configured' }, { status: 503 })
    }
    if (!user) {
      return Response.json({ saved: false })
    }

    const url = new URL(req.url)
    const slug = url.searchParams.get('slug')
    if (!slug) {
      return Response.json({ error: 'slug required' }, { status: 400 })
    }

    const { data } = await admin
      .from('saved_results')
      .select('id')
      .eq('user_id', user.id)
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
    const { user, admin } = await resolveUserAndAdmin(req)
    if (!admin) {
      return Response.json({ error: 'Database not configured' }, { status: 503 })
    }
    if (!user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { query, resultSlug } = await req.json()
    if (!resultSlug) {
      return Response.json({ error: 'resultSlug required' }, { status: 400 })
    }

    // Check for duplicate
    const { data: existing } = await admin
      .from('saved_results')
      .select('id')
      .eq('user_id', user.id)
      .eq('result_slug', resultSlug)
      .single()

    if (existing) {
      return Response.json({ saved: true, duplicate: true })
    }

    await admin.from('saved_results').insert({
      user_id: user.id,
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
    const { user, admin } = await resolveUserAndAdmin(req)
    if (!admin) {
      return Response.json({ error: 'Database not configured' }, { status: 503 })
    }
    if (!user) {
      return Response.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { resultSlug } = await req.json()
    if (!resultSlug) {
      return Response.json({ error: 'resultSlug required' }, { status: 400 })
    }

    await admin
      .from('saved_results')
      .delete()
      .eq('user_id', user.id)
      .eq('result_slug', resultSlug)

    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
