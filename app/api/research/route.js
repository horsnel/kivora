export const runtime = 'edge'

import { rateLimit } from '@/lib/ratelimit'
import { getEnvVar } from '@/lib/cfEnv'
import { getSupabaseAdmin } from '@/lib/supabase'

// Kivora Research Worker endpoint (Cloudflare Worker)
const RESEARCH_WORKER_URL = 'https://kivora-research.odehebuka48.workers.dev/research'

/**
 * Compute a SHA-256 hash of the normalized query key.
 * Uses crypto.subtle (available in Edge runtime).
 */
async function computeQueryHash(normalized, mode, apexTier) {
  const encoder = new TextEncoder()
  const data = encoder.encode(`${normalized}|${mode}|${apexTier}`)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Fetch linked wiki page metadata from apex_wiki_pages.
 * Returns { wikiLifecycle, wikiSlug, wikiVersion } or null if not linked.
 */
async function getWikiMeta(admin, wikiPageId) {
  if (!wikiPageId) return null
  try {
    const { data: page, error } = await admin
      .from('apex_wiki_pages')
      .select('lifecycle, slug, version')
      .eq('id', wikiPageId)
      .single()

    if (error || !page) return null
    return {
      wikiLifecycle: page.lifecycle,
      wikiSlug: page.slug,
      wikiVersion: page.version,
    }
  } catch {
    return null
  }
}

/**
 * Check the APEX cache for an existing (non-expired) result.
 * Returns the cached row or null.
 */
async function checkCache(admin, queryHash, mode, apexTier) {
  try {
    const now = new Date().toISOString()
    const { data: cached, error } = await admin
      .from('apex_research_cache')
      .select('id, report, sources, followups, verification_summary, mode, apex_tier, cache_hit_count, wiki_page_id, is_hot, original_latency_ms')
      .eq('query_hash', queryHash)
      .eq('mode', mode)
      .eq('apex_tier', apexTier)
      .gt('expires_at', now)
      .single()

    if (error || !cached) return null
    return cached
  } catch {
    return null
  }
}

/**
 * Update cache hit count and last_accessed_at (fire-and-forget).
 */
async function recordCacheHit(admin, cacheId, currentHitCount) {
  try {
    await admin
      .from('apex_research_cache')
      .update({
        cache_hit_count: currentHitCount + 1,
        last_accessed_at: new Date().toISOString(),
      })
      .eq('id', cacheId)
  } catch (err) {
    console.error('[research] Cache hit update failed:', err?.message || err)
  }
}

/**
 * Store (upsert) a research result into the cache.
 * Returns the cache entry ID.
 */
async function storeCacheResult(admin, queryHash, queryText, normalized, mode, apexTier, result, latencyMs) {
  try {
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7)

    const cacheData = {
      query_text: queryText,
      normalized_query: normalized,
      query_hash: queryHash,
      report: result.report || '',
      sources: JSON.stringify(result.sources || []),
      followups: JSON.stringify(result.followups || []),
      verification_summary: JSON.stringify(result.verificationSummary || result.verification_summary || {}),
      mode,
      apex_tier: apexTier,
      original_latency_ms: latencyMs,
      expires_at: expiresAt.toISOString(),
      last_accessed_at: new Date().toISOString(),
    }

    // Check for existing entry by hash+mode+tier (unique index)
    const { data: existing } = await admin
      .from('apex_research_cache')
      .select('id')
      .eq('query_hash', queryHash)
      .eq('mode', mode)
      .eq('apex_tier', apexTier)

    if (existing && existing.length > 0) {
      // Update existing entry
      await admin
        .from('apex_research_cache')
        .update(cacheData)
        .eq('id', existing[0].id)

      return existing[0].id
    } else {
      // Insert new entry
      const { data: inserted } = await admin
        .from('apex_research_cache')
        .insert(cacheData)
        .select('id')

      return inserted?.[0]?.id || null
    }
  } catch (err) {
    console.error('[research] Cache store failed:', err?.message || err)
    return null
  }
}

export async function POST(req) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!rateLimit(ip).ok) {
    return Response.json({ error: 'Too many requests. Please slow down.' }, { status: 429 })
  }

  try {
    const body = await req.json()
    const { query, mode = 'quick', apex_model = 'apex-free', attachedFile } = body

    // Allow either a query or an attached file (so the user can submit
    // with just an image and no text). If neither is present, error.
    if ((!query || typeof query !== 'string' || query.trim().length === 0) && !attachedFile) {
      return Response.json({ error: 'Query or attached file is required' }, { status: 400 })
    }

    const trimmedQuery = (query || '').trim()
    if (trimmedQuery.length > 2000) {
      return Response.json({ error: 'Query too long (max 2000 characters)' }, { status: 400 })
    }

    const normalized = trimmedQuery.toLowerCase().trim()
    const apexTier = apex_model

    // ── Skip cache when a file is attached ────────────────────────
    // File-bearing queries are inherently unique (the file content is part of
    // the research context), so caching by query hash would either:
    //   (a) return a stale result that doesn't account for the file, or
    //   (b) poison the cache with a file-specific result for future
    //       text-only queries with the same normalized text.
    // We bypass the cache entirely when attachedFile is present.
    const skipCache = !!attachedFile

    // ── APEX 2.0 Cache: check before calling Worker ──────────────
    const admin = getSupabaseAdmin()
    let queryHash = null

    if (admin && !skipCache) {
      try {
        queryHash = await computeQueryHash(normalized, mode, apexTier)
        const cached = await checkCache(admin, queryHash, mode, apexTier)

        if (cached) {
          // Cache HIT — update stats in background
          recordCacheHit(admin, cached.id, cached.cache_hit_count).catch(() => {})

          // Fetch wiki metadata if linked
          const wikiMeta = await getWikiMeta(admin, cached.wiki_page_id)

          return Response.json({
            report: cached.report,
            sources: cached.sources,
            followups: cached.followups,
            verificationSummary: cached.verification_summary,
            fromCache: true,
            cacheId: cached.id,
            wikiPageId: cached.wiki_page_id || null,
            wikiLifecycle: wikiMeta?.wikiLifecycle || null,
            wikiSlug: wikiMeta?.wikiSlug || null,
            wikiVersion: wikiMeta?.wikiVersion || null,
          })
        }
      } catch (cacheErr) {
        // Graceful degradation — log and continue to Worker
        console.error('[research] Cache lookup failed, falling through to Worker:', cacheErr?.message || cacheErr)
      }
    }

    // ── Cache MISS or Supabase unavailable — call Worker ─────────
    const openrouterKey = await getEnvVar('OPENROUTER_API_KEY')
    const workerStartTime = Date.now()

    // Deep mode with 16K token output can take up to 2 minutes.
    // Quick mode gets 30s so the fallback chain (which now races in parallel
    // and finishes in ~15-25s) has plenty of headroom under the frontend's
    // overall 60s fallback timeout.
    // When an image is attached, the vision model needs extra time (up to
    // 15s for image description) — extend the timeout by 30s in that case.
    const hasImage = attachedFile && (
      attachedFile.type?.startsWith('image/') ||
      /\.(png|jpe?g|gif|webp)$/i.test(attachedFile.name || '')
    )
    const baseTimeout = mode === 'deep' ? 120000 : 30000
    const workerTimeout = hasImage ? baseTimeout + 30000 : baseTimeout

    const workerBody = {
      query: trimmedQuery,
      mode,
      apex_model,
      openrouter_key: openrouterKey || '',
    }
    if (attachedFile) {
      workerBody.attachedFile = attachedFile
    }

    const workerRes = await fetch(RESEARCH_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workerBody),
      signal: AbortSignal.timeout(workerTimeout),
    })

    if (!workerRes.ok) {
      const errText = await workerRes.text().catch(() => '')
      console.error(`[research] Worker error ${workerRes.status}:`, errText.slice(0, 300))
      return Response.json(
        { error: `Research service error (${workerRes.status}). Please try again.` },
        { status: workerRes.status }
      )
    }

    const data = await workerRes.json()

    if (data.error) {
      return Response.json({ error: data.error }, { status: 500 })
    }

    const latencyMs = Date.now() - workerStartTime

    // ── Store result in cache (async, non-blocking) ─────────────
    let cacheId = null
    let wikiPageId = data.wikiPageId || null
    let wikiLifecycle = null
    let wikiSlug = null
    let wikiVersion = null

    if (admin && queryHash && !skipCache) {
      try {
        cacheId = await storeCacheResult(admin, queryHash, trimmedQuery, normalized, mode, apexTier, data, latencyMs)
      } catch (storeErr) {
        console.error('[research] Cache store error:', storeErr?.message || storeErr)
      }

      // Fetch wiki metadata if the Worker returned a wikiPageId or we have one from the result
      if (wikiPageId) {
        const wikiMeta = await getWikiMeta(admin, wikiPageId)
        if (wikiMeta) {
          wikiLifecycle = wikiMeta.wikiLifecycle
          wikiSlug = wikiMeta.wikiSlug
          wikiVersion = wikiMeta.wikiVersion
        }
      }
    }

    // ── Build response with cache + wiki metadata ───────────────
    return Response.json({
      ...data,
      fromCache: false,
      cacheId,
      wikiPageId,
      wikiLifecycle,
      wikiSlug,
      wikiVersion,
    })
  } catch (error) {
    console.error('[research] API error:', error)

    if (error.name === 'TimeoutError' || error.message?.includes('abort')) {
      return Response.json(
        { error: 'Research timed out. Please try again or use Quick mode for faster results.' },
        { status: 504 }
      )
    }

    return Response.json({ error: error.message || 'Research failed' }, { status: 500 })
  }
}
