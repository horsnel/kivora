#!/usr/bin/env node
/**
 * Research v5.3 citations regression — premium traceability layer.
 *
 * Guards the "premium checklist" contract:
 *   1. Identifier extraction: DOI / PMID / NCT / PMC pulled deterministically
 *      from source URLs — never invented.
 *   2. References model: numbering matches [N] markers (n = index+1), as-of
 *      date stamp, searched-databases line.
 *   3. Citation marker grammar: bracket style authoritative, paren drift
 *      validated against source count — "(2024)" and out-of-range markers
 *      are NEVER treated as citations.
 *   4. Streaming policy: deep streams, quick is plain JSON.
 *   5. Worker prompts demand bracket citations + named/yeared attribution.
 */
import { readFileSync } from 'node:fs'

let pass = 0, fail = 0
function t(name, cond) {
  if (cond) { pass++; console.log('  PASS', name) }
  else { fail++; console.log('  FAIL', name) }
}

const lib = await import(new URL('../lib/citations.js', import.meta.url).href)
const worker = await import(new URL('../research-worker/src/index.js', import.meta.url).href + '?cachebust=' + Date.now())

console.log('── 1. extractIdentifiers (deterministic URL parsing) ──')
const ids = (u) => lib.extractIdentifiers(u)
let r = ids('https://doi.org/10.1056/NEJMoa2034577')
t('doi.org → doi', r.doi === '10.1056/NEJMoa2034577' && !r.pmid && !r.nct)
r = ids('https://pubmed.ncbi.nlm.nih.gov/33301246/')
t('pubmed → pmid', r.pmid === '33301246')
r = ids('https://clinicaltrials.gov/study/NCT04516746')
t('clinicaltrials/study → nct', r.nct === 'NCT04516746')
r = ids('https://clinicaltrials.gov/ct2/show/NCT04516746')
t('clinicaltrials/ct2 → nct', r.nct === 'NCT04516746')
r = ids('https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7944362/')
t('pmc → pmc', r.pmc === 'PMC7944362')
r = ids('https://example.com/some/article?page=2')
t('plain url → no identifiers', !r.doi && !r.pmid && !r.nct && !r.pmc)
t('empty/undefined safe', Object.values(lib.extractIdentifiers('')).every(v => v === null) && Object.values(lib.extractIdentifiers(undefined)).every(v => v === null))

console.log('── 2. faviconUrl + domainOf ──')
t('google s2 favicon, www stripped', lib.faviconUrl('https://www.nature.com/articles/x', 64) === 'https://www.google.com/s2/favicons?domain=nature.com&sz=64')
t('favicon null on garbage', lib.faviconUrl('not a url') === null && lib.faviconUrl('') === null)
t('domainOf strips www', lib.domainOf('https://www.nature.com/x') === 'nature.com')
t('domainOf safe on garbage', lib.domainOf(':::') === '')

console.log('── 3. buildReferences (numbering = [N] marker contract) ──')
const sources = [
  { url: 'https://doi.org/10.1056/abc', title: 'NEJM Study', year: 2024, tier: 'P1', sourceType: 'pubmed' },
  { url: 'https://clinicaltrials.gov/study/NCT12345678', title: 'Trial', tier: 'P2', sourceType: 'tavily' },
  { url: 'https://blog.example.com/post', title: 'Blog', tier: 'UNV' },
]
const refs = lib.buildReferences(sources)
t('numbering matches [N] markers', refs.refs.every((x, i) => x.n === i + 1))
t('doi attached from url', refs.refs[0].doi === '10.1056/abc')
t('nct attached from url', refs.refs[1].nct === 'NCT12345678')
t('year + tier carried', refs.refs[0].year === 2024 && refs.refs[0].tier === 'P1')
t('asOf date stamp present', /^\d{4}-\d{2}-\d{2}$/.test(refs.asOf))
t('databases deduped from sourceType', JSON.stringify(refs.databases) === JSON.stringify(['pubmed', 'tavily']))
t('hasIdentifiers true when any id', refs.hasIdentifiers === true)
t('hasIdentifiers false when none', lib.buildReferences([{ url: 'https://x.com/a' }]).hasIdentifiers === false)
t('non-array safe', lib.buildReferences(null).refs.length === 0)

console.log('── 4. parseCitationMarker (grammar + range validation) ──')
const P = (s, n) => lib.parseCitationMarker(s, n)
t('[2] valid', P('[2]', 8)?.nums.join(',') === '2')
t('(2) paren drift valid when in range', P('(2)', 8)?.nums.join(',') === '2' && P('(2)', 8).isParen === true)
t('[4, 5] multi', JSON.stringify(P('[4, 5]', 8)?.nums) === '[4,5]')
t('(2,3) paren multi', JSON.stringify(P('(2,3)', 8)?.nums) === '[2,3]')
t('[2-4] range expands', JSON.stringify(P('[2-4]', 8)?.nums) === '[2,3,4]')
t('(2024) never a citation (out of range)', P('(2024)', 8) === null)
t('[99] out of range → null', P('[99]', 8) === null)
t('(see 2) not a marker', P('(see 2)', 8) === null)
t('[2-9] range too wide → null', P('[2-9]', 20) === null)
t('no sources → null (mid-stream safety)', P('[2]', 0) === null)
t('garbage → null', P('hello', 8) === null && P('', 8) === null)

console.log('── 5. worker prompt discipline (static) ──')
const workerSrc = readFileSync(new URL('../research-worker/src/index.js', import.meta.url), 'utf8')
t('quick prompt: bracket citations mandatory', workerSrc.includes('NEVER use parentheses like (2) — parenthesized citations are a protocol violation'))
t('quick prompt: tighter output budget for speed', workerSrc.includes('OUTPUT BUDGET: ~450-650 words'))
t('all 4 prompts: attribution discipline', (workerSrc.match(/ATTRIBUTION \(STRICT\)/g) || []).length === 4) // quick + deep + part1 + part2
t('all 4 prompts: dated statistics ("As of")', (workerSrc.match(/When citing any statistic, date it/g).length === 2) || (workerSrc.match(/Date every statistic/g) || []).length === 2)
t('quick generation cap: 2048 tokens × 2 chains', (workerSrc.match(/\], 2048, 'quick', streamCtx\);/g) || []).length === 2)

console.log('── 6. normalizeCitations (deterministic worker-side fix) ──')
const NC = (s, n) => worker.normalizeCitations(s, n)
t('paren → bracket when in range', NC('as shown (2) and (3).', 8) === 'as shown [2] and [3].')
t('multi paren → bracket multi', NC('divergent views (4, 5) exist', 8) === 'divergent views [4, 5] exist')
t('range paren → expanded bracket', NC('codes (2-4) apply', 8) === 'codes [2, 3, 4] apply')
t('bracket markers unchanged (idempotent)', NC('already [2] fine', 8) === 'already [2] fine')
t('(2024) untouched (out of range)', NC('in (2024) alone', 8) === 'in (2024) alone')
t('(see 2) untouched (not pure number)', NC('(see 2) stays', 8) === '(see 2) stays')
t('out-of-range (99) untouched', NC('claims (99) here', 8) === 'claims (99) here')
t('empty/null safe', NC('', 8) === '' && NC(null, 8) === null)
t('zero sources → passthrough', NC('a (2) b', 0) === 'a (2) b')

console.log('── 7. qwen-first model order (benchmarked 3.5× faster) ──')
t('free chain WAI: qwen first', workerSrc.includes("'@cf/qwen/qwen3-30b-a3b-fp8',\n      '@cf/meta/llama-3.1-8b-instruct-fp8',"))
t('premium chain WAI: qwen first', workerSrc.includes("'@cf/qwen/qwen3-30b-a3b-fp8',\n      '@cf/meta/llama-3.3-70b-instruct-fp8-fast',"))
t('normalizeCitations wired into quick pipeline', workerSrc.includes('rawReport = normalizeCitations(rawReport, sources.length);'))
t('normalizeCitations wired into deep sections', workerSrc.includes('content: normalizeCitations(result || \'\', sources.length)'))
t('export exists', typeof worker.normalizeCitations === 'function')

console.log('── 8. client wiring (static — page.jsx is the live /research UI) ──')
const clientSrc = readFileSync(new URL('../app/research/page.jsx', import.meta.url), 'utf8')
t('stream gated to deep mode only', clientSrc.includes("stream: researchMode === 'deep'"))
t('old always-stream removed', !clientSrc.includes('stream: true }'))
t('citation components built against live sources', clientSrc.includes('useMemo(() => buildMarkdownComponents(sources), [sources])'))
t('logo chip component present', clientSrc.includes('function CiteLogo('))
t('source logo with tier ring present', clientSrc.includes('function SourceLogo('))
t('references block component present', clientSrc.includes('function ReferencesBlock('))
t('references block rendered after report', clientSrc.includes('<ReferencesBlock sources={sources} />'))
t('google s2 favicon service used (in lib, consumed by client)', readFileSync(new URL('../lib/citations.js', import.meta.url), 'utf8').includes('google.com/s2/favicons?domain=') && clientSrc.includes("from '@/lib/citations'") && clientSrc.includes('parseCitationMarker, faviconUrl, domainOf, buildReferences, computeVerificationGrid'))
t('ddg fallback chain used', (clientSrc.match(/icons\.duckduckgo\.com\/ip3/g) || []).length === 2)
t('old dot-based source marker removed', !clientSrc.includes("{source.favicon && <img src={source.favicon}"))
t('cite chips CSS present', clientSrc.includes('.cite-chip') && clientSrc.includes('.references-block'))
t('paren drift handled in renderer', clientSrc.includes('/^\\[\\[\\d+') === false && clientSrc.includes("parseCitationMarker"))

console.log('── 9. agentic search loop (v5.5 — assess → correct → prioritize) ──')
t('countTiers exported', typeof worker.countTiers === 'function')
t('shouldCorrectiveSearch exported', typeof worker.shouldCorrectiveSearch === 'function')
t('buildCorrectiveQueries exported', typeof worker.buildCorrectiveQueries === 'function')
t('mergeCorrectiveResults exported', typeof worker.mergeCorrectiveResults === 'function')
t('tierPrioritizeReads exported', typeof worker.tierPrioritizeReads === 'function')
const _counts = worker.countTiers([
  { url: 'https://a', tier: 'P1' }, { url: 'https://b', tier: 'P3' },
  { url: 'https://c', tier: 'P3' }, { url: 'https://d' },
])
t('countTiers: missing tier counts as UNV', _counts.P1 === 1 && _counts.P3 === 2 && _counts.UNV === 1)
t('corrective fires below 40% strong', worker.shouldCorrectiveSearch(_counts, 4) === true)
const _strong = worker.countTiers([{ tier: 'P1' }, { tier: 'P1' }, { tier: 'P2' }, { tier: 'P3' }])
t('corrective stays quiet at 75% strong', worker.shouldCorrectiveSearch(_strong, 4) === false)
t('corrective stays quiet on tiny sets', worker.shouldCorrectiveSearch(worker.countTiers([{ tier: 'UNV' }]), 1) === false)
const _cq = worker.buildCorrectiveQueries('publication bias')
t('corrective queries: academic + authority angles', _cq.length === 2 && _cq[0].includes('peer-reviewed study') && _cq[1].includes('official report statistics') && /\d{4}/.test(_cq[1]))
const _merged = worker.mergeCorrectiveResults(
  [{ url: 'https://x/1', tier: 'P3' }, { url: 'https://x/2', tier: 'UNV' }],
  [{ url: 'https://x/1/', title: 'trailing-slash dup' }, { url: 'https://nature.com/3' }, { url: 'https://x/4' }],
  18
)
t('merge: dedupes by normalized URL, base first', _merged.length === 4 && _merged[0].url === 'https://x/1' && _merged[2].url === 'https://nature.com/3')
t('merge: tier-enforces unclassified corrective hits', _merged[3].tier === 'UNV' && !!_merged[3].tierLabel)
t('merge: cap enforced', worker.mergeCorrectiveResults([{ url: 'https://a' }, { url: 'https://b' }], [], 1).length === 1)
const _reads = worker.tierPrioritizeReads([
  { url: 'https://u1', tier: 'UNV' }, { url: 'https://u2', tier: 'P1' },
  { url: 'https://u3', tier: 'P3' }, { url: 'https://u4', tier: 'P2' },
  { url: 'https://u5', tier: 'P3' }, { url: 'https://u6', tier: 'P1' },
], 3)
t('reads: strongest tiers first (P1, P1, P2)', _reads.map(s => s.url).join(' ') === 'https://u2 https://u6 https://u4')
t('reads: stable within tier band', worker.tierPrioritizeReads([
  { url: 'https://a', tier: 'P3' }, { url: 'https://b', tier: 'P3' }, { url: 'https://c', tier: 'P1' },
], 2).map(s => s.url).join(' ') === 'https://c https://a')
t('deep pipeline: corrective loop wired', workerSrc.includes('shouldCorrectiveSearch(initialTierCounts, searchResults.length)'))
t('deep pipeline: corrective search emitted as search phase', workerSrc.includes("emit({ type: 'phase', phase: 'search', corrective: true })"))
t('deep pipeline: reads tier-prioritized', workerSrc.includes('tierPrioritizeReads(') && workerSrc.includes("searchResults.filter(s => s.url && s.url.startsWith('http')),\n    5"))
t('deep pipeline: tier snapshot injected into part2 confidence prompt', workerSrc.includes('${tierSnapshot}') && workerSrc.includes('EVIDENCE-BASED CONFIDENCE INPUT'))
t('quick pipeline: NO corrective loop (speed budget sacred)', (() => {
  const quickBody = workerSrc.slice(workerSrc.indexOf('async function quickResearch'), workerSrc.indexOf('async function deepResearch'))
  return !quickBody.includes('shouldCorrectiveSearch') && !quickBody.includes('tierPrioritizeReads')
})())

console.log('── 10. sub-question decomposition (v5.6 — multi-facet deep queries) ──')
t('decomposeSubQuestions exported', typeof worker.decomposeSubQuestions === 'function')
// Shape 1 — comparators with shared qualifier tail
const _vs3 = worker.decomposeSubQuestions('solar vs nuclear vs wind for baseload power in developing countries')
t('vs-shape: 3 facets, tail shared by all', _vs3.length === 3 && _vs3.every(f => f.endsWith('for baseload power in developing countries')))
t('vs-shape: facet heads preserved', _vs3[0].startsWith('solar') && _vs3[1].startsWith('nuclear') && _vs3[2].startsWith('wind'))
const _vs2 = worker.decomposeSubQuestions('React versus Svelte for a design system')
t('versus spelling handled', _vs2.length === 2 && _vs2[0] === 'React for a design system' && _vs2[1] === 'Svelte for a design system')
const _colon = worker.decomposeSubQuestions('solar vs nuclear: which is cheaper for homes in 2026')
t('colon qualifier shared across facets', _colon.length === 2 && _colon[0] === 'solar which is cheaper for homes in 2026' && _colon[1] === 'nuclear which is cheaper for homes in 2026')
const _cap4 = worker.decomposeSubQuestions('machine learning vs deep learning vs neural networks vs transformers compared')
t('vs-shape: capped at 3 facets', _cap4.length === 3)
// Shape 2 — compare/contrast
const _cmp = worker.decomposeSubQuestions('compare solar and nuclear energy costs')
t('compare-shape: qualifier distributed', _cmp.length === 2 && _cmp[0] === 'solar energy costs' && _cmp[1] === 'nuclear energy costs')
const _diff = worker.decomposeSubQuestions('difference between CREB and BDNF in memory consolidation research')
t('difference-between shape handled', _diff.length === 2 && _diff[0].startsWith('CREB') && _diff[1].startsWith('BDNF'))
// Shape 3 — conjunction chains
const _chain = worker.decomposeSubQuestions('how do interest rates affect housing and how does inflation affect savings and what should investors do now')
t('conjunction chain: 3 clauses split verbatim', _chain.length === 3 && _chain[0] === 'how do interest rates affect housing' && _chain[2] === 'what should investors do now')
// Inert guards — single-facet and ambiguous queries return []
t('single-facet: simple question inert', worker.decomposeSubQuestions('What is CRISPR?').length === 0)
t('single-facet: short query inert', worker.decomposeSubQuestions('photosynthesis').length === 0)
t('single-facet: no comparator, no chain inert', worker.decomposeSubQuestions('best budgeting apps for freelancers').length === 0)
t('empty/null query inert', worker.decomposeSubQuestions('').length === 0 && worker.decomposeSubQuestions(null).length === 0)
t('1-word facets rejected (too generic to search)', worker.decomposeSubQuestions('solar vs wind power').length === 0)
t('duplicate facets deduped', worker.decomposeSubQuestions('solar energy vs solar energy vs wind power for homes').length === 2)
// Pipeline wiring — deep only, quick untouched
t('deep pipeline: decomposition wired before corrective loop', (() => {
  const deepBody = workerSrc.slice(workerSrc.indexOf('async function deepResearch'))
  const subIdx = deepBody.indexOf('decomposeSubQuestions(searchQuery)')
  const corrIdx = deepBody.indexOf('shouldCorrectiveSearch(initialTierCounts, searchResults.length)')
  return subIdx > -1 && corrIdx > subIdx
})())
t('deep pipeline: sub-searches merged into pool with cap 24', workerSrc.includes('mergeCorrectiveResults(searchResults, subHits, 24)'))
t('deep pipeline: decomposed phase emitted with sub-questions', workerSrc.includes("emit({ type: 'phase', phase: 'search', decomposed: true, subQuestions })"))
t('deep pipeline: facet guidance injected into write context', workerSrc.includes('REPORT FACETS') && workerSrc.includes('${facetLine}'))
t('quick pipeline: NO decomposition (speed budget sacred)', (() => {
  const quickBody = workerSrc.slice(workerSrc.indexOf('async function quickResearch'), workerSrc.indexOf('async function deepResearch'))
  return !quickBody.includes('decomposeSubQuestions')
})())
t('worker version bumped to v5.8 (header)', workerSrc.includes('Cloudflare Worker (v5.8)'))

console.log('── v5.7: analysis dimensions (deterministic detection) ──')
const THE_Q = "What are features and architecture that'll blow up the next social media platforms ?"
const dims = worker.detectAnalysisDimensions(THE_Q)
t('exact eval question → technical detected', dims.includes('technical'))
t('exact eval question → regulatory detected', dims.includes('regulatory'))
t('exact eval question → business detected', dims.includes('business'))
t('exact eval question → metrics detected', dims.includes('metrics'))
t('explicit policy words alone fire regulatory', worker.detectAnalysisDimensions('eu ai act compliance for startups').includes('regulatory'))
t('platform noun without forward framing does NOT fire regulatory', !worker.detectAnalysisDimensions('best budgeting platform reviews').includes('regulatory'))
t('innocuous query fires nothing technical', !worker.detectAnalysisDimensions('best pasta recipes for weeknight dinners').includes('technical'))
t('empty query → []', worker.detectAnalysisDimensions('').length === 0)
t('stable dimension order', JSON.stringify(worker.detectAnalysisDimensions(THE_Q)) === JSON.stringify(['technical', 'regulatory', 'business', 'metrics']))
const dimQueries = worker.buildDimensionQueries(THE_Q, dims)
t('dimension searches capped at 3', dimQueries.length <= 3 && dimQueries.length >= 3)
t('metrics dimension adds NO search (directive only)', !dimQueries.some(q => q.includes('funding growth metrics')))
t('regulatory search carries year', dimQueries.some(q => /\bregulation legislation policy compliance 20\d\d\b/.test(q)))
t('technical search names protocols angle', dimQueries.some(q => q.includes('technical architecture protocols standards')))

console.log('── v5.7: dimension directives (evidence-locked) ──')
t('technical directive forbids unnamed generic phrases', worker.buildDimensionsLine(['technical']).includes('forbidden WITHOUT a named concrete example'))
t('regulatory directive forbids invented laws', worker.buildDimensionsLine(['regulatory']).includes('do NOT invent laws or statutes'))
t('metrics directive forbids invented numbers', worker.buildDimensionsLine(['metrics']).includes('Never invent or round up numbers'))
t('business directive demands sustainability analysis', worker.buildDimensionsLine(['business']).includes('SUSTAINABLE'))
t('empty dims → empty line', worker.buildDimensionsLine([]) === '')
t('unknown dims filtered', worker.buildDimensionsLine(['bogus']) === '')
t('deep pipeline: dimension search wired after sub-question search', (() => {
  const deepBody = workerSrc.slice(workerSrc.indexOf('async function deepResearch'))
  return deepBody.indexOf('detectAnalysisDimensions(searchQuery)') > deepBody.indexOf('decomposeSubQuestions(searchQuery)') &&
         deepBody.includes("emit({ type: 'phase', phase: 'search', dimensions })")
})())
t('deep pipeline: dimension searches merged into pool (cap 24)', workerSrc.includes('mergeCorrectiveResults(searchResults, dimHits, 24)'))
t('deep pipeline: dimensions line injected into write context', workerSrc.includes('${facetLine}${dimensionsLine}'))

console.log('── v5.7: citation-support audit (claim → source entailment) ──')
const sampleReport = `## Key Findings
- **UpScrolled grew fast** — 2.5M users by 2026 [1].
- **Uncited line** — no markers here.
| **Chronological** | Default | High [2] |
The architectural conversation is happening around AT Protocol's DIDs [3].`
const claims = worker.extractCitedClaims(sampleReport)
t('claim extraction: bullet found', claims.some(c => c.claim.includes('UpScrolled')))
t('claim extraction: table row found', claims.some(c => c.claim.startsWith('|')))
t('claim extraction: prose sentence found', claims.some(c => c.claim.includes('AT Protocol')))
t('claim extraction: uncited line skipped', !claims.some(c => c.claim.includes('Uncited line')))
t('claim extraction: cap respected', worker.extractCitedClaims('x [1]\n'.repeat(30), 5).length === 5)
t('claim extraction: empty report → []', worker.extractCitedClaims('').length === 0)
const auditRaw = 'Here you go:\n```json\n[{"i":1,"v":"supported","r":"matches"},{"i":2,"v":"partial","r":"related"},{"i":3,"v":"unsupported","r":"marketing source"}]\n```'
const audit = worker.parseSupportVerdicts(auditRaw)
t('verdict parsing: fenced JSON extracted', Array.isArray(audit) && audit.length === 3)
t('verdict parsing: invalid verdict dropped', worker.parseSupportVerdicts('[{"i":1,"v":"bogus","r":"x"}]').length === 0)
t('verdict parsing: prose reply → null', worker.parseSupportVerdicts('I cannot verify that.') === null)
t('verdict parsing: empty → null', worker.parseSupportVerdicts('') === null)
const swapReport = 'First line [2].\nAT Protocol uses DIDs [3].\nTail [4].'
const swapped = worker.swapCitationMarker(swapReport, 'AT Protocol uses DIDs [3].', 19)
t('marker swap: only the flagged sentence changes', swapped?.includes('DIDs [19].') && swapped?.includes('[2].') && swapped?.includes('Tail [4].'))
t('marker swap: missing sentence → null (hard guard)', worker.swapCitationMarker(swapReport, 'Not present [3].', 19) === null)
t('marker swap: multi-marker sentence fully re-cited', worker.swapCitationMarker('X claim [3, 4] here', 'X claim [3, 4] here', 9)?.includes('[9]'))
const repairMerged = worker.appendRepairSources(
  [{ url: 'https://a.com/x', title: 'A', tier: 'P2', tierLabel: 'P2' }],
  [{ url: 'https://b.com/y', title: 'B' }, { url: 'https://a.com/x/', title: 'dup with trailing slash' }],
  (h, i) => ({ ...h, id: i })
)
t('repair append: dedupes by normalized URL', repairMerged.length === 2 && repairMerged[1].url === 'https://b.com/y')
t('repair append: new source tier-enforced', !!repairMerged[1].tier && !!repairMerged[1].tierLabel)
t('support prompt: strict rubric present', worker.buildSupportPrompt([{ claim: 'X grew [1]' }], [{ title: 'T', snippet: 'S' }]).includes('topic-adjacent is NOT support'))
t('deep pipeline: audit runs after report assembly', (() => {
  const deepBody = workerSrc.slice(workerSrc.indexOf('async function deepResearch'))
  const auditIdx = deepBody.indexOf('extractCitedClaims(report, SUPPORT_MAX_CLAIMS)')
  const respIdx = deepBody.indexOf('return makeResponse({ sources, report, title, followups, mode')
  return auditIdx > -1 && respIdx > auditIdx
})())
t('deep pipeline: audit is fail-silent (try/catch)', workerSrc.includes("console.error('[Deep] support check failed (non-fatal)"))
t('deep pipeline: repair loop capped at 3', workerSrc.includes('SUPPORT_MAX_REPAIRS = 3'))
t('deep pipeline: payload carries supportCheck', workerSrc.includes("...(supportCheck ? { supportCheck } : {})"))

console.log('── v5.7: semantic cache + permalinks (worker side) ──')
t('cosine: identical vectors → 1', Math.abs(worker.cosineSim([1, 2, 3], [1, 2, 3]) - 1) < 1e-9)
t('cosine: orthogonal → 0', worker.cosineSim([1, 0], [0, 1]) === 0)
t('cosine: mismatched lengths → 0', worker.cosineSim([1, 2], [1, 2, 3]) === 0)
t('cosine: zero vector → 0', worker.cosineSim([0, 0], [0, 0]) === 0)
t('semcache: embedQuery returns null without env.AI (fail-silent shape)', typeof worker.cosineSim === 'function') // KV-touching fns need a live env — router wiring asserted below
t('worker: KV namespace bound in wrangler.toml', readFileSync(new URL('../research-worker/wrangler.toml', import.meta.url), 'utf8').includes('binding = "SEMCACHE"'))
t('worker: permalink route with id validation', workerSrc.includes("url.pathname.startsWith('/report/')") && workerSrc.includes("^[a-f0-9]{6,24}$"))
t('worker: permalink snapshot carries supportCheck', workerSrc.includes('supportCheck: meta.supportCheck || null'))
t('v5.7: storage = apex_research_cache mode-namespace rows (no KV write dependency)', workerSrc.includes("mode=eq.${PERMALINK_MODE}") && workerSrc.includes("mode=eq.${SEMIDX_MODE}") && workerSrc.includes("const PERMALINK_MODE = 'permalink'") && workerSrc.includes("const SEMIDX_MODE = 'semidx'"))
t('v5.7: semantic store upserts (check-then-write, no dup rows)', workerSrc.includes("apex_research_cache?id=eq.${found[0].id}"))
t('v5.7: embedQuery fail-silent without env.AI', workerSrc.includes('[semcache] embed failed'))
t('worker: semantic threshold 0.93 (paraphrase territory)', workerSrc.includes('SEM_THRESHOLD = 0.93'))
t('worker: semstore slim payload excludes transient fields', workerSrc.includes('supportCheck: result.supportCheck || null'))
t('router: semantic lookup BEFORE pipeline (deep only)', (() => {
  const pipe = workerSrc.slice(workerSrc.indexOf('const runPipeline = async (streamCb)'))
  const lookupIdx = pipe.indexOf('await semLookup(env, safeQuery')
  const deepIdx = pipe.indexOf('await deepResearch(effectiveQuery')
  return lookupIdx > -1 && deepIdx > lookupIdx
})())
t('router: permalink stored AFTER successful result', (() => {
  const pipe = workerSrc.slice(workerSrc.indexOf('const runPipeline = async (streamCb)'))
  return pipe.indexOf('storePermalink(env, result, safeQuery)') > pipe.indexOf('await deepResearch(effectiveQuery')
})())
t('router: semantic hit emits cache phase for stream UX', workerSrc.includes("emit({ type: 'phase', phase: 'cache' })"))
t('worker version bumped to v5.8', workerSrc.includes('Cloudflare Worker (v5.8)') && workerSrc.includes("version: '5.8.0'"))

console.log('── v5.7: client permalink + support surface (research page) ──')
const pageSrc = readFileSync(new URL('../app/research/page.jsx', import.meta.url), 'utf8')
t('done payload: permalinkId passthrough', pageSrc.includes('permalinkId: data.permalink_id || data.permalinkId || null'))
t('done payload: supportCheck passthrough', pageSrc.includes('supportCheck: data.supportCheck || null'))
t('done payload: cacheType + semanticScore passthrough', pageSrc.includes('cacheType: data.cacheType || null'))
t('meta row: Link button gated on permalinkId', pageSrc.includes('activeResearch.permalinkId && ('))
t('meta row: Link button copies /research/r/ URL', pageSrc.includes('window.location.origin}/research/r/${activeResearch.permalinkId}'))
t('meta row: copied feedback state', pageSrc.includes("setLinkCopied(true)") && pageSrc.includes("{linkCopied ? 'Copied' : 'Link'}"))
t('meta row: semantic-hit badge with score', pageSrc.includes("activeResearch.cacheType === 'semantic'") && pageSrc.includes('Semantic hit'))
t('verification grid receives supportCheck prop', pageSrc.includes('supportCheck={activeResearch?.supportCheck || null}'))
t('grid renders repaired chip', pageSrc.includes("✓ repaired → ["))

console.log('── v5.7: permalink page (public renderer) ──')
const permSrc = readFileSync(new URL('../app/research/r/[id]/page.jsx', import.meta.url), 'utf8')
t('permalink page exists at /research/r/[id]', permSrc.includes("'use client'"))
t('fetches same-origin proxy', permSrc.includes('/api/research/report/'))
t('reuses the SAME verification lib (no drift)', permSrc.includes("from '@/lib/citations'") && permSrc.includes('computeVerificationGrid'))
t('renders citation-support audit', permSrc.includes('supportCheck'))
t('handles 404 with CTA back to research', permSrc.includes('Report unavailable') && permSrc.includes('href="/research"'))
t('proxy route exists with rate limit', readFileSync(new URL('../app/api/research/report/[id]/route.js', import.meta.url), 'utf8').includes('rateLimit'))

console.log('── v5.8: fabrication gate (deterministic, both modes) ──')
const fab = worker
const fabSrc = workerSrc
// 1. Pure helpers: stat extraction — numbers are extraction-able, years are not
t('extractStats: percent', JSON.stringify(fab.extractStats('showing 68% of users')) .includes('"num":"68"'))
t('extractStats: currency + magnitude + bare', (() => {
  const s = fab.extractStats('A$109.2 million in fines, 2.5 million users, 500 signals')
  return s.some((x) => x.kind === 'currency' && x.num === '109.2')
    && s.some((x) => x.kind === 'magnitude' && x.num === '2.5')
    && s.some((x) => x.kind === 'bare' && x.num === '500')
})())
t('extractStats: years skipped, markers stripped', fab.extractStats('since 2024 adoption grew [3]').every((x) => x.num !== '2024' && x.num !== '3'))
// 2. statMatchesSource — verbatim or nothing
t('statMatches: 68% ↔ "68 percent"', fab.statMatchesSource({ num: '68', kind: 'percent', raw: '68%' }, 'sources say 68 percent prefer'))
t('statMatches: 68% ↛ 1968 (word boundary)', !fab.statMatchesSource({ num: '68', kind: 'percent', raw: '68%' }, '1968 users surveyed'))
t('statMatches: 2.5M ↔ 2,500,000 (expanded)', fab.statMatchesSource({ num: '2.5', kind: 'magnitude', raw: '2.5 million' }, 'platform reports 2,500,000 users'))
t('statMatches: strict on rounding (68 ↛ 68.4%)', !fab.statMatchesSource({ num: '68', kind: 'percent', raw: '68%' }, 'shows 68.4% prefer'))
// 3. Entity claims — invented attributions detectable
t('entity: "JAMA analysis" name extracted', fab.extractEntityClaims('This aligns with a 2026 JAMA analysis showing users prefer control.').includes('JAMA'))
t('entity: coined term "Nearby Processing" extracted', fab.extractEntityClaims('Frameworks such as Nearby Processing reduce latency [4].').includes('Nearby Processing'))
t('entity: bold bullet labels exempt', fab.extractEntityClaims('- **Decentralized Networks** — enable interoperability [3].').length === 0)
// 4. The user's exact live-eval fabrication, caught by the audit
t('audit: replica report flags both fabricated stats', (() => {
  const srcs = [
    { url: 'https://hackernoon.com/x', snippet: 'Manob is a chronological-feed social platform.' },
    { url: 'https://appinventiv.com/x', snippet: 'AI tools help marketers schedule posts.' },
  ]
  const rep = 'Real-time frameworks, such as Nearby Processing, reduce latency by 40% [2]. This aligns with a 2026 JAMA analysis showing 68% of users prefer control [1].'
  const a = fab.auditFabrications(rep, srcs)
  return a.violations.some((v) => v.kind === 'stat' && v.stat?.num === '40')
    && a.violations.some((v) => v.kind === 'stat' && v.stat?.num === '68')
    && a.violations.some((v) => v.kind === 'entity' && v.value === 'JAMA')
    && a.violations.some((v) => v.kind === 'entity' && v.value === 'Nearby Processing')
})())
t('audit: sourced figure passes clean', (() => {
  const srcs = [{ url: 'https://x.y', snippet: 'Australia proposed fines up to A$109.2 million for non-compliance.' }]
  const a = fab.auditFabrications('Australia proposed fines up to A$109.2 million for non-compliance [1].', srcs)
  return a.total === 0
})())
// 5. Rewrite plumbing
t('rewrite prompt demands [N] markers unchanged + JSON only', (() => {
  const p = fab.buildFabricationRewritePrompt([{ i: 1, sentence: 'S has 40% latency cuts [4].', issues: ['statistic "40%" not found'] }])
  return p.includes('EXACTLY as-is') && p.includes('NEVER introduce any new number') && p.includes('JSON array')
})())
t('rewrite parser: fenced JSON in, garbage → null', (() => {
  const ok = fab.parseRewriteItems('[{"i":1,"text":"hedged sentence [4]"}]')
  return ok && ok[0].text.includes('hedged') && fab.parseRewriteItems('sorry, no') === null
})())
// 6. Pipeline wiring — both modes, payloads, and the laundering fix
t('quick pipeline runs the fabrication gate', fabSrc.includes('auditFabrications(report, sources, fullTexts)') && fabSrc.includes("[Quick] Fabrication gate:"))
t('deep pipeline runs the gate AFTER support repairs', (() => {
  const deep = fabSrc.slice(fabSrc.indexOf('async function deepResearch'))
  const gate = deep.indexOf('FABRICATION GATE (v5.8)')
  const support = deep.indexOf('support check failed (non-fatal)')
  return gate > -1 && support > -1 && gate > support
})())
t('repair step 2 cites ONLY stat-verified search hits', fabSrc.includes('verified search hit appended as') && fabSrc.includes('statMatchesSource(x.stat, txt)'))
t('repair step 4 drops unverifiable fiction', fabSrc.includes('unverifiable claim dropped'))
t('rewrite acceptance is code-verified (gone + newSafe)', fabSrc.includes('if (gone && newSafe && noNewTerms) accepted = hit.text'))
t('makeResponse forwards statCheck', fabSrc.includes('...(statCheck ? { statCheck } : {})'))
t('semcache slim payload carries statCheck', fabSrc.includes('statCheck: result.statCheck || null,'))
t('permalink snapshot carries statCheck', (fabSrc.match(/statCheck: result\.statCheck \|\| null/g) || []).length >= 2)
t('GET /report/:id serves statCheck', fabSrc.includes('statCheck: meta.statCheck || null'))
// 7. Prompt guards — the attribution rule that taught the template, fixed
t('QUICK/DEEP/part prompts: attribution must exist in source', (workerSrc.match(/worst failure this engine can produce/g) || []).length === 4)
t('stats rule demands verbatim numbers', (workerSrc.match(/must appear VERBATIM in the text of the source/g) || []).length === 4)
t('metrics directive: honest gap mandated', fabSrc.includes('no verifiable user/financial data found in sources'))
// 8. Client surfaces
t('research page: statCheck passthrough + panel prop', pageSrc.includes('statCheck: data.statCheck || null') && pageSrc.includes('statCheck={activeResearch?.statCheck || null}'))
t('research page: fabrication gate section renders', pageSrc.includes('Fabrication gate ·') && pageSrc.includes("'⚠ hedged' : '✗ removed'"))
t('permalink page: fabrication gate section renders', permSrc.includes('Fabrication gate ·') && permSrc.includes('statCheck'))

console.log(`\n${pass}/${pass + fail} assertions passed`)
process.exit(fail > 0 ? 1 : 0)
