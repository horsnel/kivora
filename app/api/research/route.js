export const runtime = 'edge'

import { rateLimit } from '@/lib/ratelimit'

const APEX_API_URL = process.env.APEX_API_URL || 'https://apex-research-agent-production.up.railway.app'

// ══════════════════════════════════════════════
//  Full markdown → HTML converter (edge-safe)
//  Handles: headers, bold, italic, links, citations,
//  lists, tables, horizontal rules, blockquotes
// ══════════════════════════════════════════════

function mdToHtml(md) {
  if (!md) return ''
  const lines = md.split('\n')
  const out = []
  let i = 0

  // Inline formatting: bold, italic, links, citations, code
  function inline(raw) {
    let s = raw
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Inline code
    s = s.replace(/`([^`]+)`/g, '<code class="bg-[#1a1a1a] text-red-300 px-1 py-0.5 rounded text-[12px] font-mono">$1</code>')
    // Bold
    s = s.replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
    s = s.replace(/__(.+?)__/g, '<strong class="text-white font-semibold">$1</strong>')
    // Italic
    s = s.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
    s = s.replace(/(?<!_)_(?!_)(.+?)(?<!_)_(?!_)/g, '<em>$1</em>')
    // Links: [text](url)
    s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-red-400 hover:text-red-300 underline underline-offset-2">$1</a>')
    // Citation numbers: [1], [2] etc. (not links)
    s = s.replace(/\[(\d+)\]/g, '<sup class="text-red-400/80 font-mono text-[10px]">[$1]</sup>')
    return s
  }

  while (i < lines.length) {
    const line = lines[i]
    const trimmed = line.trim()

    // ── Skip empty lines ──
    if (!trimmed) { i++; continue }

    // ── Headers ──
    if (trimmed.startsWith('### ')) {
      out.push(`<h3 class="text-base font-semibold text-white mt-5 mb-2">${inline(trimmed.slice(4))}</h3>`)
      i++; continue
    }
    if (trimmed.startsWith('## ')) {
      out.push(`<h2 class="text-lg font-semibold text-white mt-6 mb-2.5">${inline(trimmed.slice(3))}</h2>`)
      i++; continue
    }
    if (trimmed.startsWith('# ')) {
      out.push(`<h1 class="text-xl font-bold text-white mt-4 mb-3">${inline(trimmed.slice(2))}</h1>`)
      i++; continue
    }

    // ── Horizontal rule ──
    if (/^---+$/.test(trimmed)) {
      out.push('<hr class="border-[#1a1a1a] my-4"/>')
      i++; continue
    }

    // ── Blockquote ──
    if (trimmed.startsWith('> ')) {
      const quoteLines = []
      while (i < lines.length && lines[i].trim().startsWith('> ')) {
        quoteLines.push(lines[i].trim().slice(2))
        i++
      }
      out.push(`<blockquote class="border-l-2 border-red-500/40 pl-4 my-3 text-sm text-[#a0a0a0] leading-relaxed italic">${inline(quoteLines.join(' '))}</blockquote>`)
      continue
    }

    // ── Markdown Table ──
    if (trimmed.includes('|') && trimmed.trimStart().startsWith('|')) {
      const tableLines = []
      while (i < lines.length && lines[i].trim().includes('|') && lines[i].trimStart().startsWith('|')) {
        tableLines.push(lines[i])
        i++
      }
      // Parse table
      const rows = tableLines
        .map(l => l.split('|').map(c => c.trim()).filter(c => c !== ''))
        .filter(row => row.length > 0 && !row.every(cell => /^[-:]+$/.test(cell)))

      if (rows.length >= 1) {
        const headers = rows[0]
        const bodyRows = rows.slice(1)
        const thCells = headers.map(h => `<th class="px-3 py-2 text-[11px] font-semibold text-[#737373] uppercase tracking-wider bg-[#111]">${inline(h)}</th>`).join('')
        const tbodyRows = bodyRows.map(row => {
          const tds = headers.map((_, ci) => {
            const cell = row[ci] || ''
            return `<td class="px-3 py-2.5 text-sm text-[#a0a0a0] leading-relaxed border-t border-[#1a1a1a]">${inline(cell)}</td>`
          }).join('')
          return `<tr>${tds}</tr>`
        }).join('')
        out.push(`<div class="overflow-x-auto -mx-1 px-1 mb-4"><table class="w-full text-left border-collapse separate border-spacing-0 rounded-xl overflow-hidden border border-[#1a1a1a]"><thead><tr>${thCells}</tr></thead><tbody>${tbodyRows}</tbody></table></div>`)
      }
      continue
    }

    // ── Unordered list ──
    if (/^[-*]\s/.test(trimmed)) {
      const items = []
      while (i < lines.length && /^[-*]\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s/, ''))
        i++
      }
      const lis = items.map(it => `<li class="text-sm text-[#a0a0a0] leading-relaxed pl-1">${inline(it)}</li>`).join('')
      out.push(`<ul class="space-y-1 mb-3 ml-1">${lis}</ul>`)
      continue
    }

    // ── Ordered list ──
    if (/^\d+\.\s/.test(trimmed)) {
      const items = []
      while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^\d+\.\s/, ''))
        i++
      }
      const lis = items.map(it => `<li class="text-sm text-[#a0a0a0] leading-relaxed pl-1 list-decimal ml-4">${inline(it)}</li>`).join('')
      out.push(`<ol class="space-y-1 mb-3 ml-1">${lis}</ol>`)
      continue
    }

    // ── Paragraph ──
    out.push(`<p class="text-sm text-[#a0a0a0] leading-relaxed mb-3">${inline(trimmed)}</p>`)
    i++
  }

  return out.join('\n')
}

// ══════════════════════════════════════════════
//  Build supplementary HTML from structured data
//  (verification, enhanced sources — not in raw_report)
// ══════════════════════════════════════════════

function esc(str) {
  if (!str) return ''
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

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

function confidenceBar(confidence) {
  if (confidence == null) return ''
  const pct = Math.round(confidence * 100)
  const color = pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'
  return `<div class="flex items-center gap-2"><div class="w-16 h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden"><div class="h-full ${color} rounded-full" style="width:${pct}%"></div></div><span class="text-[10px] text-[#737373]">${pct}%</span></div>`
}

function buildVerificationHtml(verification) {
  if (!verification?.claims?.length) return ''
  const parts = []

  // Claims table
  const claimRows = verification.claims.map(c => `
    <tr>
      <td class="px-3 py-2.5 text-sm text-[#c0c0c0] leading-relaxed">${esc(c.statement || '')}</td>
      <td class="px-3 py-2.5 text-center">${statusBadge(c.status)}</td>
      <td class="px-3 py-2.5">${confidenceBar(c.confidence)}</td>
      <td class="px-3 py-2.5 text-sm text-[#a0a0a0] text-center">${c.supporting_count || 0}<span class="text-[#525252]">/</span><span class="text-red-400">${c.conflicting_count || 0}</span></td>
      <td class="px-3 py-2.5 text-xs text-[#737373]">${esc(c.evidence_type || '')}</td>
    </tr>`).join('')

  parts.push(`
    <h2 class="text-lg font-semibold text-white mt-6 mb-2.5">Epistemic Verification</h2>
    <div class="overflow-x-auto -mx-1 px-1 mb-4">
      <table class="w-full text-left border-collapse separate border-spacing-0 rounded-xl overflow-hidden border border-[#1a1a1a]">
        <thead>
          <tr>
            <th class="px-3 py-2 text-[11px] font-semibold text-[#737373] uppercase tracking-wider bg-[#111]">Claim</th>
            <th class="px-3 py-2 text-[11px] font-semibold text-[#737373] uppercase tracking-wider bg-[#111] text-center">Status</th>
            <th class="px-3 py-2 text-[11px] font-semibold text-[#737373] uppercase tracking-wider bg-[#111]">Confidence</th>
            <th class="px-3 py-2 text-[11px] font-semibold text-[#737373] uppercase tracking-wider bg-[#111] text-center">Support/Conflict</th>
            <th class="px-3 py-2 text-[11px] font-semibold text-[#737373] uppercase tracking-wider bg-[#111]">Evidence Type</th>
          </tr>
        </thead>
        <tbody>${claimRows}</tbody>
      </table>
    </div>`)

  // Summary pills
  const vs = verification.summary
  if (vs) {
    const total = (vs.established || 0) + (vs.tentative || 0) + (vs.contested || 0) + (vs.unverifiable || 0)
    if (total > 0) {
      parts.push(`
        <div class="flex items-center gap-3 flex-wrap mb-4">
          ${vs.established ? `<span class="text-[10px] px-2 py-1 rounded-full bg-green-500/15 text-green-400 font-medium">${vs.established} Established</span>` : ''}
          ${vs.tentative ? `<span class="text-[10px] px-2 py-1 rounded-full bg-yellow-500/15 text-yellow-400 font-medium">${vs.tentative} Tentative</span>` : ''}
          ${vs.contested ? `<span class="text-[10px] px-2 py-1 rounded-full bg-red-500/15 text-red-400 font-medium">${vs.contested} Contested</span>` : ''}
          ${vs.unverifiable ? `<span class="text-[10px] px-2 py-1 rounded-full bg-gray-500/15 text-gray-400 font-medium">${vs.unverifiable} Unverifiable</span>` : ''}
          <span class="text-[10px] text-[#404040]">${vs.total_sources_checked || 0} sources checked</span>
        </div>`)
    }
  }

  return parts.join('\n')
}

// ══════════════════════════════════════════════
//  Convert APEX response → Kivora format
// ══════════════════════════════════════════════

function formatApexResponse(apexData, query, mode) {
  // Build sources array
  const sources = (apexData.sources || []).map((s, i) => ({
    id: i,
    url: s.url || '',
    title: s.title || `Source ${i + 1}`,
    snippet: s.snippet || '',
    favicon: s.favicon || '',
    status: s.tier === 'P1' ? 'deep' : 'loaded',
  }))

  // ── Primary content: the full raw_report from APEX ──
  // This contains the complete LLM output with all sections,
  // paragraphs, tables, analysis, methodology notes, etc.
  const rawReport = apexData.raw_report || ''
  let content = ''

  if (rawReport) {
    // Convert the full raw markdown report to HTML
    content = mdToHtml(rawReport)
  } else {
    // Fallback: build from structured fields if no raw_report
    const fallbackParts = []
    if (apexData.executive_summary) {
      fallbackParts.push(`## Executive Summary\n${apexData.executive_summary}`)
    }
    if (apexData.findings?.length) {
      fallbackParts.push('## Key Findings')
      fallbackParts.push('| Finding | Evidence | Source | Tier | Status |')
      fallbackParts.push('|---------|----------|--------|------|--------|')
      for (const f of apexData.findings) {
        fallbackParts.push(`| ${f.finding || f.statement || ''} | ${f.evidence || ''} | ${f.source || ''} | ${f.tier || ''} | ${f.status || ''} |`)
      }
    }
    if (apexData.debates?.length) {
      const validDebates = apexData.debates.filter(d => {
        const t = d.point || d || ''
        return t && t !== 'None' && t.toLowerCase() !== 'none'
      })
      if (validDebates.length) {
        fallbackParts.push('## Active Debates')
        for (const d of validDebates) fallbackParts.push(`- ${d.point || d}`)
      }
    }
    if (apexData.speculative?.length) {
      const validSpec = apexData.speculative.filter(s => s && s !== 'None' && s.toLowerCase() !== 'none')
      if (validSpec.length) {
        fallbackParts.push('## Speculative Findings')
        for (const s of validSpec) fallbackParts.push(`- ${s}`)
      }
    }
    content = mdToHtml(fallbackParts.join('\n'))
  }

  // ── Append verification section (from deep_research, NOT in raw_report) ──
  if (apexData.verification?.claims?.length) {
    content += '\n' + buildVerificationHtml(apexData.verification)
  }

  // ── Build markdown for copy button ──
  const markdownForCopy = rawReport || buildMarkdownFallback(apexData, sources)

  // Title
  const title = apexData.executive_summary
    ? apexData.executive_summary.split(/[.!?]/)[0].trim().slice(0, 80)
    : query

  // Followups
  const followups = (apexData.sub_queries || [])
    .filter(q => q && q !== query)
    .map(q => q.endsWith('?') ? q : q + '?')
    .slice(0, 5)

  if (followups.length === 0 && apexData.findings?.length) {
    for (const f of apexData.findings.slice(0, 3)) {
      const text = f.finding || f.statement || ''
      if (text) followups.push(`What evidence supports: "${text.slice(0, 60)}"?`)
    }
  }

  return {
    sources,
    report: markdownForCopy,
    content,
    title,
    followups,
    data: apexData.verification || null,
    mode,
  }
}

// ── Markdown fallback (for copy button when no raw_report) ──
function buildMarkdownFallback(apexData, sources) {
  const lines = []
  if (apexData.executive_summary) {
    lines.push('## Executive Summary', apexData.executive_summary, '')
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
  if (sources.length > 0) {
    lines.push('## Sources')
    sources.forEach((s, i) => {
      lines.push(`${i + 1}. [${s.title}](${s.url})`)
    })
  }
  return lines.join('\n')
}

// ══════════════════════════════════════════════
//  POST handler
// ══════════════════════════════════════════════

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
    const result = formatApexResponse(apexData, query, mode)
    return Response.json(result)
  } catch (error) {
    console.error('[research] API error:', error)
    return Response.json({ error: error.message || 'Research failed' }, { status: 500 })
  }
}
