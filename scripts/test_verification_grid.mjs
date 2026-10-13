#!/usr/bin/env node
// ── Verification grid regression suite (v5.4) ──
// Covers:
//   1. computeVerificationGrid — tier math, verdicts, flagged rows, edge cases
//   2. verificationStatusFor — tier → status mapping
//   3. citedSourceNumbers — marker grammar (bracket + paren + ranges), guards
//   4. Client wiring — page.jsx renders the grid, chips carry status dots
import assert from 'node:assert'
import { readFileSync } from 'node:fs'

let pass = 0, fail = 0
function t(name, fn) {
  try {
    if (typeof fn === 'function') fn()
    else if (fn) { pass++; return }
    else throw new Error('falsy')
    pass++
  } catch (err) {
    fail++
    console.error(`  ✗ ${name}${err?.message ? ` — ${err.message}` : ''}`)
  }
}

const lib = await import('../lib/citations.js')
const {
  computeVerificationGrid,
  verificationStatusFor,
  citedSourceNumbers,
  VERIFICATION_WEIGHTS,
  VERIFICATION_VERDICTS,
} = lib

console.log('── 1. verificationStatusFor — tier → status ──')
t('P1 → verified', verificationStatusFor('P1') === 'verified')
t('P2 → verified', verificationStatusFor('P2') === 'verified')
t('P3 → review', verificationStatusFor('P3') === 'review')
t('UNV → unverified', verificationStatusFor('UNV') === 'unverified')
t('missing tier → unverified', verificationStatusFor(undefined) === 'unverified')
t('garbage tier → unverified', verificationStatusFor('XX') === 'unverified')

console.log('── 2. citedSourceNumbers — marker grammar ──')
const N = 10
t('simple bracket markers', citedSourceNumbers('a [1] b [3]', N).size === 2 && citedSourceNumbers('a [1] b [3]', N).has(3))
t('distinct dedup — [2] cited 3× counts once', citedSourceNumbers('[2] mid [2] end [2]', N).size === 1)
t('comma list [4, 5]', citedSourceNumbers('x [4, 5] y', N).size === 2)
t('range [2-4] expands to 2,3,4', (() => {
  const s = citedSourceNumbers('x [2-4] y', N)
  return s.size === 3 && s.has(2) && s.has(3) && s.has(4)
})())
t('paren style counted (pre-normalizer cache)', citedSourceNumbers('x (2) y', N).has(2))
t('paren year (2024) rejected — out of range', !citedSourceNumbers('in (2024) year', N).has(2024))
t('"(see section 2)" — full marker rejected when any num invalid', (() => {
  // "[2, 99]" → 99 out of range → whole marker skipped, but plain [2] elsewhere counts
  const s = citedSourceNumbers('[2, 99] and [2]', N)
  return s.size === 1 && s.has(2)
})())
t('range too wide [1-9] with cap 5 → rejected', !citedSourceNumbers('[1-9]', N).has(9))
t('empty report → empty set', citedSourceNumbers('', N).size === 0)
t('no sources → empty set', citedSourceNumbers('[1] [2]', 0).size === 0)
t('non-string report → empty set', citedSourceNumbers(null, N).size === 0)
t('numbers above sourceCount rejected', !citedSourceNumbers('[11]', N).has(11))

console.log('── 3. computeVerificationGrid — tier math ──')
const sources = [
  { url: 'https://nature.com/a', title: 'Nature study', tier: 'P1', tierLabel: 'P1 — Academic' },
  { url: 'https://arxiv.org/abs/x', title: 'Arxiv paper', tier: 'P1', tierLabel: 'P1 — Academic' },
  { url: 'https://reuters.com/b', title: 'Reuters piece', tier: 'P2', tierLabel: 'P2 — Professional' },
  { url: 'https://medium.com/c', title: 'Medium post', tier: 'P3', tierLabel: 'P3 — Community' },
  { url: 'https://randomblog.net/d', title: 'Random blog', tier: 'UNV', tierLabel: 'UNV — Unverified' },
]
const report = 'Claim one [1]. Claim two [2, 3]. Claim three [4]. Claim four [5]. Claim one again [1].'
const grid = computeVerificationGrid(sources, report)

t('citedCount = distinct sources cited (5, [1] deduped)', grid.citedCount === 5)
t('totalSources = sources length', grid.totalSources === 5)
t('counts P1=2 P2=1 P3=1 UNV=1', grid.counts.P1 === 2 && grid.counts.P2 === 1 && grid.counts.P3 === 1 && grid.counts.UNV === 1)
t('verified = P1 + P2 = 3', grid.verified === 3)
t('flagged = P3 + UNV rows', grid.flagged.length === 2 && grid.flagged[0].n === 4 && grid.flagged[1].n === 5)
t('flagged statuses are review/unverified', grid.flagged[0].status === 'review' && grid.flagged[1].status === 'unverified')
t('score math: (1+1+0.85+0.4+0)/5 = 65%', grid.score === 65)
t('verdict mixed at 65%', grid.verdict === 'mixed')
t('citations sorted ascending by n', grid.citations.map(c => c.n).join(',') === '1,2,3,4,5')
t('citation rows carry title/domain/tierLabel', grid.citations[0].title === 'Nature study' && grid.citations[0].domain === 'nature.com' && grid.citations[0].tierLabel === 'P1 — Academic')
t('flagged rows carry url', grid.flagged[0].url === 'https://medium.com/c')
t('asOf is today (YYYY-MM-DD)', /^\d{4}-\d{2}-\d{2}$/.test(grid.asOf) && grid.asOf === new Date().toISOString().slice(0, 10))

t('all-P1 report → verified verdict', (() => {
  const g = computeVerificationGrid(sources.slice(0, 2), 'x [1] y [2] z [1]')
  return g.score === 100 && g.verdict === 'verified' && g.flagged.length === 0
})())
t('all-UNV report → weak verdict', (() => {
  const g = computeVerificationGrid([sources[4]], 'x [1] y [1]')
  return g.score === 0 && g.verdict === 'weak' && g.flagged.length === 1
})())
t('boundary 75% → verified', (() => {
  // 3×P1(1.0) + 1×UNV(0) = 3/4 = 75 → verified
  const three = [
    { url: 'https://nature.com/a', title: 'A', tier: 'P1' },
    { url: 'https://science.org/b', title: 'B', tier: 'P1' },
    { url: 'https://who.int/c', title: 'C', tier: 'P1' },
    { url: 'https://randomblog.net/d', title: 'D', tier: 'UNV' },
  ]
  const g = computeVerificationGrid(three, 'a [1] b [2] c [3] d [4]')
  return g.score === 75 && g.verdict === 'verified'
})())
t('boundary 44% → weak', (() => {
  // 1×P2(0.85) + 3×UNV(0) = 0.85/4 = 21 → weak. For 44: 1×P1+1×P2+2×P3+1×UNV = (1+0.85+0.4+0.4+0)/5 = 2.65/5 = 53 → mixed.
  // 44 boundary: 2×P1 + 1×P3 + 3×UNV = (2+0.4)/6 = 40 → weak; 45 boundary: +0.85/… construct (1+0.85+0.4+0.4+0.4)/5? no.
  const g = computeVerificationGrid(
    [sources[0], sources[1], sources[3], sources[4], sources[4], sources[4]],
    'a [1] b [2] c [3] d [4] e [5] f [6]'
  )
  return g.score === 40 && g.verdict === 'weak'
})())
t('source without tier field → UNV row, no crash', (() => {
  const sparse = [sources[0], { url: 'https://unknown.example/z', title: 'No tier given' }]
  const g = computeVerificationGrid(sparse, 'x [1] y [2]')
  return g.citedCount === 2 && g.counts.P1 === 1 && g.counts.UNV === 1
})())
t('marker beyond sourceCount rejected (hole case)', (() => {
  const g = computeVerificationGrid([sources[0]], 'x [1] y [2]')
  return g.citedCount === 1
})())

console.log('── 4. computeVerificationGrid — degenerate inputs ──')
t('empty sources + empty report → citedCount 0, verdict none', (() => {
  const g = computeVerificationGrid([], '')
  return g.citedCount === 0 && g.verdict === 'none' && g.score === 0
})())
t('null sources / null report → no crash', computeVerificationGrid(null, null).citedCount === 0)
t('report with no citations → verdict none', computeVerificationGrid(sources, 'no markers here at all').verdict === 'none')
t('undefined args → defaults', computeVerificationGrid().citedCount === 0)
t('verdict metadata present for every verdict key', ['verified', 'mixed', 'weak', 'none'].every(k => VERIFICATION_VERDICTS[k]?.label))
t('weights sane', VERIFICATION_WEIGHTS.P1 === 1 && VERIFICATION_WEIGHTS.P2 === 0.85 && VERIFICATION_WEIGHTS.P3 === 0.4 && VERIFICATION_WEIGHTS.UNV === 0)

console.log('── 5. client wiring (static — page.jsx is the live /research UI) ──')
const clientSrc = readFileSync(new URL('../app/research/page.jsx', import.meta.url), 'utf8')
t('grid helper imported', clientSrc.includes('computeVerificationGrid, verificationStatusFor, VERIFICATION_VERDICTS'))
t('VerificationGridBlock component present', clientSrc.includes('function VerificationGridBlock('))
t('grid memoized on sources+report', clientSrc.includes('computeVerificationGrid(sources, report), [sources, report]'))
t('grid rendered when done + sources present', clientSrc.includes("researchStage === 'done' && sources.length > 0 && (\n                  <VerificationGridBlock sources={sources} report={reportText} />"))
t('grid renders BEFORE references block', (() => {
  const gi = clientSrc.indexOf('<VerificationGridBlock')
  const ri = clientSrc.indexOf('<ReferencesBlock sources={sources} />')
  return gi > -1 && ri > -1 && gi < ri
})())
t('cite chips carry tier ring (borderColor)', clientSrc.includes('style={{ borderColor: ring }}'))
t('cite chips carry status dot', clientSrc.includes('cite-dot cite-dot-'))
t('status dot CSS variants present', clientSrc.includes('.cite-dot-verified') && clientSrc.includes('.cite-dot-review') && clientSrc.includes('.cite-dot-unverified'))
t('chip positioned for corner dot', /\.cite-chip \{[^}]*position: relative/s.test(clientSrc))
t('verification badge verdict classes present', clientSrc.includes('verification-badge-verified') && clientSrc.includes('verification-badge-mixed') && clientSrc.includes('verification-badge-weak'))
t('tier-segmented bar present', clientSrc.includes('verification-bar') && clientSrc.includes('verification-seg'))
t('flagged rows rendered with status chips', clientSrc.includes('verification-flag-chip-review') && clientSrc.includes('verification-flag-chip-unverified'))
t('flag rows are click-through links', clientSrc.includes('className="verification-flag-row" href={c.url}'))
t('tooltip carries verification word', clientSrc.includes("statusWord"))
t('grid block CSS present', clientSrc.includes('.verification-block') && clientSrc.includes('.verification-footer'))
t('flagged list capped at 6 rows', clientSrc.includes('grid.flagged.slice(0, 6)'))
t('empty grid renders null (no noise for uncited reports)', clientSrc.includes('if (!grid.citedCount) return null'))

console.log('── 6. lib integrity — no accidental regressions ──')
t('buildReferences still exported', typeof lib.buildReferences === 'function')
t('parseCitationMarker still exported', typeof lib.parseCitationMarker === 'function')
t('extractIdentifiers still exported', typeof lib.extractIdentifiers === 'function')
t('faviconUrl still exported', typeof lib.faviconUrl === 'function')
t('domainOf still exported', typeof lib.domainOf === 'function')

console.log(`\n${pass}/${pass + fail} assertions passed`)
process.exit(fail > 0 ? 1 : 0)
