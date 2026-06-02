export const runtime = 'edge'

import { webSearch, webReader, chatCompletions } from '@/lib/zai'
import { rateLimit } from '@/lib/ratelimit'

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
    // Paragraphs — wrap lines that aren't already tags
    html = html.replace(/^(?!<[hluoa]|<hr|<li|<ul|<strong)(.+)$/gm, '<p>$1</p>')
    // Clean up empty paragraphs
    html = html.replace(/<p>\s*<\/p>/g, '')
  return html
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

    // Step 1: Web search for sources
    const searchResult = await webSearch({ query, num: mode === 'deep' ? 10 : 5 })

    // Normalize search results into our source format
    const rawResults = Array.isArray(searchResult) ? searchResult : (searchResult?.results || [])
    const sources = rawResults.map((r, i) => ({
      id: i,
      url: r.url || r.link || '',
      title: r.title || r.name || `Source ${i + 1}`,
      snippet: r.snippet || r.content || r.description || '',
      favicon: r.favicon || r.icon || '',
      status: 'loaded',
    }))

    const deepSystemPrompt = `You are an expert research analyst. Based on the search results and source content provided, write a comprehensive, well-structured research report.

Format in markdown with these sections:
## Key Findings
- List 5-7 key findings with inline citations [1], [2] etc.
## Detailed Analysis
- In-depth analysis of the findings, cross-referencing sources
## Implications
- What these findings mean in practice
## Conclusion
- Summary with actionable takeaways
## Sources
- Numbered list of all sources with URLs

After the report, on a new line, suggest 3-5 follow-up research questions formatted as:
FOLLOWUPS:
1. Question one?
2. Question two?
3. Question three?

Be thorough, factual, and always cite your sources. Write at least 800 words for the deep report.`

    const quickSystemPrompt = `You are a research assistant. Based on the search results provided, write a concise research summary. Format in markdown with sections: ## Key Findings, ## Analysis, ## Conclusion. Use inline citations [1], [2] etc. referencing the source index. Be factual and cite sources.

After the report, on a new line, suggest 3-5 follow-up research questions formatted as:
FOLLOWUPS:
1. Question one?
2. Question two?
3. Question three?`

    if (mode === 'deep' && sources.length > 0) {
      // Deep mode: Read top sources for deeper content
      const topContents = []
      const readLimit = Math.min(4, sources.length)

      for (let i = 0; i < readLimit; i++) {
        try {
          const pageResult = await webReader({ url: sources[i].url })
          const html = pageResult?.data?.html || pageResult?.content || ''
          const text = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 4000)

          topContents.push({
            index: i,
            title: sources[i].title,
            content: text || sources[i].snippet,
          })
        } catch {
          topContents.push({
            index: i,
            title: sources[i].title,
            content: sources[i].snippet,
          })
        }
      }

      // Mark top sources as "deep read"
      topContents.forEach(c => {
        if (sources[c.index]) sources[c.index].status = 'deep'
      })

      // Generate comprehensive report
      const completion = await chatCompletions({
        messages: [
          { role: 'system', content: deepSystemPrompt },
          {
            role: 'user',
            content: `Research query: "${query}"\n\nSearch results:\n${sources.map((s, i) => `[${i + 1}] ${s.title}\nURL: ${s.url}\n${s.snippet}`).join('\n\n')}\n\nDetailed source content:\n${topContents.map(c => `[${c.index + 1}] ${c.title}\n${c.content}`).join('\n\n---\n\n')}`,
          },
        ],
      })

      const rawReport = completion?.choices?.[0]?.message?.content || ''

      // Extract followups
      const { report, followups } = extractFollowups(rawReport)

      // Convert markdown to HTML
      const content = markdownToHtml(report)

      // Generate a title from the first heading or the query
      const titleMatch = report.match(/^#\s+(.+)$/m) || report.match(/^##\s+(.+)$/m)
      const title = titleMatch ? titleMatch[1].replace(/[*_]/g, '') : query

      return Response.json({ sources, report, content, title, followups, data: null, mode: 'deep' })
    }

    // Quick mode: single AI call
    const completion = await chatCompletions({
      messages: [
        { role: 'system', content: quickSystemPrompt },
        {
          role: 'user',
          content: `Research query: "${query}"\n\nSearch results:\n${sources.map((s, i) => `[${i + 1}] ${s.title}\nURL: ${s.url}\n${s.snippet}`).join('\n\n')}`,
        },
      ],
    })

    const rawReport = completion?.choices?.[0]?.message?.content || ''

    // Extract followups
    const { report, followups } = extractFollowups(rawReport)

    // Convert markdown to HTML
    const content = markdownToHtml(report)

    // Generate a title from the first heading or the query
    const titleMatch = report.match(/^#\s+(.+)$/m) || report.match(/^##\s+(.+)$/m)
    const title = titleMatch ? titleMatch[1].replace(/[*_]/g, '') : query

    return Response.json({ sources, report, content, title, followups, data: null, mode: 'quick' })
  } catch (error) {
    console.error('[research] API error:', error)
    return Response.json({ error: error.message || 'Research failed' }, { status: 500 })
  }
}

// Extract follow-up questions from the AI response
function extractFollowups(text) {
  if (!text) return { report: '', followups: [] }

  const followupsMatch = text.match(/FOLLOWUPS:\s*\n([\s\S]*?)$/i)

  if (followupsMatch) {
    const followupText = followupsMatch[1]
    const followups = followupText
      .split('\n')
      .map(line => line.replace(/^\d+\.\s*/, '').trim())
      .filter(q => q.length > 0 && q.endsWith('?'))

    const report = text.replace(/FOLLOWUPS:\s*\n[\s\S]*$/i, '').trim()
    return { report, followups }
  }

  return { report: text, followups: [] }
}
