# Task 1: APEX 2.0 Cache Integration in Research API

## Summary
Wired the APEX 2.0 Supabase cache into `/home/z/my-project/app/api/research/route.js` so that:
1. Before forwarding to the CF Worker, the API checks `apex_research_cache` for existing results
2. Cache hits return instantly with `fromCache: true`, `cacheId`, and wiki metadata
3. Cache misses forward to Worker, then store results in cache (upsert by query_hash+mode+apex_tier)
4. Wiki metadata (`wikiLifecycle`, `wikiSlug`, `wikiVersion`) is included when a wiki page is linked

## Implementation Details

### New Functions Added
- **`computeQueryHash(normalized, mode, apexTier)`** — SHA-256 hash via `crypto.subtle` (Edge runtime compatible)
- **`getWikiMeta(admin, wikiPageId)`** — Fetches `lifecycle`, `slug`, `version` from `apex_wiki_pages`
- **`checkCache(admin, queryHash, mode, apexTier)`** — Queries `apex_research_cache` for non-expired results
- **`recordCacheHit(admin, cacheId, currentHitCount)`** — Updates hit count + last_accessed_at (fire-and-forget)
- **`storeCacheResult(admin, queryHash, queryText, normalized, mode, apexTier, result, latencyMs)`** — Upserts cache entry, returns cache ID

### Cache Flow
1. Compute `SHA-256(normalized_query|mode|apex_tier)` hash
2. Query `apex_research_cache` matching `query_hash + mode + apex_tier` where `expires_at > now()`
3. **Cache HIT**: Increment `cache_hit_count`, update `last_accessed_at`, fetch wiki meta, return instantly
4. **Cache MISS**: Call Worker as before, measure latency, store result in cache, fetch wiki meta, return with `fromCache: false`

### Graceful Degradation
- If `getSupabaseAdmin()` returns `null` (Supabase not configured), all cache logic is skipped
- Cache lookup/store errors are caught and logged — research still works via Worker
- `recordCacheHit` is fire-and-forget (`.catch(() => {})`) to avoid blocking the response

### Response Shape
```json
{
  "report": "...",
  "sources": [...],
  "followups": [...],
  "verificationSummary": {},
  "fromCache": true|false,
  "cacheId": "uuid" | null,
  "wikiPageId": "uuid" | null,
  "wikiLifecycle": "active" | null,
  "wikiSlug": "some-topic" | null,
  "wikiVersion": 1 | null
}
```

### Preserved Behavior
- Rate limiting (unchanged)
- Worker proxy with timeout (unchanged)
- Error handling for timeouts and Worker errors (unchanged)
- Edge runtime compatible (no Node.js APIs)
