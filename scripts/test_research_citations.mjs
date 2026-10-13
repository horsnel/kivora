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

console.log(`\n${pass}/${pass + fail} assertions passed`)
process.exit(fail > 0 ? 1 : 0)
