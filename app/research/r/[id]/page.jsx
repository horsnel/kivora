'use client'
// ── Public report permalink page (v5.7) ──
// /research/r/:id — renders a stored report snapshot (Supabase-backed worker
// permalink store) via the same-origin proxy GET /api/research/report/:id. The 12-hex id is
// the capability: no auth, 90-day TTL. Visual language mirrors the research
// page (same tokens), but this page is a lightweight read-only renderer —
// the trust panel re-derives the verification grid from the stored sources
// + report using the SAME lib the research page uses (lib/citations), so the
// numbers can never drift between the two surfaces.

// Required for Cloudflare Pages edge runtime (next-on-pages: dynamic routes
// must opt into the edge runtime — same pattern as app/explore/[slug])
export const runtime = 'edge'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import remarkGfm from 'remark-gfm'
const ReactMarkdown = dynamic(() => import('react-markdown'), { ssr: false })
import { domainOf, computeVerificationGrid, VERIFICATION_VERDICTS } from '@/lib/citations'

function PermalinkView() {
  const { id } = useParams()
  const [state, setState] = useState({ loading: true, error: null, data: null })

  useEffect(() => {
    let alive = true
    if (!id) return
    setState({ loading: true, error: null, data: null })
    fetch(`/api/research/report/${encodeURIComponent(id)}`)
      .then(async (res) => {
        const body = await res.json().catch(() => ({}))
        if (!alive) return
        if (!res.ok) {
          setState({ loading: false, error: body.error || 'Report not found', data: null })
          return
        }
        setState({ loading: false, error: null, data: body })
      })
      .catch(() => {
        if (alive) setState({ loading: false, error: 'Network error. Please try again.', data: null })
      })
    return () => { alive = false }
  }, [id])

  const report = state.data?.report || ''
  const sources = Array.isArray(state.data?.sources) ? state.data.sources : []
  const grid = useMemo(() => computeVerificationGrid(sources, report), [sources, report])
  const supportCheck = state.data?.supportCheck || null

  if (state.loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white">
        <div className="w-6 h-6 border-2 border-[#262626] border-t-red-500 rounded-full animate-spin" />
      </main>
    )
  }

  if (state.error || !state.data) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center bg-[#0a0a0a] text-white px-4">
        <div className="bg-[#111111] border border-[#1f1f1f] rounded-xl px-6 py-8 max-w-sm w-full text-center">
          <h1 className="text-base font-semibold">Report unavailable</h1>
          <p className="text-xs text-[#737373] mt-2">{state.error || 'This report link is invalid or has expired.'}</p>
          <a href="/research" className="inline-block mt-5 text-xs px-4 py-2 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors">Open Kivora Research</a>
        </div>
      </main>
    )
  }

  const verdict = VERIFICATION_VERDICTS[grid.verdict] || VERIFICATION_VERDICTS.none
  const mode = state.data.mode === 'deep' ? 'Deep' : 'Quick'
  const created = state.data.createdAt ? new Date(state.data.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : null

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-4">

        {/* Header */}
        <div className="flex items-start gap-3">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold leading-snug break-words">{state.data.query || state.data.title || 'Research report'}</h1>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${state.data.mode === 'deep' ? 'bg-red-500 text-white' : 'bg-[#1f1f1f] text-red-400 border border-red-500/30'}`}>{mode}</span>
              {created && <span className="text-[10px] text-[#525252]">{created}</span>}
              <span className="text-[10px] text-[#525252]">· shared via Kivora permalink</span>
            </div>
          </div>
        </div>

        {/* Trust panel — same verification math as the research page */}
        {grid.citedCount > 0 && (
          <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={grid.verdict === 'verified' ? 'text-emerald-400/80' : 'text-amber-400/80'}>
                  <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
                  {grid.verdict === 'verified' ? <path d="m9 12 2 2 4-4" /> : <><path d="M12 8v4" /><path d="M12 16h.01" /></>}
                </svg>
                Verification
              </h2>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${grid.verdict === 'verified' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' : grid.verdict === 'mixed' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
                {grid.verdict === 'verified' ? '✓' : '⚠'} {verdict.label} · {grid.score}%
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-3 flex-wrap text-[10px]">
              <span className="text-emerald-400">{grid.verified} verified</span>
              <span className="text-[#404040]">·</span>
              <span className="text-amber-400">{grid.counts.P3 || 0} community</span>
              <span className="text-[#404040]">·</span>
              <span className="text-red-400">{grid.counts.UNV || 0} unverified</span>
              <span className="text-[#404040]">·</span>
              <span className="text-[#525252]">{grid.citedCount} of {grid.totalSources} sources cited</span>
            </div>
            <p className="text-[11px] text-[#525252] mt-2">{verdict.desc}</p>
            {supportCheck && (supportCheck.unsupported > 0 || supportCheck.partial > 0 || supportCheck.repaired > 0) && (
              <div className="mt-3 pt-3 border-t border-[#1a1a1a]">
                <div className="text-[11px] font-medium text-[#a0a0a0]">
                  Citation support · {supportCheck.supported}/{supportCheck.checked} claims substantiated{supportCheck.repaired > 0 ? ` · ${supportCheck.repaired} auto-repaired` : ''}
                </div>
                {(supportCheck.items || []).slice(0, 5).map((it, i) => (
                  <div key={i} className="flex items-start gap-2 mt-2 text-[11px]">
                    <span className={`px-1.5 py-0.5 rounded font-medium shrink-0 ${it.verdict === 'repaired' ? 'bg-emerald-500/10 text-emerald-400' : it.verdict === 'partial' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'}`}>
                      {it.verdict === 'repaired' ? `✓ repaired → [${it.source}]` : it.verdict === 'partial' ? '⚠ partial' : '✗ unsupported'}
                    </span>
                    <span className="text-[#a0a0a0] min-w-0">{(it.claim || '').replace(/\s+/g, ' ').slice(0, 120)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Report body */}
        {report && (
          <article className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-6 report-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{report}</ReactMarkdown>
          </article>
        )}

        {/* Sources */}
        {sources.length > 0 && (
          <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-4">
            <h2 className="text-sm font-semibold">Sources <span className="text-[#525252] font-normal">({sources.length})</span></h2>
            <div className="mt-3 space-y-2">
              {sources.map((s, i) => (
                <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2.5 text-xs group">
                  <span className="text-[#525252] shrink-0 w-6 text-right">[{i + 1}]</span>
                  <span className="min-w-0">
                    <span className="text-[#d4d4d4] group-hover:text-white transition-colors line-clamp-2">{s.title || domainOf(s.url) || `Source ${i + 1}`}</span>
                    <span className="flex items-center gap-1.5 mt-0.5">
                      <span className={`text-[9px] px-1.5 py-px rounded font-medium ${s.tier === 'P1' ? 'bg-emerald-500/10 text-emerald-400' : s.tier === 'P2' ? 'bg-blue-500/10 text-blue-400' : s.tier === 'P3' ? 'bg-amber-500/10 text-amber-400' : 'bg-[#1f1f1f] text-[#525252]'}`}>{s.tier || 'UNV'}</span>
                      <span className="text-[#525252] truncate">{domainOf(s.url)}</span>
                    </span>
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Follow-ups */}
        {Array.isArray(state.data.followups) && state.data.followups.length > 0 && (
          <div className="bg-[#111111] border border-[#1a1a1a] rounded-xl p-4">
            <h2 className="text-sm font-semibold">Explore further</h2>
            <ul className="mt-2 space-y-1.5">
              {state.data.followups.map((f, i) => (
                <li key={i} className="text-xs text-[#a0a0a0] flex gap-2"><span className="text-[#525252]">{i + 1}.</span>{f}</li>
              ))}
            </ul>
          </div>
        )}

        {/* CTA */}
        <div className="flex items-center justify-between pt-2 pb-8">
          <span className="text-[10px] text-[#525252]">Report generated by Kivora Research · every claim traceable to its source</span>
          <a href="/research" className="text-xs px-4 py-2 rounded-full bg-red-500 hover:bg-red-600 text-white transition-colors shrink-0">Run your own research</a>
        </div>
      </div>
    </main>
  )
}

export default function ReportPermalinkPage() {
  return (
    <Suspense fallback={<main className="min-h-screen flex items-center justify-center bg-[#0a0a0a] text-white"><div className="w-6 h-6 border-2 border-[#262626] border-t-red-500 rounded-full animate-spin" /></main>}>
      <PermalinkView />
    </Suspense>
  )
}
