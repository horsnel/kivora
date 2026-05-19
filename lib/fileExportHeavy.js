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
  const PptxGenJSModule = await import('pptxgenjs')
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
