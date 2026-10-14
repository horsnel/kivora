#!/usr/bin/env node
/**
 * Research engine v5.2.0 regression — true streaming + freshness routing.
 *
 * Guards the "don't break the current engine" contract:
 *   1. Freshness routing: detectRecency buckets + provider time-filter
 *      mappers (Tavily time_range, Brave freshness, Firecrawl tbs, Semantic
 *      Scholar year, Crossref from-pub-date) — neutral queries map to NO
 *      filter anywhere.
 *   2. Streaming transport: OpenRouter SSE delta parser (mocked fetch),
 *      client-side streamSSE protocol ordering, worker sseFrame wire format.
 *   3. Backward compat: makeResponse keeps the exact v5.1.0 key set with
 *      recency purely additive; classification unchanged.
 */
import { readFileSync } from 'node:fs'

const workerPath = new URL('../research-worker/src/index.js', import.meta.url)
const workerHref = 'file://' + workerPath.pathname.replace(/^\/?/, '/')
const worker = await import(workerHref + '?cachebust=' + Date.now())
const { readFileSync: rf } = await import('node:fs')

let pass = 0, fail = 0
function t(name, cond) {
  if (cond) { pass++; console.log('  PASS', name) }
  else { fail++; console.log('  FAIL', name) }
}

// ══════════════════════════════════════════════════════════════════
console.log('── 1. detectRecency buckets (strongest match wins) ──')
const R = (q) => worker.detectRecency(q)
t('"breaking news" → day', R('breaking news in AI').range === 'day')
t('"won yesterday" → day', R('who won the match yesterday').range === 'day')
t('"stock prices today" → day', R('stock prices today').range === 'day')
t('"this week" → week', R('AI releases this week').range === 'week')
t('"past 7 days" → week', R('earthquakes past 7 days').range === 'week')
t('"latest" → month', R('what is the latest on quantum computing').range === 'month')
t('"recently" → month', R('models released recently').range === 'month')
t('"current inflation" → month', R('current inflation rate').range === 'month')
t('"2026" → year', R('best AI models 2026').range === 'year')
t('"this year" → year', R('space launches this year').range === 'year')
t('"day beats month": "latest news today" → day', R('latest news today').range === 'day')
t('neutral query → null', R('how does photosynthesis work').range === null)
t('neutral query label → null', R('history of the roman empire').label === null)
t('empty/undefined → null', R('').range === null && R(undefined).range === null)
t('2024 (past year) NOT matched', R('2024 election results').range === null)

console.log('── 2. provider time-filter mappers ──')
t('tavilyTimeRange(month) = month', worker.tavilyTimeRange('month') === 'month')
t('tavilyTimeRange(null) = undefined', worker.tavilyTimeRange(null) === undefined)
t('braveFreshness(day) = pd', worker.braveFreshness('day') === 'pd')
t('braveFreshness(week) = pw', worker.braveFreshness('week') === 'pw')
t('braveFreshness(month) = pm', worker.braveFreshness('month') === 'pm')
t('braveFreshness(year) = py', worker.braveFreshness('year') === 'py')
t('braveFreshness(null) = undefined', worker.braveFreshness(null) === undefined)
t('firecrawlTbs(day) = qdr:d', worker.firecrawlTbs('day') === 'qdr:d')
t('firecrawlTbs(year) = qdr:y', worker.firecrawlTbs('year') === 'qdr:y')
t('firecrawlTbs(null) = undefined', worker.firecrawlTbs(null) === undefined)
const yr = new Date().getFullYear()
t('s2YearFilter(year) = "<yr-1>-<yr>"', worker.s2YearFilter('year') === `${yr - 1}-${yr}`)
t('s2YearFilter(month) also applies', worker.s2YearFilter('month') === `${yr - 1}-${yr}`)
t('s2YearFilter(day) = undefined', worker.s2YearFilter('day') === undefined)
t('crossrefFromDate(year) = "<yr-1>-01-01"', worker.crossrefFromDate('year') === `${yr - 1}-01-01`)
t('crossrefFromDate(week) = undefined', worker.crossrefFromDate('week') === undefined)

console.log('── 3. search sources carry recency (static wiring check) ──')
const workerSrc = rf(workerPath, 'utf8')
t('searchTavily threads time_range', workerSrc.includes("...(timeRange ? { time_range: timeRange } : {}),"))
t('searchBrave threads freshness', workerSrc.includes('freshness ? `&freshness=${freshness}`'))
t('searchFirecrawl threads tbs', workerSrc.includes("...(tbs ? { tbs } : {})"))
t('searchSemanticScholar threads year', workerSrc.includes('yearQ'))
t('searchCrossref threads from-pub-date', workerSrc.includes('from-pub-date:${fromDate}'))
t('searchQuick receives recency param', workerSrc.includes("async function searchQuick(query, env, maxSources = 10, classification = 'general', recency = null)"))
t('searchDeep receives recency param', workerSrc.includes("async function searchDeep(query, env, maxSources = 15, classification = 'general', recency = null)"))
t('quickResearch passes recency.range to searchQuick', workerSrc.includes('await searchQuick(searchQuery, env, 10, classification, recency.range)'))
t('deepResearch passes recency.range to searchDeep', workerSrc.includes('await searchDeep(searchQuery, env, 15, classification, recency.range)'))

console.log('── 4. classifyQuery regression (unchanged) ──')
t('clinical trial → biomedical', worker.classifyQuery('clinical trial results for a new drug') === 'biomedical')
t('react framework → tech', worker.classifyQuery('react framework comparison') === 'tech')
t('stock market → finance', worker.classifyQuery('stock market outlook') === 'finance')
t('plain question → general', worker.classifyQuery('how does photosynthesis work') === 'general')

console.log('── 5. OpenRouter stream parser (mocked fetch) ──')
const CHUNKS = [
  'data: {"choices":[{"delta":{"content":"Hello "}}]}\n\n',
  ': OPENROUTER PROCESSING\n\n', // keep-alive comment must be ignored
  'data: {"choices":[{"delta":{"content":"streamed "}}]}\n\ndata: {"choices":[{"delta":{"content":"world"}}]}\n\n',
  'data: [DONE]\n\n',
]
let mockFetchCount = 0
globalThis.fetch = async () => {
  mockFetchCount++
  const enc = new TextEncoder()
  const stream = new ReadableStream({
    start(c) { for (const ch of CHUNKS) c.enqueue(enc.encode(ch)); c.close() },
  })
  return new Response(stream, { status: 200, headers: { 'content-type': 'text/event-stream' } })
}
const fakeEnv = { OPENROUTER_API_KEY: 'sk-or-test' }
const got = []
const full = await worker.openrouterChatStream(fakeEnv, [{ role: 'user', content: 'hi' }], 'test/model', 100, 5000, (d) => got.push(d))
t('returns full text', full === 'Hello streamed world')
t('onDelta fired per token', JSON.stringify(got) === JSON.stringify(['Hello ', 'streamed ', 'world']))

// failure case → null (caller falls back to buffered chain)
globalThis.fetch = async () => new Response('{"error":"boom"}', { status: 402 })
const failed = await worker.openrouterChatStream(fakeEnv, [], 'test/model', 100, 5000, (d) => got.push(d))
t('provider error → null (fallback signal)', failed === null)

console.log('── 6. client streamSSE protocol ordering ──')
const sseClient = await import(new URL('../lib/sseClient.js', import.meta.url).href)
const wire = [
  worker.sseFrame({ type: 'phase', phase: 'classify', classification: 'tech', recency: { range: 'month', label: 'past month' } }),
  worker.sseFrame({ type: 'phase', phase: 'search' }),
  worker.sseFrame({ type: 'sources', sources: [{ id: 0, url: 'https://x.dev', title: 'X' }] }),
  worker.sseFrame({ type: 'delta', part: 'part1', v: 'alpha ' }),
  worker.sseFrame({ type: 'delta', part: 'part1', v: 'beta' }),
  worker.sseFrame({ type: 'phase', phase: 'write', part: 'part1', reset: true }),
  worker.sseFrame({ type: 'delta', part: 'part1', v: 'gamma' }),
  worker.sseFrame({ type: 'part_done', part: 'part1' }),
  worker.sseFrame({ type: 'delta', part: 'part2', v: 'delta-part2' }),
  worker.sseFrame({ type: 'part_done', part: 'part2' }),
  worker.sseFrame({ type: 'done', data: { report: 'gamma', mode: 'deep' } }),
].join('')
const events = []
await sseClient.streamSSE(new Response(wire), (e) => events.push(e))
t('event count', events.length === 11)
t('first event = classify phase', events[0].type === 'phase' && events[0].phase === 'classify')
t('recency rides the classify event', events[0].recency?.range === 'month')
t('sources event before deltas', events.findIndex(e => e.type === 'sources') < events.findIndex(e => e.type === 'delta'))
t('reset event present with part tag', events.some(e => e.type === 'phase' && e.reset && e.part === 'part1'))
t('part_done events for both parts', events.filter(e => e.type === 'part_done').length === 2)
t('terminal done carries data', events.at(-1).type === 'done' && events.at(-1).data.report === 'gamma')
const joined = events.filter(e => e.type === 'delta' && e.part === 'part1').map(e => e.v).join('')
t('deltas arrive in order on the wire', joined === 'alpha betagamma')
// Client-side replay: apply reset semantics the way handleResearchStream does
let buf = ''
for (const e of events) {
  if (e.type === 'delta' && e.part === 'part1') buf += e.v
  if (e.type === 'phase' && e.reset && e.part === 'part1') buf = ''
}
t('client replay: reset discards partial buffer → only gamma remains', buf === 'gamma')

console.log('── 7. wire format + backward compat ──')
t('sseFrame exact format', worker.sseFrame({ type: 'done' }) === 'data: {"type":"done"}\n\n')
const base = { sources: [1], report: 'r', title: 't', followups: [], mode: 'quick', classification: 'tech' }
const noRecency = worker.makeResponse(base)
t('makeResponse without recency → exact v5.1.0 key set', JSON.stringify(Object.keys(noRecency).sort()) === JSON.stringify(['classification', 'followups', 'mode', 'report', 'sources', 'title']))
const withRecency = worker.makeResponse({ ...base, recency: { range: 'week', label: 'past week' } })
t('makeResponse with recency → additive key only', JSON.stringify(Object.keys(withRecency).sort()) === JSON.stringify(['classification', 'followups', 'mode', 'recency', 'report', 'sources', 'title']))
const s = worker.mapSource({ url: 'https://pubmed.ncbi.nlm.nih.gov/1/', title: 'A study', snippet: 'x', tier: 'P1', tierLabel: 'P1 — Academic', source: 'pubmed', year: 2025, authors: ['Doe'] }, 0, 'deep')
t('mapSource preserves tier from search merge + academic meta', s.id === 0 && s.status === 'deep' && s.tier === 'P1' && s.sourceType === 'pubmed' && s.year === 2025)
t('mapSource: tier assigned by search merge layer, not mapSource (raw hit stays UNV)', worker.mapSource({ url: 'https://pubmed.ncbi.nlm.nih.gov/1/', title: 'A' }, 0).tier === 'UNV')
t('mapSource neutral hit → UNV loaded', worker.mapSource({ url: 'https://example.com/a', title: 'E' }, 3).tier === 'UNV')

console.log('── 8. route + client wiring (static — page.jsx is the live /research UI) ──')
const routeSrc = readFileSync(new URL('../app/api/research/route.js', import.meta.url), 'utf8')
t('route parses stream flag', routeSrc.includes('stream = false } = body'))
t('route forwards stream:true to worker', routeSrc.includes('workerBody.stream = true'))
t('route guards on event-stream content-type', routeSrc.includes("includes('text/event-stream')"))
t('route holds worker done + stores cache', routeSrc.includes('finalData = evt.data // held back'))
t('route refunds on truncated stream', routeSrc.includes("'stream truncated'"))
t('route refunds on client disconnect', routeSrc.includes("'client disconnected mid-stream'"))
t('route bursts cached hits over SSE', routeSrc.includes("send({ type: 'phase', phase: 'cache' })"))
t('route JSON path untouched for non-stream', routeSrc.includes('const data = await workerRes.json()'))
const clientSrc = readFileSync(new URL('../app/research/page.jsx', import.meta.url), 'utf8')
t('client requests stream only for deep mode (v5.3 policy)', clientSrc.includes("stream: researchMode === 'deep'"))
t('client consumes primary SSE stream', clientSrc.includes('return await consumeResearchStream(r)'))
t('client falls back to JSON parse on non-SSE', clientSrc.includes("ct.includes('text/event-stream')"))
t('client buffers deep parts separately', clientSrc.includes("partsDone.has('part1')"))
t('client clears fake timers when stream opens', clientSrc.includes('stop the fake-progress seasoning'))
t('client renders recency chip', clientSrc.includes('activeResearch.recency?.label'))
t('client stores recency on completed item', clientSrc.includes('recency: data.recency || null,'))
t('fallback suppressed once streaming is active', clientSrc.includes("throw new Error('stream_active')"))
t('stream_active never surfaced as error message', clientSrc.includes("m !== 'stream_active'"))
t('stream failure rejects → Promise.any falls to fallback', clientSrc.includes("reject(new Error('research stream ended without result'))"))

// ── 9. cache-hit payload type safety (regression: '.map is not a function') ──
console.log('── 9. cache-hit payload normalizes JSON strings ──')
t('route parses cached sources/followups/verification_summary', routeSrc.includes('const asParsed = (v) => {'))
t('cached sources defaults to array', routeSrc.includes('asParsed(cached.sources) || []'))
t('cached followups defaults to array', routeSrc.includes('asParsed(cached.followups) || []'))

// ── 10. Workers AI streaming fallback (v5.2.1: "not streaming / taking forever") ──
console.log('── 10. workersAiChatStream (mocked env.AI binding) ──')
const WAI_CHUNKS = [
  'data: {"response":"Token "}\n\n',
  'data: {"response":"one "}\n\n',
  'data: {"response":"flows"}\n\n',
  'data: [DONE]\n\n',
]
const fakeEnvAI = {
  AI: {
    run: async (model, opts) => {
      if (!opts?.stream) return { response: 'buffered path' } // guard: stream flag must be passed
      const enc = new TextEncoder()
      return new ReadableStream({
        start(c) { for (const ch of WAI_CHUNKS) c.enqueue(enc.encode(ch)); c.close() },
      })
    },
  },
}
const waiGot = []
const waiFull = await worker.workersAiChatStream(fakeEnvAI, [{ role: 'user', content: 'hi' }], '@cf/meta/llama-3.1-8b-instruct-fp8', 100, (d) => waiGot.push(d))
t('WAI stream: passes stream:true to binding', waiFull === 'Token one flows')
t('WAI stream: onDelta fired per token', JSON.stringify(waiGot) === JSON.stringify(['Token ', 'one ', 'flows']))

const emptyStreamEnv = { AI: { run: async () => { const e = new TextEncoder(); return new ReadableStream({ start(c) { c.enqueue(e.encode('data: [DONE]\n\n')); c.close() } }) } } }
const waiEmpty = await worker.workersAiChatStream(emptyStreamEnv, [{ role: 'user', content: 'x' }], 'm', 10, () => {})
t('WAI stream: empty result → null', waiEmpty === null)

const throwEnv = { AI: { run: async () => { throw new Error('ai down') } } }
const waiErr = await worker.workersAiChatStream(throwEnv, [{ role: 'user', content: 'x' }], 'm', 10, () => {})
t('WAI stream: binding exception → null (caller falls through chain)', waiErr === null)

const waiNoAI = await worker.workersAiChatStream({}, [{ role: 'user', content: 'x' }], 'm', 10, () => {})
t('WAI stream: no env.AI → null', waiNoAI === null)

console.log('── 11. WAI streaming wiring in both apex chains (static) ──')
t('free chain WAI leg streams when canStream', workerSrc.includes('const result = await workersAiChatStream(env, messages, m, Math.min(maxTokens, 4096), stream.onDelta);'))
t('WAI stream failures reset partial deltas', (workerSrc.match(/if \(result\) resetPartial\(\); \/\/ discard deltas the client already rendered/g) || []).length === 2)
t('WAI stream errors tagged distinctly in chain trace', (workerSrc.match(/WAI-stream:/g) || []).length === 2) // free + premium legs' errors.push
t('buffered workersAiChat still present for non-stream callers', (workerSrc.match(/await workersAiChat\(env, messages, m, Math\.min\(maxTokens, 4096\)\)/g) || []).length >= 3) // free + premium + llmQuick
t('export exists for regression suite', typeof worker.workersAiChatStream === 'function')

console.log('── 12. v5.7 semantic-hit refund parity + permalink proxy (API layer) ──')
t('JSON path: semantic hits refund all but 1 credit', routeSrc.includes("data.cacheType === 'semantic'") && routeSrc.includes("'semantic cache hit'"))
t('stream path: semantic hits refund identically', routeSrc.includes("finalData.cacheType === 'semantic'"))
t('semantic refunds are try/catch guarded (never block the response)', (routeSrc.match(/semantic refund failed/g) || []).length === 2)
t('semantic hits still materialize into Supabase exact cache', routeSrc.includes('storeCacheResult(admin, queryHash, trimmedQuery, normalized, mode, apexTier, finalData, latencyMs)'))
const proxySrc = readFileSync(new URL('../app/api/research/report/[id]/route.js', import.meta.url), 'utf8')
t('permalink proxy: edge runtime + rate limited', proxySrc.includes("runtime = 'edge'") && proxySrc.includes('rateLimit(ip).ok'))
t('permalink proxy: id format enforced client-of-worker', proxySrc.includes('^[a-f0-9]{6,24}$'))
t('permalink proxy: 10s timeout + 404 passthrough', proxySrc.includes('AbortSignal.timeout(10000)') && proxySrc.includes("workerRes.status === 404 ? 404 : 502"))
t('permalink proxy: no auth gate (capability URL by design)', !proxySrc.includes('requireFeatureAccess') && !proxySrc.includes('requireCredits'))

console.log(`\n${pass}/${pass + fail} assertions passed`)
process.exit(fail > 0 ? 1 : 0)
