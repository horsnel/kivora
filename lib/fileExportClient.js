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
