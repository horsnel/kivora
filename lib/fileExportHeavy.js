/**
 * fileExportHeavy.js — File exports that use Node.js-incompatible packages
 *
 * These functions use jspdf, docx, jszip, pptxgenjs which depend on
 * Node.js built-ins. They MUST only be imported via dynamic import()
 * at runtime — never at the top level of a client component.
 *
 * Webpack is configured to externalize these on the client bundle.
 */

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatDate(date) {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// ─── exportChatAsPDF ─────────────────────────────────────────────────────

export async function exportChatAsPDF(messages, modelName) {
  const { jsPDF } = await import('jspdf')

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const usableWidth = pageWidth - margin * 2
  const lineHeight = 6

  const BG = [10, 10, 10]
  const TEXT = [226, 226, 226]
  const ACCENT = [220, 38, 38]
  const KIVORA_LABEL = [96, 165, 250]

  let y = margin

  function fillPage() {
    doc.setFillColor(...BG)
    doc.rect(0, 0, pageWidth, pageHeight, 'F')
  }

  function ensureSpace(needed) {
    if (y + needed > pageHeight - margin) {
      doc.addPage()
      fillPage()
      y = margin
    }
  }

  fillPage()

  // Header
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...ACCENT)
  doc.text('Kivora AI Chat Export', margin, y)
  y += 9

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(...TEXT)
  const now = new Date()
  doc.text(`Date: ${formatDate(now)}  |  Model: ${modelName || 'Unknown'}`, margin, y)
  y += 6

  // Separator
  doc.setDrawColor(...ACCENT)
  doc.setLineWidth(0.6)
  doc.line(margin, y, pageWidth - margin, y)
  y += 8

  // Messages
  for (const msg of messages) {
    const isUser = msg.role === 'user'
    const label = isUser ? 'You:' : 'Kivora:'

    ensureSpace(lineHeight * 2)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...(isUser ? ACCENT : KIVORA_LABEL))
    doc.text(label, margin, y)
    y += lineHeight

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...TEXT)

    const wrappedLines = doc.splitTextToSize(msg.content || '', usableWidth)
    for (const line of wrappedLines) {
      ensureSpace(lineHeight)
      doc.text(line, margin, y)
      y += lineHeight
    }

    y += 4
  }

  return doc.output('blob')
}

// ─── exportOpportunityAsPDF ──────────────────────────────────────────────

// Schema-safe string coercion (AI output can drift from the expected shape)
function txt(v) {
  return typeof v === 'string' ? v : (v == null ? '' : String(v))
}

function money(v) {
  const n = Number(v)
  return (Number.isFinite(n) ? n : 0).toLocaleString('en-US')
}

export async function exportOpportunityAsPDF(opp) {
  const { jsPDF } = await import('jspdf')

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const usableWidth = pageWidth - margin * 2
  const lineHeight = 5.4

  const BG = [10, 10, 10]
  const TEXT = [226, 226, 226]
  const ACCENT = [220, 38, 38]
  const MUTED = [136, 136, 136]

  let y = margin

  function fillPage() {
    doc.setFillColor(...BG)
    doc.rect(0, 0, pageWidth, pageHeight, 'F')
  }

  function ensureSpace(needed) {
    if (y + needed > pageHeight - margin) {
      doc.addPage()
      fillPage()
      y = margin
    }
  }

  function heading(label) {
    ensureSpace(lineHeight * 3)
    y += 3
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...ACCENT)
    doc.text(label, margin, y)
    y += 7
  }

  function bodyText(text, size = 10, color = TEXT, indent = 0) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(size)
    doc.setTextColor(...color)
    const wrapped = doc.splitTextToSize(txt(text), usableWidth - indent)
    for (const line of wrapped) {
      ensureSpace(lineHeight)
      doc.text(line, margin + indent, y)
      y += lineHeight
    }
  }

  fillPage()

  const r = opp?.result || {}

  // Header
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...ACCENT)
  doc.text('Kivora Opportunity Export', margin, y)
  y += 9

  bodyText(`Query: ${txt(opp?.query) || '—'}   ·   ${formatDate(new Date())}`, 9, MUTED)
  y += 2

  doc.setDrawColor(...ACCENT)
  doc.setLineWidth(0.6)
  doc.line(margin, y, pageWidth - margin, y)
  y += 8

  // Title + tagline
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(...TEXT)
  const titleLines = doc.splitTextToSize(txt(r.title) || txt(opp?.query) || 'Opportunity', usableWidth)
  for (const line of titleLines) {
    ensureSpace(7)
    doc.text(line, margin, y)
    y += 7
  }
  if (txt(r.tagline)) {
    y += 1
    bodyText(r.tagline, 10, MUTED)
  }
  y += 3

  // Key stats
  ensureSpace(lineHeight * 2)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...ACCENT)
  doc.text(`$${money(r.income_min)}–$${money(r.income_max)}/${txt(r.income_period) || 'mo'}`, margin, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...MUTED)
  doc.text(`${money(r.start_days)} days to start · $${money(r.monthly_cost)}/mo cost`, margin + 62, y)
  y += 6
  if (Array.isArray(r.works_in) && r.works_in.length) {
    bodyText(`Works in: ${r.works_in.map(txt).filter(Boolean).join(', ')}`, 9, MUTED)
  }
  y += 2

  if (txt(r.overview)) {
    heading('Overview')
    bodyText(r.overview)
  }

  if (Array.isArray(r.cost_breakdown) && r.cost_breakdown.length) {
    heading('Cost breakdown')
    for (const c of r.cost_breakdown) {
      ensureSpace(lineHeight * 2)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(...TEXT)
      doc.text(`${txt(c?.tool)} — $${money(c?.cost)}`, margin, y)
      y += lineHeight
      if (txt(c?.note)) {
        bodyText(c.note, 9, MUTED)
        y += 1.5
      }
    }
  }

  if (Array.isArray(r.tool_stack) && r.tool_stack.length) {
    heading('Tool stack')
    for (const t of r.tool_stack) {
      bodyText(`• ${txt(t?.name)} (${txt(t?.cost) || '—'}) — ${txt(t?.use)}`, 10)
      y += 1
    }
  }

  if (Array.isArray(r.action_plan) && r.action_plan.length) {
    heading('Action plan')
    r.action_plan.forEach((s, i) => {
      const period = typeof s === 'string' ? `Step ${i + 1}` : (txt(s?.period) || `Step ${i + 1}`)
      const task = typeof s === 'string' ? s : txt(s?.task ?? s?.action ?? s?.description ?? s)
      ensureSpace(lineHeight * 2)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(...ACCENT)
      doc.text(`${period}:`, margin, y)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(...TEXT)
      const wrapped = doc.splitTextToSize(task || '', usableWidth - 32)
      doc.text(wrapped, margin + 32, y)
      y += Math.max(lineHeight, wrapped.length * lineHeight)
      y += 1
    })
  }

  if (Array.isArray(r.failure_reasons) && r.failure_reasons.length) {
    heading('Why most people fail')
    for (const f of r.failure_reasons) {
      bodyText(`• ${typeof f === 'string' ? f : txt(f?.reason)}`)
      y += 1
    }
  }

  // Footer
  ensureSpace(lineHeight * 3)
  y += 4
  doc.setDrawColor(60, 60, 60)
  doc.setLineWidth(0.3)
  doc.line(margin, y, pageWidth - margin, y)
  y += 5
  bodyText('Generated by Kivora (kivora.app)', 8, MUTED)

  return doc.output('blob')
}

// ─── exportChatAsDOCX ────────────────────────────────────────────────────

export async function exportChatAsDOCX(messages, modelName) {
  const docx = await import('docx')
  const { Document, Paragraph, TextRun, Packer, BorderStyle } = docx

  const now = new Date()
  const children = []

  // Title
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: 'Kivora AI Chat Export',
          bold: true,
          size: 36,
          color: 'dc2626',
          font: 'Arial',
        }),
      ],
      spacing: { after: 80 },
    })
  )

  // Date & model
  children.push(
    new Paragraph({
      children: [
        new TextRun({
          text: `Date: ${formatDate(now)}  |  Model: ${modelName || 'Unknown'}`,
          size: 20,
          color: '888888',
          font: 'Arial',
        }),
      ],
      spacing: { after: 120 },
    })
  )

  // Separator
  children.push(
    new Paragraph({
      children: [],
      border: {
        bottom: { style: BorderStyle.SINGLE, size: 6, color: 'dc2626' },
      },
      spacing: { after: 240 },
    })
  )

  // Messages
  for (const msg of messages) {
    const isUser = msg.role === 'user'
    const label = isUser ? 'You:' : 'Kivora:'

    const runs = [
      new TextRun({
        text: label + ' ',
        bold: true,
        color: isUser ? 'dc2626' : '3b82f6',
        size: 22,
        font: 'Arial',
      }),
    ]

    const lines = (msg.content || '').split('\n')
    lines.forEach((line, i) => {
      if (i > 0) {
        runs.push(new TextRun({ break: 1 }))
      }
      runs.push(
        new TextRun({
          text: line,
          size: 22,
          font: 'Arial',
        })
      )
    })

    children.push(
      new Paragraph({
        children: runs,
        spacing: { before: 200, after: 200 },
      })
    )
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
  })

  return await Packer.toBlob(doc)
}

// ─── exportCodeAsZIP ─────────────────────────────────────────────────────

export async function exportCodeAsZIP(files) {
  const JSZipModule = await import('jszip')
  const JSZip = JSZipModule.default || JSZipModule

  const zip = new JSZip()
  for (const file of files) {
    zip.file(file.name, file.content)
  }

  return await zip.generateAsync({ type: 'blob' })
}

// ─── exportAsPPTX ────────────────────────────────────────────────────────

export async function exportAsPPTX(slides) {
  // pptxgenjs's ES build unconditionally imports node:fs / node:https, which
  // webpack cannot bundle for the browser (UnhandledSchemeError). It is also
  // unused by any page today. Escape webpack's static analysis with a runtime
  // import indirection (same trick lib/e2b.js uses) so the other exporters
  // (jspdf/docx/jszip) can bundle cleanly for the client.
  const PptxGenJSModule = await Function('return import("pptxgenjs")')()
  const PptxGenJS = PptxGenJSModule.default || PptxGenJSModule

  const pptx = new PptxGenJS()

  const SLIDE_BG = '0a0a0a'
  const TITLE_COLOR = 'FFFFFF'
  const BODY_COLOR = 'E2E2E2'
  const ACCENT_COLOR = 'dc2626'

  for (const slideData of slides) {
    const slide = pptx.addSlide()
    slide.background = { color: SLIDE_BG }

    slide.addText(slideData.title || '', {
      x: 0.75,
      y: 0.5,
      w: '85%',
      h: 1.0,
      fontSize: 28,
      color: TITLE_COLOR,
      bold: true,
      fontFace: 'Arial',
    })

    slide.addShape('rect', {
      x: 0.75,
      y: 1.6,
      w: 1.5,
      h: 0.06,
      fill: { color: ACCENT_COLOR },
      line: { width: 0 },
    })

    slide.addText(slideData.body || '', {
      x: 0.75,
      y: 2.1,
      w: '85%',
      h: 4.8,
      fontSize: 16,
      color: BODY_COLOR,
      fontFace: 'Arial',
      valign: 'top',
      lineSpacingMultiple: 1.3,
    })
  }

  return await pptx.write({ outputType: 'blob' })
}

// ─── v5.6 generic report exports (PDF / DOCX) ────────────────────────────
//
// Shared by research / reelpen / study / devtools via components/ExportMenu.
// Renders markdown-lite structure ({# headers, bullets, quotes, hr}) into
// styled documents matching the chat-export visual language.

function stripInlineMd(s) {
  return String(s ?? '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
}

export async function exportReportAsPDF({ title, subtitle, body, sources, meta }) {
  const { jsPDF } = await import('jspdf')

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const usableWidth = pageWidth - margin * 2
  const lineHeight = 5.4

  const BG = [10, 10, 10]
  const TEXT = [226, 226, 226]
  const MUTED = [136, 136, 136]
  const ACCENT = [220, 38, 38]
  const LINK = [96, 165, 250]

  let y = margin

  function fillPage() {
    doc.setFillColor(...BG)
    doc.rect(0, 0, pageWidth, pageHeight, 'F')
  }

  function ensureSpace(needed) {
    if (y + needed > pageHeight - margin) {
      doc.addPage()
      fillPage()
      y = margin
    }
  }

  function writeLines(text, size, style, color, lh, indent = 0) {
    doc.setFont('helvetica', style)
    doc.setFontSize(size)
    doc.setTextColor(...color)
    const wrapped = doc.splitTextToSize(stripInlineMd(text), usableWidth - indent)
    for (const line of wrapped) {
      ensureSpace(lh)
      doc.text(line, margin + indent, y)
      y += lh
    }
  }

  fillPage()

  // Header
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...ACCENT)
  doc.text('KIVORA REPORT', margin, y)
  y += 7

  writeLines(title || 'Report', 18, 'bold', [255, 255, 255], 8)
  y += 1

  const metaBits = [subtitle, meta, `Exported ${formatDate(new Date())}`].filter(Boolean).join('  ·  ')
  if (metaBits) {
    writeLines(metaBits, 9, 'normal', MUTED, 5)
  }
  y += 3

  doc.setDrawColor(...ACCENT)
  doc.setLineWidth(0.6)
  doc.line(margin, y, pageWidth - margin, y)
  y += 8

  // Body — markdown-lite block parsing
  const rawLines = String(body ?? '').split('\n')
  for (const line of rawLines) {
    const h = line.match(/^(#{1,4})\s+(.*)$/)
    if (h) {
      y += 2
      const size = h[1].length === 1 ? 14 : h[1].length === 2 ? 12 : 11
      writeLines(h[2], size, 'bold', [255, 255, 255], size * 0.62)
      y += 1.5
    } else if (/^\s*([-*+])\s+/.test(line)) {
      ensureSpace(lineHeight)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(...ACCENT)
      doc.text('·', margin + 1.5, y)
      writeLines(line.replace(/^\s*[-*+]\s+/, ''), 10, 'normal', TEXT, lineHeight, 5.5)
    } else if (/^\s*>\s?/.test(line)) {
      writeLines(line.replace(/^\s*>\s?/, ''), 10, 'italic', MUTED, lineHeight, 4)
    } else if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) {
      ensureSpace(6)
      doc.setDrawColor(31, 31, 31)
      doc.setLineWidth(0.3)
      doc.line(margin, y, pageWidth - margin, y)
      y += 6
    } else if (line.trim() === '') {
      y += lineHeight * 0.7
    } else {
      writeLines(line, 10, 'normal', TEXT, lineHeight)
    }
  }

  // References
  if (Array.isArray(sources) && sources.length) {
    y += 4
    ensureSpace(12)
    doc.setDrawColor(31, 31, 31)
    doc.line(margin, y, pageWidth - margin, y)
    y += 7
    writeLines('References', 12, 'bold', [255, 255, 255], 6.5)
    y += 1
    sources.forEach((s, i) => {
      const url = String(s?.url ?? '')
      const label = String(s?.title ?? '').trim() || url || 'Source'
      ensureSpace(lineHeight * 2)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(...LINK)
      const wrapped = doc.splitTextToSize(`${i + 1}. ${label}`, usableWidth)
      for (const w of wrapped) {
        doc.text(w, margin, y)
        y += lineHeight
      }
      if (url && url !== label) {
        doc.setTextColor(...MUTED)
        doc.setFontSize(7.5)
        const wrappedUrl = doc.splitTextToSize(url, usableWidth - 4)
        for (const w of wrappedUrl) {
          ensureSpace(4)
          doc.text(w, margin + 4, y)
          y += 4
        }
      }
      y += 1
    })
  }

  // Footer on every page
  const total = doc.internal.getNumberOfPages()
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(82, 82, 82)
    doc.text(`Generated by Kivora — ${formatDate(new Date())}`, margin, pageHeight - 6)
    doc.text(`${p} / ${total}`, pageWidth - margin, pageHeight - 6, { align: 'right' })
  }

  return doc.output('blob')
}

export async function exportReportAsDOCX({ title, subtitle, body, sources, meta }) {
  const docx = await import('docx')
  const { Document, Paragraph, TextRun, Packer, BorderStyle, HeadingLevel } = docx

  const children = []

  children.push(
    new Paragraph({
      children: [new TextRun({ text: 'KIVORA REPORT', bold: true, size: 18, color: 'dc2626', font: 'Arial' })],
      spacing: { after: 120 },
    })
  )

  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: stripInlineMd(title) || 'Report', bold: true, size: 44, color: 'ffffff', font: 'Arial' })],
      spacing: { after: 80 },
    })
  )

  const metaBits = [subtitle, meta, `Exported ${formatDate(new Date())}`].filter(Boolean).join('  ·  ')
  if (metaBits) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: metaBits, size: 18, color: '888888', font: 'Arial' })],
        spacing: { after: 120 },
      })
    )
  }

  children.push(
    new Paragraph({
      children: [],
      border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'dc2626' } },
      spacing: { after: 240 },
    })
  )

  const HEADING_SIZES = { 1: 30, 2: 26, 3: 24, 4: 22 }

  const rawLines = String(body ?? '').split('\n')
  for (const line of rawLines) {
    const h = line.match(/^(#{1,4})\s+(.*)$/)
    if (h) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: stripInlineMd(h[2]), bold: true, size: HEADING_SIZES[h[1].length], color: 'ffffff', font: 'Arial' })],
          spacing: { before: 200, after: 100 },
        })
      )
    } else if (/^\s*([-*+])\s+/.test(line)) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: '· ', bold: true, color: 'dc2626', size: 22, font: 'Arial' }),
            new TextRun({ text: stripInlineMd(line.replace(/^\s*[-*+]\s+/, '')), size: 22, color: 'e2e2e2', font: 'Arial' }),
          ],
          spacing: { before: 60, after: 60 },
        })
      )
    } else if (/^\s*>\s?/.test(line)) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: stripInlineMd(line.replace(/^\s*>\s?/, '')), italics: true, size: 20, color: '888888', font: 'Arial' })],
          spacing: { before: 80, after: 80 },
        })
      )
    } else if (line.trim() === '') {
      children.push(new Paragraph({ children: [], spacing: { after: 80 } }))
    } else {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: stripInlineMd(line), size: 22, color: 'e2e2e2', font: 'Arial' })],
          spacing: { before: 60, after: 60 },
        })
      )
    }
  }

  if (Array.isArray(sources) && sources.length) {
    children.push(
      new Paragraph({
        children: [new TextRun({ text: 'References', bold: true, size: 26, color: 'ffffff', font: 'Arial' })],
        spacing: { before: 280, after: 100 },
      })
    )
    for (const s of sources) {
      const url = String(s?.url ?? '')
      const label = String(s?.title ?? '').trim() || url || 'Source'
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: label, size: 18, color: '60a5fa', font: 'Arial' }),
            ...(url && url !== label ? [new TextRun({ text: `  —  ${url}`, size: 14, color: '555555', font: 'Arial' })] : []),
          ],
          spacing: { before: 40, after: 40 },
        })
      )
    }
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
  })

  return await Packer.toBlob(doc)
}
