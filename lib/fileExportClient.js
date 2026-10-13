/**
 * fileExportClient.js — Browser-safe file export functions
 *
 * These functions use no Node.js-only dependencies and are safe
 * for client-side bundling. For PDF/DOCX/ZIP/PPTX exports,
 * see fileExportHeavy.js (dynamically imported at runtime).
 */

// ─── Helpers ────────────────────────────────────────────────────────────────

function escapeCSVField(value) {
  const str = String(value ?? '')
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

function escapeHTML(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatDateShort(date) {
  return date.toISOString().split('T')[0]
}

// ─── exportChatAsHTML ────────────────────────────────────────────────────

export function exportChatAsHTML(messages, modelName) {
  const now = new Date()

  const messageHTML = messages
    .map((msg) => {
      const isUser = msg.role === 'user'
      const roleClass = isUser ? 'user' : 'assistant'
      const labelText = isUser ? 'You' : 'Kivora'
      const escapedContent = escapeHTML(msg.content || '')

      return `<div class="message ${roleClass}">
        <div class="role-label">${labelText}</div>
        <div class="bubble">${escapedContent}</div>
      </div>`
    })
    .join('\n')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Kivora AI Chat Export</title>
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0a0a0a;
      color: #e2e2e2;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      padding: 24px;
      max-width: 800px;
      margin: 0 auto;
      line-height: 1.6;
    }
    .header {
      text-align: center;
      margin-bottom: 32px;
      padding-bottom: 24px;
      border-bottom: 1px solid #dc2626;
    }
    .header h1 {
      color: #ffffff;
      font-size: 24px;
      font-weight: 700;
      margin-bottom: 8px;
      letter-spacing: -0.02em;
    }
    .header .meta {
      color: #888888;
      font-size: 13px;
    }
    .messages { display: flex; flex-direction: column; gap: 16px; }
    .message { display: flex; flex-direction: column; }
    .message.user { align-items: flex-end; }
    .message.assistant { align-items: flex-start; }
    .role-label {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 4px;
      padding: 0 4px;
    }
    .message.user .role-label { color: #dc2626; }
    .message.assistant .role-label { color: #60a5fa; }
    .bubble {
      display: inline-block;
      max-width: 75%;
      padding: 12px 16px;
      border-radius: 16px;
      font-size: 14px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-wrap: break-word;
    }
    .message.user .bubble {
      background: #1a1a2e;
      border: 1px solid #dc2626;
      border-bottom-right-radius: 4px;
    }
    .message.assistant .bubble {
      background: #1a1a1a;
      border: 1px solid #262626;
      border-bottom-left-radius: 4px;
    }
    .footer {
      text-align: center;
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #1a1a1a;
      font-size: 11px;
      color: #525252;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Kivora AI Chat Export</h1>
    <div class="meta">Date: ${escapeHTML(formatDate(now))} &nbsp;|&nbsp; Model: ${escapeHTML(modelName || 'Unknown')}</div>
  </div>
  <div class="messages">
${messageHTML}
  </div>
  <div class="footer">Exported from Kivora &mdash; ${escapeHTML(formatDateShort(now))}</div>
</body>
</html>`

  return new Blob([html], { type: 'text/html;charset=utf-8' })
}

// ─── exportOpportunitiesAsCSV ────────────────────────────────────────────

export function exportOpportunitiesAsCSV(opportunities) {
  const HEADERS = [
    'title',
    'type',
    'income_min',
    'income_max',
    'income_period',
    'start_days',
    'monthly_cost',
  ]

  const rows = [HEADERS.join(',')]

  for (const opp of opportunities) {
    const row = HEADERS.map((h) => escapeCSVField(opp[h])).join(',')
    rows.push(row)
  }

  const csvString = rows.join('\n')
  return new Blob([csvString], { type: 'text/csv;charset=utf-8' })
}

// ─── exportOpportunityAsMarkdown ──────────────────────────────────────────

// Local schema-safe helpers (keep this module dependency-free)
function mdTxt(v) {
  return typeof v === 'string' ? v : (v == null ? '' : String(v))
}

function mdNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function exportOpportunityAsMarkdown(opp) {
  const r = opp?.result || {}
  const lines = []

  lines.push(`# ${mdTxt(r.title) || mdTxt(opp?.query) || 'Opportunity'}`)
  lines.push('')
  if (mdTxt(r.tagline)) {
    lines.push(`> ${mdTxt(r.tagline)}`)
    lines.push('')
  }

  lines.push(`- **Income:** $${mdNum(r.income_min).toLocaleString('en-US')}–$${mdNum(r.income_max).toLocaleString('en-US')}/${mdTxt(r.income_period) || 'mo'}`)
  lines.push(`- **Time to start:** ${mdNum(r.start_days)} days`)
  lines.push(`- **Monthly cost:** $${mdNum(r.monthly_cost).toLocaleString('en-US')}/mo`)
  if (Array.isArray(r.works_in) && r.works_in.length) {
    lines.push(`- **Works in:** ${r.works_in.map(mdTxt).filter(Boolean).join(', ')}`)
  }
  lines.push('')

  if (mdTxt(r.overview)) {
    lines.push(mdTxt(r.overview))
    lines.push('')
  }

  if (Array.isArray(r.cost_breakdown) && r.cost_breakdown.length) {
    lines.push('## Cost breakdown')
    lines.push('')
    lines.push('| Tool | Cost | What it does |')
    lines.push('|---|---|---|')
    for (const c of r.cost_breakdown) {
      lines.push(`| ${mdTxt(c?.tool)} | $${mdNum(c?.cost).toLocaleString('en-US')} | ${mdTxt(c?.note)} |`)
    }
    lines.push('')
  }

  if (Array.isArray(r.tool_stack) && r.tool_stack.length) {
    lines.push('## Tool stack')
    lines.push('')
    for (const t of r.tool_stack) {
      lines.push(`- **${mdTxt(t?.name)}** (${mdTxt(t?.cost) || '—'}) — ${mdTxt(t?.use)}`)
    }
    lines.push('')
  }

  if (Array.isArray(r.action_plan) && r.action_plan.length) {
    lines.push('## Action plan')
    lines.push('')
    r.action_plan.forEach((s, i) => {
      const period = typeof s === 'string' ? `Step ${i + 1}` : (mdTxt(s?.period) || `Step ${i + 1}`)
      const task = typeof s === 'string' ? s : mdTxt(s?.task ?? s?.action ?? s?.description ?? s)
      lines.push(`- [ ] **${period}:** ${task}`)
    })
    lines.push('')
  }

  if (Array.isArray(r.failure_reasons) && r.failure_reasons.length) {
    lines.push('## Why most people fail')
    lines.push('')
    for (const f of r.failure_reasons) {
      lines.push(`- ${typeof f === 'string' ? f : mdTxt(f?.reason)}`)
    }
    lines.push('')
  }

  if (Array.isArray(r.tags) && r.tags.length) {
    lines.push(r.tags.map(t => '#' + mdTxt(t).replace(/\s+/g, '')).filter(t => t.length > 1).join(' '))
    lines.push('')
  }

  lines.push('---')
  lines.push(`Generated by Kivora — ${formatDate(new Date())}`)

  return new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' })
}

// ─── downloadBlob ───────────────────────────────────────────────────────────

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  URL.revokeObjectURL(url)
}

// ─── v5.6 generic report exports ────────────────────────────────────────────
//
// Shared by research / reelpen / study / devtools via components/ExportMenu.
// A "report" is any generated markdown-ish output: { title, subtitle, body,
// sources? }. Sources (research) optionally render as a linked reference list
// and turn [N] markers in the body into clickable superscripts.

const REPORT_BRAND = 'Generated by Kivora'

function safeMeta(v) {
  const str = String(v ?? '').trim()
  return str
}

// kivora-<slug>-<yyyy-mm-dd>.<ext> — consistent with opportunities exports
export function buildReportFilename(title, ext) {
  const slug = String(title || 'report')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 48)
    .replace(/^-+|-+$/g, '') || 'report'
  const date = formatDateShort(new Date())
  return `kivora-${slug}-${date}.${ext}`
}

export function exportReportAsMarkdown({ title, subtitle, body, sources }) {
  const lines = []
  lines.push(`# ${safeMeta(title) || 'Report'}`)
  lines.push('')
  if (safeMeta(subtitle)) {
    lines.push(`> ${safeMeta(subtitle)}`)
    lines.push('')
  }
  lines.push(`_${REPORT_BRAND} — ${formatDate(new Date())}_`)
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push(String(body ?? ''))
  if (Array.isArray(sources) && sources.length) {
    lines.push('')
    lines.push('---')
    lines.push('')
    lines.push('## References')
    lines.push('')
    sources.forEach((s, i) => {
      const url = safeMeta(s?.url)
      const srcTitle = safeMeta(s?.title) || url || 'Source'
      lines.push(`${i + 1}. [${srcTitle}](${url})`)
    })
  }
  return new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' })
}

// Plain text — strip markdown markers so the file reads cleanly in any editor
export function exportReportAsText({ title, subtitle, body, sources }) {
  const out = []
  out.push(safeMeta(title) || 'Report')
  out.push('='.repeat(Math.min(60, Math.max(8, (safeMeta(title) || 'Report').length))))
  out.push('')
  if (safeMeta(subtitle)) {
    out.push(safeMeta(subtitle))
    out.push('')
  }
  out.push(`${REPORT_BRAND} — ${formatDate(new Date())}`)
  out.push('')
  const stripped = String(body ?? '')
    .split('\n')
    .map((line) => line
      .replace(/^#{1,6}\s+/, '')            // headers
      .replace(/^\s*[-*+]\s+\[ ?[xX]?\]\s+/, '- ') // task lists
      .replace(/^\s*[-*+]\s+/, '• ')        // bullets
      .replace(/\*\*([^*]+)\*\*/g, '$1')    // bold
      .replace(/\*([^*]+)\*/g, '$1')        // italic
      .replace(/`([^`]+)`/g, '$1')          // inline code
    )
    .join('\n')
  out.push(stripped)
  if (Array.isArray(sources) && sources.length) {
    out.push('')
    out.push('---')
    out.push('References:')
    sources.forEach((s, i) => {
      out.push(`  ${i + 1}. ${safeMeta(s?.title) || 'Source'} — ${safeMeta(s?.url)}`)
    })
  }
  return new Blob([out.join('\n')], { type: 'text/plain;charset=utf-8' })
}

// Convert [N] citation markers into clickable superscripts (sources-aware)
function linkifyCitations(text, sources) {
  if (!Array.isArray(sources) || !sources.length) return escapeHTML(text)
  return escapeHTML(text).replace(/\[(\d{1,2})\]/g, (m, n) => {
    const i = parseInt(n, 10) - 1
    const s = sources[i]
    if (!s || !safeMeta(s.url)) return m
    return `<a class="cite" href="${escapeHTML(s.url)}" target="_blank" rel="noopener noreferrer" title="${escapeHTML(safeMeta(s.title) || s.url)}">[${n}]</a>`
  })
}

export function exportReportAsHTML({ title, subtitle, body, sources, meta }) {
  const now = new Date()
  const hasSources = Array.isArray(sources) && sources.length > 0

  // Markdown-lite → HTML blocks (headers, bullets, quotes, hr, paragraphs)
  const rawLines = String(body ?? '').split('\n')
  const blocks = []
  let para = []
  const flushPara = () => {
    if (para.length) {
      blocks.push(`<p>${linkifyCitations(para.join('\n'), sources).replace(/\n/g, '<br>')}</p>`)
      para = []
    }
  }
  for (const line of rawLines) {
    const h = line.match(/^(#{1,4})\s+(.*)$/)
    if (h) {
      flushPara()
      const level = Math.min(h[1].length + 1, 5)
      blocks.push(`<h${level}>${linkifyCitations(h[2], sources)}</h${level}>`)
    } else if (/^\s*([-*+])\s+/.test(line)) {
      flushPara()
      blocks.push(`<li>${linkifyCitations(line.replace(/^\s*[-*+]\s+/, ''), sources)}</li>`)
    } else if (/^\s*>\s?/.test(line)) {
      flushPara()
      blocks.push(`<blockquote>${linkifyCitations(line.replace(/^\s*>\s?/, ''), sources)}</blockquote>`)
    } else if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) {
      flushPara()
      blocks.push('<hr>')
    } else {
      para.push(line)
    }
  }
  flushPara()

  const bodyHTML = blocks
    .map((b) => b.startsWith('<li>') ? `<ul class="wrap">${b}</ul>` : b)
    .join('\n')
    .replace(/<\/ul>\n<ul class="wrap">/g, '\n') // merge consecutive lists

  const refsHTML = hasSources
    ? `<div class="refs">
    <h2>References</h2>
    <ol>
      ${sources.map((s) => `<li><a href="${escapeHTML(safeMeta(s.url))}" target="_blank" rel="noopener noreferrer">${escapeHTML(safeMeta(s.title) || safeMeta(s.url))}</a>${safeMeta(s.url) ? `<span class="ref-url">${escapeHTML(safeMeta(s.url))}</span>` : ''}</li>`).join('\n      ')}
    </ol>
  </div>`
    : ''

  const metaRow = [
    safeMeta(subtitle),
    safeMeta(meta),
    `Exported ${escapeHTML(formatDate(now))}`,
  ].filter(Boolean).join(' &nbsp;·&nbsp; ')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHTML(safeMeta(title) || 'Kivora Report')}</title>
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0a0a0a;
      color: #e2e2e2;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.7;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px 24px 64px;
    }
    .header { border-bottom: 1px solid #dc2626; padding-bottom: 20px; margin-bottom: 28px; }
    .brand { font-size: 11px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #dc2626; margin-bottom: 10px; }
    h1 { color: #fff; font-size: 26px; font-weight: 700; letter-spacing: -0.02em; margin-bottom: 6px; }
    .meta { color: #888; font-size: 13px; }
    h2 { color: #fff; font-size: 19px; margin: 28px 0 10px; }
    h3, h4, h5 { color: #f0f0f0; font-size: 16px; margin: 22px 0 8px; }
    p { margin: 10px 0; font-size: 14.5px; }
    ul.wrap { list-style: none; }
    li { padding-left: 18px; position: relative; margin: 6px 0; font-size: 14.5px; }
    li::before { content: '·'; position: absolute; left: 4px; color: #dc2626; font-weight: 700; }
    blockquote { border-left: 3px solid #dc2626; padding: 6px 14px; margin: 14px 0; color: #aaa; font-size: 14px; }
    hr { border: none; border-top: 1px solid #1f1f1f; margin: 22px 0; }
    code { background: #1a1a1a; border: 1px solid #262626; border-radius: 4px; padding: 1px 5px; font-size: 13px; color: #f0f0f0; }
    a.cite { color: #60a5fa; text-decoration: none; font-size: 12px; vertical-align: super; }
    a.cite:hover { text-decoration: underline; }
    .refs { margin-top: 36px; border-top: 1px solid #1f1f1f; padding-top: 20px; }
    .refs ol { margin-left: 20px; }
    .refs li { margin: 8px 0; }
    .refs a { color: #60a5fa; text-decoration: none; font-size: 13.5px; }
    .refs a:hover { text-decoration: underline; }
    .ref-url { display: block; color: #555; font-size: 11.5px; }
    .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #1a1a1a; color: #525252; font-size: 11px; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div class="brand">Kivora Report</div>
    <h1>${escapeHTML(safeMeta(title) || 'Report')}</h1>
    ${metaRow ? `<div class="meta">${metaRow}</div>` : ''}
  </div>
  ${bodyHTML}
  ${refsHTML}
  <div class="footer">${REPORT_BRAND} &mdash; ${escapeHTML(formatDateShort(now))}</div>
</body>
</html>`

  return new Blob([html], { type: 'text/html;charset=utf-8' })
}
