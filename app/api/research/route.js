export const runtime = 'edge'

import { rateLimit } from '@/lib/ratelimit'

const APEX_API_URL = process.env.APEX_API_URL || 'https://apex-research-agent-production.up.railway.app'

// Simple markdown-to-HTML converter (runs on edge)
function markdownToHtml(md) {
  if (!md) return ''
  let html = md
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    // Horizontal rules
    .replace(/^---+$/gm, '<hr/>')
    // Unordered list items
    .replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>')
    // Ordered list items
    .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
    // Wrap consecutive <li> in <ul>
    html = html.replace(/((?:<li>.*?<\/li>\s*)+)/g, '<ul>$1</ul>')
    // Tables: basic markdown table to HTML
    html = html.replace(/(<li>.*?\|.*?<\/li>)/g, '$1') // skip table rows caught as list items
    // Paragraphs — wrap lines that aren't already tags
    html = html.replace(/^(?!<[hluoa]|<hr|<li|<ul|<strong|<table|<tr|<td|<th|<thead|<tbody)(.+)$/gm, '<p>$1</p>')
    // Clean up empty paragraphs
    html = html.replace(/<p>\s*<\/p>/g, '')
  return html
}

// Convert APEX research response to Kivora frontend format
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

  // Build the markdown report from APEX's raw_report (preferred) or synthesize from structured data
  let report = apexData.raw_report || ''

  if (!report) {
    // Fallback: build report from APEX structured fields
    const lines = []

    if (apexData.executive_summary) {
      lines.push('## Executive Summary')
      lines.push(apexData.executive_summary)
      lines.push('')
    }

    if (apexData.findings?.length) {
      lines.push('## Key Findings')
      lines.push('| Finding | Evidence | Source | Tier | Status |')
      lines.push('|---------|----------|--------|------|--------|')
      for (const f of apexData.findings) {
        lines.push(`| ${f.finding || f.statement || ''} | ${f.evidence || ''} | ${f.source || ''} | ${f.tier || ''} | ${f.status || ''} |`)
      }
      lines.push('')
    }

    if (apexData.debates?.length && apexData.debates[0]?.point !== 'None') {
      lines.push('## Active Debates')
      for (const d of apexData.debates) {
        lines.push(`- ${d.point || d}`)
      }
      lines.push('')
    }

    if (apexData.speculative?.length && apexData.speculative[0] !== 'None') {
      lines.push('## Speculative Findings')
      for (const s of apexData.speculative) {
        lines.push(`- ${s}`)
      }
      lines.push('')
    }

    if (apexData.verification?.summary) {
      const v = apexData.verification.summary
      lines.push('## Verification Summary')
      lines.push(`- Established: ${v.established || 0}`)
      lines.push(`- Tentative: ${v.tentative || 0}`)
      lines.push(`- Contested: ${v.contested || 0}`)
      lines.push(`- Unverifiable: ${v.unverifiable || 0}`)
      lines.push('')
    }

    if (sources.length) {
      lines.push('## Sources')
      sources.forEach((s, i) => {
        lines.push(`${i + 1}. [${s.title}](${s.url})`)
      })
    }

    report = lines.join('\n')
  }

  // Generate followups from sub_queries or generate them
  const followups = (apexData.sub_queries || [])
    .filter(q => q !== query && q.endsWith('?'))
    .slice(0, 5)

  // If no followups from APEX, generate some from the findings
  if (followups.length === 0 && apexData.findings?.length) {
    const findings = apexData.findings.slice(0, 3)
    for (const f of findings) {
      const text = f.finding || f.statement || ''
      if (text) followups.push(`What evidence supports: "${text.slice(0, 60)}"?`)
    }
  }

  // Convert markdown to HTML
  const content = markdownToHtml(report)

  // Extract title from first heading
  const titleMatch = report.match(/^#\s+(.+)$/m) || report.match(/^##\s+(.+)$/m)
  const title = titleMatch ? titleMatch[1].replace(/[*_]/g, '') : query

  return {
    sources,
    report,
    content,
    title,
    followups,
    data: null,
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
