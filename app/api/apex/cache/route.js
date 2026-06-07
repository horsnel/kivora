export const runtime = 'edge'

import { getSupabaseAdmin } from '@/lib/supabase'

// ══════════════════════════════════════════════════════════════════
// APEX 2.0 CACHE API — Hot cache for session continuity
// GET  /api/apex/cache          — Get hot cache for current user
// GET  /api/apex/cache?q=...    — Check if a query is cached
// POST /api/apex/cache          — Mark a cache entry as hot / store cache
// ══════════════════════════════════════════════════════════════════

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q')
  const mode = searchParams.get('mode') || 'quick'
  const apexTier = searchParams.get('apex_tier') || 'apex-free'

  const admin = getSupabaseAdmin()
  if (!admin) {
    return Response.json({ error: 'Database not configured' }, { status: 503 })
  }

  try {
    // Check if a specific query is cached
    if (query) {
      const normalized = query.toLowerCase().trim()
      const encoder = new TextEncoder()
      const data = encoder.encode(`${normalized}|${mode}|${apexTier}`)
      const hashBuffer = await crypto.subtle.digest('SHA-256', data)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

      const { data: cached, error } = await admin
        .from('apex_research_cache')
        .select('*')
        .eq('query_hash', hash)
        .gt('expires_at', new Date().toISOString())
        .single()

      if (error || !cached) {
        return Response.json({ cached: false })
      }

      // Update hit count
      await admin
        .from('apex_research_cache')
        .update({
          cache_hit_count: cached.cache_hit_count + 1,
          last_accessed_at: new Date().toISOString(),
        })
        .eq('id', cached.id)

      return Response.json({
        cached: true,
        id: cached.id,
        report: cached.report,
        sources: cached.sources,
        followups: cached.followups,
        verificationSummary: cached.verification_summary,
        mode: cached.mode,
        apexTier: cached.apex_tier,
        wikiPageId: cached.wiki_page_id,
        isHot: cached.is_hot,
        hitCount: cached.cache_hit_count + 1,
      })
    }

    // Get hot cache items for session continuity
    const { data, error } = await admin
      .from('apex_research_cache')
      .select('id, query_text, mode, is_hot, wiki_page_id, last_accessed_at, cache_hit_count')
      .eq('is_hot', true)
      .gt('expires_at', new Date().toISOString())
      .order('last_accessed_at', { ascending: false })
      .limit(10)

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ hotCache: data || [] })
  } catch (err) {
    console.error('[APEX Cache] GET error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Mark a cache entry as hot or store new cache
export async function POST(request) {
  const admin = getSupabaseAdmin()
  if (!admin) {
    return Response.json({ error: 'Database not configured' }, { status: 503 })
  }

  try {
    const body = await request.json()

    // Mark existing entry as hot
    if (body.cacheId) {
      const { error } = await admin
        .from('apex_research_cache')
        .update({ is_hot: body.isHot !== false })
        .eq('id', body.cacheId)

      if (error) {
        return Response.json({ error: error.message }, { status: 500 })
      }

      return Response.json({ success: true, cacheId: body.cacheId, isHot: body.isHot !== false })
    }

    // Store new cache entry
    if (body.query && body.report) {
      const normalized = body.query.toLowerCase().trim()
      const mode = body.mode || 'quick'
      const apexTier = body.apexTier || 'apex-free'
      const encoder = new TextEncoder()
      const hashData = encoder.encode(`${normalized}|${mode}|${apexTier}`)
      const hashBuffer = await crypto.subtle.digest('SHA-256', hashData)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')

      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7)

      const cacheData = {
        query_text: body.query,
        normalized_query: normalized,
        query_hash: hash,
        report: body.report,
        sources: JSON.stringify(body.sources || []),
        followups: JSON.stringify(body.followups || []),
        verification_summary: JSON.stringify(body.verificationSummary || {}),
        mode,
        apex_tier: apexTier,
        original_latency_ms: body.latencyMs || 0,
        wiki_page_id: body.wikiPageId || null,
        user_id: body.userId || null,
        expires_at: expiresAt.toISOString(),
      }

      // Upsert
      const { data: existing } = await admin
        .from('apex_research_cache')
        .select('id')
        .eq('query_hash', hash)

      if (existing && existing.length > 0) {
        await admin
          .from('apex_research_cache')
          .update(cacheData)
          .eq('id', existing[0].id)

        return Response.json({ success: true, cacheId: existing[0].id, action: 'updated' })
      } else {
        const { data: inserted } = await admin
          .from('apex_research_cache')
          .insert(cacheData)
          .select('id')

        return Response.json({ success: true, cacheId: inserted?.[0]?.id, action: 'created' })
      }
    }

    return Response.json({ error: 'cacheId or query+report required' }, { status: 400 })
  } catch (err) {
    console.error('[APEX Cache] POST error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
