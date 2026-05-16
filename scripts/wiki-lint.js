// scripts/wiki-lint.js
// Run via GitHub Actions every Sunday midnight UTC

import { createClient } from '@supabase/supabase-js'
import Groq from 'groq-sdk'

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
)
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

async function runLint() {
  console.log('[wiki-lint] Starting weekly lint pass...')

  const { data: pages } = await supabase
    .from('wiki_pages')
    .select('slug, title, content, updated_at')
    .not('slug', 'like', 'article-%')
    .order('updated_at', { ascending: false })

  if (!pages?.length) {
    console.log('[wiki-lint] No pages found. Exiting.')
    return
  }

  console.log(`[wiki-lint] Checking ${pages.length} wiki pages...`)

  const index = pages
    .map(p => `- [[${p.slug}]]: ${p.title} (${p.updated_at?.slice(0, 10)})`)
    .join('\n')

  const sample = pages.slice(0, 15)
  const sampleDump = sample
    .map(p => `### ${p.title} (${p.slug})\n${p.content.slice(0, 400)}`)
    .join('\n\n---\n\n')

  const chat = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    temperature: 0.3,
    messages: [
      {
        role: 'system',
        content: `You are auditing an editorial wiki for Kivora.
Respond ONLY with valid JSON — no markdown, no explanation.`
      },
      {
        role: 'user',
        content: `Full wiki index:\n${index}\n\nSample pages:\n${sampleDump}\n\nReturn JSON:
{
  "contradictions": [{ "pages": ["slug1", "slug2"], "issue": "description" }],
  "orphan_pages": ["slug"],
  "missing_pages": [{ "suggested_slug": "kebab-case", "reason": "why it should exist" }],
  "stale_pages": [{ "slug": "slug", "reason": "why outdated" }],
  "suggested_topics": ["topic to cover next"],
  "health_score": 0
}`
      }
    ]
  })

  let report
  try {
    const raw = chat.choices[0].message.content.trim()
      .replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim()
    report = JSON.parse(raw)
  } catch {
    console.log('[wiki-lint] Failed to parse report. Exiting.')
    return
  }

  console.log(`[wiki-lint] Health score: ${report.health_score}/100`)
  console.log(`[wiki-lint] Contradictions found: ${report.contradictions?.length || 0}`)
  console.log(`[wiki-lint] Orphan pages: ${report.orphan_pages?.length || 0}`)
  console.log(`[wiki-lint] Missing pages suggested: ${report.missing_pages?.length || 0}`)

  // Save report to log
  const { data: log } = await supabase.from('wiki_log').select('content').eq('id', 1).single()
  const entry = `## [${new Date().toISOString().slice(0, 10)}] lint | score: ${report.health_score}/100\n\`\`\`json\n${JSON.stringify(report, null, 2)}\n\`\`\`\n\n`
  await supabase.from('wiki_log').upsert({
    id: 1,
    content: entry + (log?.content || ''),
    updated_at: new Date().toISOString()
  }, { onConflict: 'id' })

  // Auto-create stubs for suggested missing pages
  for (const missing of report.missing_pages || []) {
    const { data: exists } = await supabase
      .from('wiki_pages').select('slug').eq('slug', missing.suggested_slug).single()
    if (!exists) {
      await supabase.from('wiki_pages').insert({
        slug: missing.suggested_slug,
        title: missing.suggested_slug.replace(/-/g, ' '),
        content: `# ${missing.suggested_slug.replace(/-/g, ' ')}\n\n_Stub page — created by weekly lint pass._\n\n**Reason:** ${missing.reason}\n\n## Overview\n\n## Key Facts\n\n## Coverage\n\n## Related\n`,
        updated_at: new Date().toISOString()
      })
      console.log(`[wiki-lint] Created stub: ${missing.suggested_slug}`)
    }
  }

  console.log('[wiki-lint] Done.')
}

runLint().catch(err => {
  console.error('[wiki-lint] Fatal error:', err)
  process.exit(1)
})
