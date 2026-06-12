export const runtime = 'edge'

import { getSupabaseAdmin } from '@/lib/supabase'

// ══════════════════════════════════════════════════════════════════
// APEX 2.0 WIKI API — Read wiki pages, get full page data
// GET /api/apex/wiki?slug=...  — Get wiki page by slug
// GET /api/apex/wiki?q=...     — Search wiki pages
// GET /api/apex/wiki           — List recent wiki pages
// ══════════════════════════════════════════════════════════════════

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('slug')
  const query = searchParams.get('q')
  const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50)
  const lifecycle = searchParams.get('lifecycle')

  const admin = getSupabaseAdmin()
  if (!admin) {
    return Response.json({ error: 'Database not configured' }, { status: 503 })
  }

  try {
    // Get wiki page by slug with full data
    if (slug) {
      const { data: page, error: pageErr } = await admin
        .from('apex_wiki_pages')
        .select('*')
        .eq('slug', slug)
        .single()

      if (pageErr || !page) {
        return Response.json({ error: 'Wiki page not found' }, { status: 404 })
      }

      // Get sources
      const { data: sources } = await admin
        .from('apex_wiki_sources')
        .select('*')
        .eq('page_id', page.id)
        .order('adjusted_score', { ascending: false })

      // Get claims
      const { data: claims } = await admin
        .from('apex_claim_verifications')
        .select('*')
        .eq('page_id', page.id)

      // Update access count
      await admin
        .from('apex_wiki_pages')
        .update({
          access_count: page.access_count + 1,
          last_accessed_at: new Date().toISOString(),
        })
        .eq('id', page.id)

      return Response.json({
        page: {
          id: page.id,
          slug: page.slug,
          title: page.title,
          content: page.content,
          lifecycle: page.lifecycle,
          topic: page.topic,
          category: page.category,
          depth: page.depth,
          sourceCount: page.source_count,
          p1Count: page.p1_count,
          p2Count: page.p2_count,
          p3Count: page.p3_count,
          epistemicSummary: page.epistemic_summary,
          confidenceScore: page.confidence_score,
          version: page.version,
          compiledBy: page.compiled_by,
          compilationModel: page.compilation_model,
          createdAt: page.created_at,
          updatedAt: page.updated_at,
          lastVerifiedAt: page.last_verified_at,
          accessCount: page.access_count + 1,
          staleAfterDays: page.stale_after_days,
        },
        sources: sources || [],
        claims: claims || [],
      })
    }

    // Search wiki pages
    if (query) {
      const { data: pages, error } = await admin
        .from('apex_wiki_pages')
        .select('id, slug, title, lifecycle, category, confidence_score, source_count, version, updated_at')
        .or(`title.ilike.%${query}%,topic.ilike.%${query}%`)
        .order('confidence_score', { ascending: false })
        .limit(limit)

      if (error) {
        return Response.json({ error: error.message }, { status: 500 })
      }

      return Response.json({ pages: pages || [], total: pages?.length || 0 })
    }

    // List recent wiki pages
    let dbQuery = admin
      .from('apex_wiki_pages')
      .select('id, slug, title, lifecycle, category, confidence_score, source_count, version, updated_at', { count: 'exact' })
      .order('updated_at', { ascending: false })
      .limit(limit)

    if (lifecycle) {
      dbQuery = dbQuery.eq('lifecycle', lifecycle)
    }

    const { data: pages, count, error } = await dbQuery

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ pages: pages || [], total: count || 0 })
  } catch (err) {
    console.error('[APEX Wiki] GET error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
