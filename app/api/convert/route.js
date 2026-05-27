export const runtime = 'edge'

import { rateLimit } from '@/lib/ratelimit'

const SUPPORTED_CONVERSIONS = {
  'markdown-html': true,
  'markdown-pdf': true,
  'html-pdf': true,
  'csv-json': true,
  'csv-xlsx': true,
  'json-csv': true,
  'json-yaml': true,
  'text-html': true,
  'text-pdf': true,
}

export async function POST(req) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!rateLimit(ip).ok) {
    return Response.json({ error: "You're sending requests too quickly. Slow down and try again shortly." }, { status: 429 })
  }

  try {
    const { content, from, to, filename } = await req.json()

    if (!content || !from || !to) {
      return Response.json({ error: 'content, from, and to are required' }, { status: 400 })
    }

    const conversionKey = `${from}-${to}`
    if (!SUPPORTED_CONVERSIONS[conversionKey]) {
      return Response.json({
        error: `Unsupported conversion: ${from} → ${to}`,
        supported: Object.keys(SUPPORTED_CONVERSIONS)
      }, { status: 400 })
    }

    let result
    let mimeType
    let outputFilename = filename || `converted.${to}`

    switch (conversionKey) {
      case 'markdown-html':
        result = markdownToHtml(content)
        mimeType = 'text/html'
        outputFilename = outputFilename.replace(/\.\w+$/, '.html')
        break

      case 'html-pdf':
      case 'markdown-pdf':
      case 'text-pdf':
        // For PDF, we return HTML with print styles that the browser can print as PDF
        const htmlContent = conversionKey === 'markdown-pdf'
          ? markdownToHtml(content)
          : conversionKey === 'text-pdf'
            ? textToHtml(content)
            : content
        result = htmlToPrintPdf(htmlContent)
        mimeType = 'text/html'
        outputFilename = outputFilename.replace(/\.\w+$/, '.html')
        break

      case 'csv-json':
        result = csvToJson(content)
        mimeType = 'application/json'
        outputFilename = outputFilename.replace(/\.\w+$/, '.json')
        break

      case 'csv-xlsx':
        // Return CSV with BOM for Excel compatibility
        result = '\uFEFF' + content
        mimeType = 'text/csv'
        outputFilename = outputFilename.replace(/\.\w+$/, '.csv')
        break

      case 'json-csv':
        result = jsonToCsv(content)
        mimeType = 'text/csv'
        outputFilename = outputFilename.replace(/\.\w+$/, '.csv')
        break

      case 'json-yaml':
        result = jsonToYaml(content)
        mimeType = 'text/yaml'
        outputFilename = outputFilename.replace(/\.\w+$/, '.yaml')
        break

      case 'text-html':
        result = textToHtml(content)
        mimeType = 'text/html'
        outputFilename = outputFilename.replace(/\.\w+$/, '.html')
        break

      default:
        return Response.json({ error: 'Conversion not implemented yet' }, { status: 501 })
    }

    return Response.json({
      content: result,
      mimeType,
      filename: outputFilename,
      from,
      to
    })
  } catch (err) {
    console.error('[convert]', err)
    return Response.json({ error: err.message || 'Conversion failed' }, { status: 500 })
  }
}

// ── Conversion Utilities ──

function markdownToHtml(md) {
  let html = md
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold and italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Code blocks
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    // Images
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
    // Horizontal rules
    .replace(/^---$/gm, '<hr />')
    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    // Unordered lists
    .replace(/^[*-] (.+)$/gm, '<li>$1</li>')
    // Paragraphs
    .replace(/\n\n/g, '</p><p>')
    // Line breaks
    .replace(/\n/g, '<br />')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Converted Document</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #333; }
    h1, h2, h3 { margin-top: 1.5em; }
    pre { background: #f5f5f5; padding: 1rem; border-radius: 8px; overflow-x: auto; }
    code { background: #f5f5f5; padding: 0.2em 0.4em; border-radius: 4px; font-size: 0.9em; }
    blockquote { border-left: 3px solid #ddd; margin-left: 0; padding-left: 1rem; color: #666; }
    a { color: #0066cc; }
    img { max-width: 100%; }
    li { margin: 0.3em 0; }
  </style>
</head>
<body>
  <p>${html}</p>
</body>
</html>`
}

function textToHtml(text) {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br />')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Converted Document</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #333; white-space: pre-wrap; }
  </style>
</head>
<body>${escaped}</body>
</html>`
}

function htmlToPrintPdf(html) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Print as PDF</title>
  <style>
    @media print {
      body { margin: 0; padding: 1cm; }
      @page { margin: 1cm; size: A4; }
    }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; color: #333; }
    pre { background: #f5f5f5; padding: 1rem; border-radius: 8px; overflow-x: auto; }
    code { background: #f5f5f5; padding: 0.2em 0.4em; border-radius: 4px; font-size: 0.9em; }
    h1, h2, h3 { margin-top: 1.5em; }
    a { color: #0066cc; }
    img { max-width: 100%; }
  </style>
</head>
<body>${html}</body>
</html>`
}

function csvToJson(csv) {
  const lines = csv.trim().split('\n')
  if (lines.length < 2) return JSON.stringify([])

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  const rows = lines.slice(1).map(line => {
    const values = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
    const obj = {}
    headers.forEach((h, i) => { obj[h] = values[i] || '' })
    return obj
  })

  return JSON.stringify(rows, null, 2)
}

function jsonToCsv(jsonStr) {
  let data
  try {
    data = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr
  } catch {
    throw new Error('Invalid JSON input')
  }

  if (!Array.isArray(data) || data.length === 0) {
    throw new Error('JSON must be a non-empty array of objects')
  }

  const headers = Object.keys(data[0])
  const csvLines = [
    headers.join(','),
    ...data.map(row => headers.map(h => {
      const val = String(row[h] ?? '')
      return val.includes(',') || val.includes('"') || val.includes('\n')
        ? `"${val.replace(/"/g, '""')}"`
        : val
    }).join(','))
  ]

  return csvLines.join('\n')
}

function jsonToYaml(jsonStr) {
  let data
  try {
    data = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr
  } catch {
    throw new Error('Invalid JSON input')
  }

  return convertToYaml(data, 0)
}

function convertToYaml(obj, indent) {
  const spaces = '  '.repeat(indent)

  if (obj === null || obj === undefined) return 'null'
  if (typeof obj === 'boolean') return obj.toString()
  if (typeof obj === 'number') return obj.toString()
  if (typeof obj === 'string') {
    if (obj.includes('\n') || obj.includes(':') || obj.includes('#') || obj.startsWith(' ')) {
      return `"${obj.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
    }
    return obj
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]'
    return obj.map(item => {
      const val = convertToYaml(item, indent + 1)
      if (typeof item === 'object' && item !== null) {
        return spaces + '- ' + val.trimStart()
      }
      return spaces + '- ' + val
    }).join('\n')
  }

  if (typeof obj === 'object') {
    const entries = Object.entries(obj)
    if (entries.length === 0) return '{}'
    return entries.map(([key, val]) => {
      const yamlVal = convertToYaml(val, indent + 1)
      if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
        return spaces + key + ':\n' + yamlVal
      }
      if (Array.isArray(val)) {
        return spaces + key + ':\n' + yamlVal
      }
      return spaces + key + ': ' + yamlVal
    }).join('\n')
  }

  return String(obj)
}
