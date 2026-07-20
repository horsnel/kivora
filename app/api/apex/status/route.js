export const runtime = 'edge' 

import { getSupabaseAdmin } from '@/lib/supabase'

// ══════════════════════════════════════════════════════════════════
// APEX 2.0 STATUS API — Engine status, statistics, and health
// GET /api/apex/status — Get APEX 2.0 engine status
// ══════════════════════════════════════════════════════════════════

export async function GET() {
  const admin = getSupabaseAdmin()

  const status = {
    version: '2.1.0',
    engine: 'APEX 2.1',
    features: [
      'source_tier_enforcement',
      'verification_loop',
      'parallel_orchestration',
      'research_report_mode',
      'iterative_research',
      'structured_extraction',
      'llm_wiki',
      'page_lifecycle',
      'hot_cache',
      'scimem_provenance',
      'conflict_detection',
      'dialogic_wiki',
      'concurrency_safety',
      'cache_first_routing',
      'query_classification',
      'academic_search_routing',
      'tier_badges_ui',
    ],
    tiers: {
      P1: 'Top-tier academic/government/institutional',
      P2: 'Reputable news/industry/professional orgs',
      P3: 'Acceptable but not authoritative',
      UNV: 'Unverified/unknown',
    },
    epistemicMarkers: ['ESTABLISHED', 'TENTATIVE', 'ACTIVE_DEBATE', 'SPECULATIVE', 'UNVERIFIED'],
    lifecycles: ['draft', 'active', 'stale', 'contradicted', 'archived'],
    database: 'disconnected',
    stats: null,
  }

  if (!admin) {
    return Response.json({ ...status, database: 'not_configured' })
  }

  try {
    // Get wiki page counts by lifecycle
    const { data: wikiStats } = await admin
      .from('apex_wiki_pages')
      .select('lifecycle')

    // Get cache stats
    const { count: cacheCount } = await admin
      .from('apex_research_cache')
      .select('*', { count: 'exact', head: true })
      .gt('expires_at', new Date().toISOString())

    const { count: hotCacheCount } = await admin
      .from('apex_research_cache')
      .select('*', { count: 'exact', head: true })
      .eq('is_hot', true)
      .gt('expires_at', new Date().toISOString())

    // Get claim verification stats
    const { data: claimStats } = await admin
      .from('apex_claim_verifications')
      .select('epistemic_status')

    // Process stats
    const lifecycleCounts = {}
    for (const row of (wikiStats || [])) {
      lifecycleCounts[row.lifecycle] = (lifecycleCounts[row.lifecycle] || 0) + 1
    }

    const epistemicCounts = {}
    for (const row of (claimStats || [])) {
      epistemicCounts[row.epistemic_status] = (epistemicCounts[row.epistemic_status] || 0) + 1
    }

    status.database = 'connected'
    status.stats = {
      wikiPages: {
        total: wikiStats?.length || 0,
        byLifecycle: lifecycleCounts,
      },
      cache: {
        totalEntries: cacheCount || 0,
        hotEntries: hotCacheCount || 0,
      },
      claims: {
        total: claimStats?.length || 0,
        byEpistemic: epistemicCounts,
      },
    }

    return Response.json(status)
  } catch (err) {
    console.error('[APEX Status] Error:', err)
    status.database = 'error'
    return Response.json(status)
  }
}
