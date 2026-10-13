// ── Kivora research citations — premium traceability layer (v5.3) ──
// Deterministic, client-side citation upgrades driven by the enriched sources
// array (available on BOTH fresh and cache-hit paths). No server contract
// changes — everything here derives from data the client already has.
//
// Addresses the "premium checklist" failures:
//   - bare (2)/(3) citations with no identifiers → logo chips + References
//     block with DOI / PMID / NCT / PMC links extracted from source URLs
//   - no versioning → "as of <date>" retrieval stamp
//   - no reproducibility → "searched via <databases>" line

// Extract scholarly/registry identifiers from a source URL.
// Pure string matching — never guesses, never hallucinates.
export function extractIdentifiers(url = '') {
  const out = { doi: null, pmid: null, nct: null, pmc: null }
  if (!url || typeof url !== 'string') return out
  let m = url.match(/doi\.org\/(10\.[^\s?#]+)/i)
  if (m) out.doi = decodeURIComponent(m[1])
  m = url.match(/pubmed\.ncbi\.nlm\.nih\.gov\/(\d{4,})/i)
  if (m) out.pmid = m[1]
  m = url.match(/clinicaltrials\.gov\/(?:study|show|ct2\/show)\/(NCT\d+)/i)
  if (m) out.nct = m[1]
  m = url.match(/ncbi\.nlm\.nih\.gov\/pmc\/articles\/(PMC\d+)/i)
  if (m) out.pmc = m[1]
  return out
}

// Crisp favicon URL for a source (Google s2 public service, 64px renders
// sharply at 14-20px chip sizes). Fallbacks (DuckDuckGo → letter avatar)
// live in the client component's onError chain.
export function faviconUrl(url = '', sz = 64) {
  if (!url || typeof url !== 'string') return null
  const domain = domainOf(url)
  if (!domain) return null
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=${sz}`
}

export function domainOf(url = '') {
  if (!url || typeof url !== 'string') return ''
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

// Deterministic references model for the References block.
// Numbering MUST match the [N] citation markers in the report: source index
// i (0-based) → reference n = i+1.
export function buildReferences(sources = []) {
  const list = Array.isArray(sources) ? sources : []
  const refs = list.map((s, i) => ({
    n: i + 1,
    title: s?.title || domainOf(s?.url) || `Source ${i + 1}`,
    url: s?.url || '',
    domain: domainOf(s?.url),
    year: s?.year || null,
    tier: s?.tier || 'UNV',
    ...extractIdentifiers(s?.url),
  }))
  const databases = [...new Set(list.map(s => s?.sourceType).filter(Boolean))]
  return {
    asOf: new Date().toISOString().slice(0, 10),
    databases,
    refs,
    hasIdentifiers: refs.some(r => r.doi || r.pmid || r.nct || r.pmc),
  }
}

// ── Verification grid (v5.4) — per-claim ✅/⚠️ driven by source tiers ──
// The pipeline already tiers every source (P1 academic / P2 professional /
// P3 community / UNV unverified). The grid maps the report's [N] markers
// onto those tiers: a claim's verification status IS the tier of the source
// it cites. Computed client-side from data already in hand (fresh, cache
// hit, and history paths) — zero wire changes, works retroactively.

// Claim → status. P1/P2 = verified (✅), P3 = needs review (⚠️ amber),
// UNV = unverified (⚠️ red).
export function verificationStatusFor(tier) {
  if (tier === 'P1' || tier === 'P2') return 'verified'
  if (tier === 'P3') return 'review'
  return 'unverified'
}

export const VERIFICATION_WEIGHTS = { P1: 1, P2: 0.85, P3: 0.4, UNV: 0 }

export const VERIFICATION_VERDICTS = {
  verified: { label: 'Verified', desc: 'Cited claims are backed by primary or professional sources' },
  mixed: { label: 'Mixed', desc: 'Some cited claims rest on community or unverified sources' },
  weak: { label: 'Weak', desc: 'Most cited claims lack primary or professional sourcing' },
  none: { label: 'No citations', desc: 'The report carries no resolvable citations' },
}

// Distinct [N] markers cited in the report (bracket AND paren styles — the
// worker normalizes to brackets, but pre-normalizer cache entries may still
// carry parens). Every number must resolve to a real source index, so
// "(2024)" and "(see section 2)" can never inflate the counts.
export function citedSourceNumbers(report, sourceCount) {
  const cited = new Set()
  if (!report || typeof report !== 'string' || !Number.isFinite(sourceCount) || sourceCount < 1) return cited
  const re = /[\[(](\d+(?:\s*[-,]\s*\d+)*)[\])]/g
  let m
  while ((m = re.exec(report))) {
    const inner = m[1]
    const nums = []
    if (inner.includes('-')) {
      const [a, b] = inner.split('-').map(x => parseInt(x.trim(), 10))
      if (Number.isFinite(a) && Number.isFinite(b) && b > a && b - a <= 5) {
        for (let i = a; i <= b; i++) nums.push(i)
      }
    } else {
      for (const p of inner.split(',')) {
        const n = parseInt(p.trim(), 10)
        if (Number.isFinite(n)) nums.push(n)
      }
    }
    for (const n of nums) if (n >= 1 && n <= sourceCount) cited.add(n)
  }
  return cited
}

export function computeVerificationGrid(sources = [], report = '') {
  const list = Array.isArray(sources) ? sources : []
  const cited = citedSourceNumbers(report, list.length)

  const citations = [...cited].sort((a, b) => a - b).map((n) => {
    const s = list[n - 1] || {}
    const tier = s.tier || 'UNV'
    return {
      n,
      tier,
      status: verificationStatusFor(tier),
      tierLabel: s.tierLabel || '',
      title: s.title || '',
      domain: domainOf(s.url),
      url: s.url || '',
    }
  })

  const counts = { P1: 0, P2: 0, P3: 0, UNV: 0 }
  for (const c of citations) counts[c.tier] = (counts[c.tier] || 0) + 1

  const verified = counts.P1 + counts.P2
  const flagged = citations.filter(c => c.status !== 'verified')
  const score = citations.length
    ? Math.round((citations.reduce((acc, c) => acc + (VERIFICATION_WEIGHTS[c.tier] || 0), 0) / citations.length) * 100)
    : 0
  const verdict = citations.length === 0 ? 'none'
    : score >= 75 ? 'verified'
    : score >= 45 ? 'mixed' : 'weak'

  return {
    citedCount: citations.length,
    totalSources: list.length,
    counts,
    verified,
    flagged,
    score,
    verdict,
    citations,
    asOf: new Date().toISOString().slice(0, 10),
  }
}

// Citation marker grammar shared with the renderer:
//   bracket style: [2]  [4, 5]  [2-4]   (authoritative — prompts demand it)
//   paren style:   (2)  (4, 5)  (2-4)   (8b-model drift — validated at render)
// Returns { marker, nums, isParen } or null. A marker is only a citation if
// EVERY number it contains can resolve to a source (guards "(2024)" and
// "(see section 2)" from being eaten).
export function parseCitationMarker(text, sourceCount) {
  if (!text || typeof text !== 'string' || !Number.isFinite(sourceCount) || sourceCount < 1) return null
  const m = text.match(/^[\[(](\d+(?:\s*[-,]\s*\d+)*)[\])]$/)
  if (!m) return null
  const isParen = text.startsWith('(')
  const nums = []
  const rangePart = m[1]
  if (rangePart.includes('-')) {
    const [a, b] = rangePart.split('-').map(x => parseInt(x.trim(), 10))
    if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a || b - a > 5) return null
    for (let i = a; i <= b; i++) nums.push(i)
  } else {
    for (const piece of rangePart.split(',')) {
      const n = parseInt(piece.trim(), 10)
      if (!Number.isFinite(n)) return null
      nums.push(n)
    }
  }
  if (nums.length === 0 || nums.length > 6) return null
  if (nums.some(n => n < 1 || n > sourceCount)) return null
  return { marker: text, nums, isParen }
}
