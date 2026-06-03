export const runtime = 'edge'

import { rateLimit } from '@/lib/ratelimit'

const APEX_API_URL = process.env.APEX_API_URL || 'https://apex-research-agent-production.up.railway.app'

// ── Escape HTML to prevent XSS ──
function esc(str) {
  if (!str) return ''
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── Render inline markdown (bold, links, citations) to HTML ──
function inlineMd(text) {
  if (!text) return ''
  let html = esc(text)
  // Bold: **text** or __text__
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/__(.+?)__/g, '<strong>$1</strong>')
  // Links: [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-red-400 hover:text-red-300 underline underline-offset-2">$1</a>')
  // Citation numbers: [1], [2], etc.
  html = html.replace(/\[(\d+)\]/g, '<sup class="text-red-400 font-mono text-[10px] cursor-default" title="Source $1">[$1]</sup>')
  return html
}

// ── Tier badge HTML ──
function tierBadge(tier) {
  if (!tier) return ''
  const colors = {
    P1: 'bg-green-500/15 text-green-400 border-green-500/30',
    P2: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
    P3: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    UNV: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
  }
  const cls = colors[tier] || colors.UNV
  return `<span class="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded border ${cls}">${esc(tier)}</span>`
}

// ── Status badge HTML ──
function statusBadge(status) {
  if (!status) return ''
  const colors = {
    ESTABLISHED: 'bg-green-500/15 text-green-400',
    TENTATIVE: 'bg-yellow-500/15 text-yellow-400',
    ACTIVE_DEBATE: 'bg-red-500/15 text-red-400',
    SPECULATIVE: 'bg-purple-500/15 text-purple-400',
    UNVERIFIED: 'bg-gray-500/15 text-gray-400',
  }
  const cls = colors[status] || 'bg-gray-500/15 text-gray-400'
  return `<span class="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded ${cls}">${esc(status.replace(/_/g, ' '))}</span>`
}

// ── Confidence bar HTML ──
function confidenceBar(confidence) {
  if (confidence == null) return ''
  const pct = Math.round(confidence * 100)
  const color = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'
  return `
    <div class="flex items-center gap-2">
      <div class="w-16 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
        <div class="h-full ${color} rounded-full" style="width:${pct}%"></div>
      </div>
      <span class="text-[10px] text-[#737373]">${pct}%</span>
    </div>`
}

// ── Build rich HTML report from APEX structured data ──
function buildHtmlReport(apexData, sources) {
  const parts = []

  // ─── Executive Summary ───
  if (apexData.executive_summary) {
    parts.push(`
      <div class="mb-6">
        <h2 class="text-lg font-semibold text-white mt-0 mb-2.5">Executive Summary</h2>
        <p class="text-sm text-[#c0c0c0] leading-relaxed">${inlineMd(apexData.executive_summary)}</p>
      </div>`)
  }

  // ─── Key Findings Table ───
  if (apexData.findings?.length) {
    const rows = apexData.findings.map(f => `
      <tr>
        <td class="px-3 py-2.5 text-sm text-[#c0c0c0] leading-relaxed">${inlineMd(f.finding || f.statement || '')}</td>
        <td class="px-3 py-2.5 text-sm text-[#a0a0a0] leading-relaxed">${inlineMd(f.evidence || '')}</td>
        <td class="px-3 py-2.5 text-center">${tierBadge(f.tier)}</td>
        <td class="px-3 py-2.5 text-center">${statusBadge(f.status)}</td>
      </tr>`).join('')

    parts.push(`
      <div class="mb-6">
        <h2 class="text-lg font-semibold text-white mt-0 mb-2.5">Key Findings</h2>
        <div class="overflow-x-auto -mx-1 px-1">
          <table class="w-full text-left">
            <thead>
              <tr>
                <th class="px-3 py-2 text-[11px] font-semibold text-[#737373] uppercase tracking-wider">Finding</th>
                <th class="px-3 py-2 text-[11px] font-semibold text-[#737373] uppercase tracking-wider">Evidence</th>
                <th class="px-3 py-2 text-[11px] font-semibold text-[#737373] uppercase tracking-wider text-center">Tier</th>
                <th class="px-3 py-2 text-[11px] font-semibold text-[#737373] uppercase tracking-wider text-center">Status</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      </div>`)
  }

  // ─── Verification Claims ───
  if (apexData.verification?.claims?.length) {
    const claims = apexData.verification.claims.map(c => `
      <tr>
        <td class="px-3 py-2.5 text-sm text-[#c0c0c0] leading-relaxed">${inlineMd(c.statement || '')}</td>
        <td class="px-3 py-2.5 text-center">${statusBadge(c.status)}</td>
        <td class="px-3 py-2.5">${confidenceBar(c.confidence)}</td>
        <td class="px-3 py-2.5 text-sm text-[#a0a0a0] text-center">${c.supporting_count || 0}<span class="text-[#525252]">/</span><span class="text-red-400">${c.conflicting_count || 0}</span></td>
        <td class="px-3 py-2.5 text-xs text-[#737373]">${esc(c.evidence_type || '')}</td>
      </tr>`).join('')

    parts.push(`
      <div class="mb-6">
        <h2 class="text-lg font-semibold text-white mt-0 mb-2.5">Verification</h2>
        <div class="overflow-x-auto -mx-1 px-1">
          <table class="w-full text-left">
            <thead>
              <tr>
                <th class="px-3 py-2 text-[11px] font-semibold text-[#737373] uppercase tracking-wider">Claim</th>
                <th class="px-3 py-2 text-[11px] font-semibold text-[#737373] uppercase tracking-wider text-center">Status</th>
                <th class="px-3 py-2 text-[11px] font-semibold text-[#737373] uppercase tracking-wider">Confidence</th>
                <th class="px-3 py-2 text-[11px] font-semibold text-[#737373] uppercase tracking-wider text-center">Support/Conflict</th>
                <th class="px-3 py-2 text-[11px] font-semibold text-[#737373] uppercase tracking-wider">Evidence Type</th>
              </tr>
            </thead>
            <tbody>${claims}</tbody>
          </table>
        </div>
      </div>`)

    // Verification summary bar
    const vs = apexData.verification.summary
    if (vs) {
      const total = (vs.established || 0) + (vs.tentative || 0) + (vs.contested || 0) + (vs.unverifiable || 0)
      if (total > 0) {
        const pct = (v) => Math.round(((v || 0) / total) * 100)
        parts.push(`
          <div class="mb-6 flex items-center gap-3 flex-wrap">
            <span class="text-[10px] text-[#525252] uppercase tracking-wider font-semibold mr-1">Verification Summary</span>
            ${vs.established ? `<span class="text-[10px] px-2 py-1 rounded-full bg-green-500/15 text-green-400 font-medium">${vs.established} Established</span>` : ''}
            ${vs.tentative ? `<span class="text-[10px] px-2 py-1 rounded-full bg-yellow-500/15 text-yellow-400 font-medium">${vs.tentative} Tentative</span>` : ''}
            ${vs.contested ? `<span class="text-[10px] px-2 py-1 rounded-full bg-red-500/15 text-red-400 font-medium">${vs.contested} Contested</span>` : ''}
            ${vs.unverifiable ? `<span class="text-[10px] px-2 py-1 rounded-full bg-gray-500/15 text-gray-400 font-medium">${vs.unverifiable} Unverifiable</span>` : ''}
            <span class="text-[10px] text-[#404040]">${vs.total_sources_checked || 0} sources checked</span>
          </div>`)
      }
    }
  }

  // ─── Active Debates ───
  if (apexData.debates?.length) {
    const debateItems = apexData.debates
      .filter(d => {
        const text = d.point || d || ''
        return text && text !== 'None' && text.toLowerCase() !== 'none'
      })
      .map(d => `
        <li class="text-sm text-[#a0a0a0] leading-relaxed pl-1">${inlineMd(d.point || d)}</li>`)
      .join('')

    if (debateItems) {
      parts.push(`
        <div class="mb-6">
          <h2 class="text-lg font-semibold text-white mt-0 mb-2.5">Active Debates</h2>
          <ul class="space-y-1.5 mb-3 ml-1">${debateItems}</ul>
        </div>`)
    }
  }

  // ─── Speculative Findings ───
  if (apexData.speculative?.length) {
    const specItems = apexData.speculative
      .filter(s => s && s !== 'None' && s.toLowerCase() !== 'none')
      .map(s => `
        <li class="text-sm text-[#a0a0a0] leading-relaxed pl-1">${inlineMd(s)}</li>`)
      .join('')

    if (specItems) {
      parts.push(`
        <div class="mb-6">
          <h2 class="text-lg font-semibold text-white mt-0 mb-2.5">Speculative Findings</h2>
          <ul class="space-y-1.5 mb-3 ml-1">${specItems}</ul>
        </div>`)
    }
  }

  // ─── Methodology Notes (from raw_report if available) ───
  const rawReport = apexData.raw_report || ''
  const methodologyMatch = rawReport.match(/##\s*METHODOLOGY\s+NOTES\s*\n([\s\S]*?)(?=\n##\s|\n##\s*SOURCES|$)/i)
  if (methodologyMatch && methodologyMatch[1].trim()) {
    const methodText = methodologyMatch[1].trim()
    // Split into paragraphs
    const paragraphs = methodText.split(/\n\n+/).filter(p => p.trim()).map(p =>
      `<p class="text-sm text-[#a0a0a0] leading-relaxed mb-2">${inlineMd(p)}</p>`
    ).join('')
    parts.push(`
      <div class="mb-6">
        <h2 class="text-lg font-semibold text-white mt-0 mb-2.5">Methodology Notes</h2>
        ${paragraphs}
      </div>`)
  }

  // ─── Sources ───
  if (sources.length > 0) {
    const sourceItems = sources.map((s, i) => {
      const domain = (() => { try { return new URL(s.url).hostname.replace('www.', '') } catch { return '' } })()
      const tierHtml = s.status === 'deep' ? '<span class="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1.5"></span>' : '<span class="inline-block w-1.5 h-1.5 rounded-full bg-green-500/60 mr-1.5"></span>'
      return `
        <div class="flex items-start gap-2 py-1.5">
          ${tierHtml}
          <div class="min-w-0 flex-1">
            <a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" class="text-sm text-red-400 hover:text-red-300 font-medium leading-snug hover:underline underline-offset-2">${esc(s.title)}</a>
            ${domain ? `<span class="text-[10px] text-[#525252] ml-2">${esc(domain)}</span>` : ''}
            ${s.snippet ? `<p class="text-[11px] text-[#525252] leading-snug mt-0.5 line-clamp-2">${esc(s.snippet)}</p>` : ''}
          </div>
          <span class="text-[10px] text-[#404040] shrink-0">[${i + 1}]</span>
        </div>`
    }).join('')

    parts.push(`
      <div class="mb-2">
        <h2 class="text-lg font-semibold text-white mt-0 mb-2.5">Sources</h2>
        <div class="divide-y divide-[#1a1a1a]">${sourceItems}</div>
      </div>`)
  }

  return parts.join('\n')
}

// ── Build plain-text markdown report (for copy button) ──
function buildMarkdownReport(apexData, sources) {
  const lines = []

  if (apexData.executive_summary) {
    lines.push('## Executive Summary')
    lines.push(apexData.executive_summary)
    lines.push('')
  }

  if (apexData.findings?.length) {
    lines.push('## Key Findings')
    lines.push('| Finding | Evidence | Tier | Status |')
    lines.push('|---------|----------|------|--------|')
    for (const f of apexData.findings) {
      lines.push(`| ${(f.finding || f.statement || '').replace(/\|/g, '/')} | ${(f.evidence || '').replace(/\|/g, '/')} | ${f.tier || ''} | ${f.status || ''} |`)
    }
    lines.push('')
  }

  if (apexData.verification?.claims?.length) {
    lines.push('## Verification')
    lines.push('| Claim | Status | Confidence | Evidence Type |')
    lines.push('|-------|--------|------------|---------------|')
    for (const c of apexData.verification.claims) {
      const pct = c.confidence != null ? Math.round(c.confidence * 100) + '%' : ''
      lines.push(`| ${(c.statement || '').replace(/\|/g, '/')} | ${c.status || ''} | ${pct} | ${c.evidence_type || ''} |`)
    }
    lines.push('')
    if (apexData.verification.summary) {
      const vs = apexData.verification.summary
      lines.push(`**Summary:** ${vs.established || 0} established, ${vs.tentative || 0} tentative, ${vs.contested || 0} contested, ${vs.unverifiable || 0} unverifiable (${vs.total_sources_checked || 0} sources checked)`)
      lines.push('')
    }
  }

  if (apexData.debates?.length) {
    const validDebates = apexData.debates.filter(d => {
      const t = d.point || d || ''
      return t && t !== 'None' && t.toLowerCase() !== 'none'
    })
    if (validDebates.length) {
      lines.push('## Active Debates')
      for (const d of validDebates) lines.push(`- ${d.point || d}`)
      lines.push('')
    }
  }

  if (apexData.speculative?.length) {
    const validSpec = apexData.speculative.filter(s => s && s !== 'None' && s.toLowerCase() !== 'none')
    if (validSpec.length) {
      lines.push('## Speculative Findings')
      for (const s of validSpec) lines.push(`- ${s}`)
      lines.push('')
    }
  }

  // Methodology from raw_report
  const rawReport = apexData.raw_report || ''
  const methodologyMatch = rawReport.match(/##\s*METHODOLOGY\s+NOTES\s*\n([\s\S]*?)(?=\n##\s|\n##\s*SOURCES|$)/i)
  if (methodologyMatch && methodologyMatch[1].trim()) {
    lines.push('## Methodology Notes')
    lines.push(methodologyMatch[1].trim())
    lines.push('')
  }

  if (sources.length > 0) {
    lines.push('## Sources')
    sources.forEach((s, i) => {
      lines.push(`${i + 1}. [${s.title}](${s.url})`)
    })
  }

  return lines.join('\n')
}

// ── Convert APEX research response to Kivora frontend format ──
function formatApexResponse(apexData, query, mode) {
  // Build sources array from APEX sources
  const sources = (apexData.sources || []).map((s, i) => ({
    id: i,
    url: s.url || '',
    title: s.title || `Source ${i + 1}`,
    snippet: s.snippet || '',
    favicon: s.favicon || '',
    status: s.tier === 'P1' ? 'deep' : 'loaded',
  }))

  // Build rich HTML content from APEX structured data
  const content = buildHtmlReport(apexData, sources)

  // Build plain markdown for copy button
  const report = buildMarkdownReport(apexData, sources)

  // Extract title from executive_summary or query
  const title = apexData.executive_summary
    ? apexData.executive_summary.split(/[.!?]/)[0].trim().slice(0, 80)
    : query

  // Generate followups from sub_queries
  const followups = (apexData.sub_queries || [])
    .filter(q => q && q !== query)
    .map(q => q.endsWith('?') ? q : q + '?')
    .slice(0, 5)

  // If no followups from APEX, generate some from the findings
  if (followups.length === 0 && apexData.findings?.length) {
    const findings = apexData.findings.slice(0, 3)
    for (const f of findings) {
      const text = f.finding || f.statement || ''
      if (text) followups.push(`What evidence supports: "${text.slice(0, 60)}"?`)
    }
  }

  // Pass verification data for the Data tile
  const data = apexData.verification || null

  return {
    sources,
    report,
    content,
    title,
    followups,
    data,
    mode,
  }
}

export async function POST(req) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!rateLimit(ip).ok) {
    return Response.json({ error: 'Too many requests. Please slow down.' }, { status: 429 })
  }

  try {
    const { query, mode = 'quick' } = await req.json()

    if (!query || typeof query !== 'string') {
      return Response.json({ error: 'Query is required' }, { status: 400 })
    }

    // Call APEX Research Agent API
    const apexResponse = await fetch(`${APEX_API_URL}/research`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        classification: 'web',
        depth: mode === 'deep' ? 'thorough' : 'quick',
        verify: true,
        extract: false,
        check_retractions: false,
        force_live: true,
      }),
    })

    if (!apexResponse.ok) {
      const errText = await apexResponse.text().catch(() => 'Unknown error')
      console.error('[research] APEX API error:', apexResponse.status, errText)
      return Response.json(
        { error: `Research service error (${apexResponse.status}). Please try again.` },
        { status: 502 }
      )
    }

    const apexData = await apexResponse.json()

    // Convert APEX response to Kivora frontend format
    const result = formatApexResponse(apexData, query, mode)

    return Response.json(result)
  } catch (error) {
    console.error('[research] API error:', error)
    return Response.json({ error: error.message || 'Research failed' }, { status: 500 })
  }
}
