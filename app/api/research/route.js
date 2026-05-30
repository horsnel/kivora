export const runtime = 'edge'

import { webSearch, webReader, chatCompletions } from '@/lib/zai'
import { rateLimit } from '@/lib/ratelimit'

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
          {
            role: 'system',
            content: `You are an expert research analyst. Based on the search results and source content provided, write a comprehensive, well-structured research report.

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

Be thorough, factual, and always cite your sources. Write at least 800 words for the deep report.`,
          },
          {
            role: 'user',
            content: `Research query: "${query}"\n\nSearch results:\n${sources.map((s, i) => `[${i + 1}] ${s.title}\nURL: ${s.url}\n${s.snippet}`).join('\n\n')}\n\nDetailed source content:\n${topContents.map(c => `[${c.index + 1}] ${c.title}\n${c.content}`).join('\n\n---\n\n')}`,
          },
        ],
      })

      const report = completion?.choices?.[0]?.message?.content || ''

      return Response.json({ sources, report, data: null, mode: 'deep' })
    }

    // Quick mode: single AI call
    const completion = await chatCompletions({
      messages: [
        {
          role: 'system',
          content: `You are a research assistant. Based on the search results provided, write a concise research summary. Format in markdown with sections: ## Key Findings, ## Analysis, ## Conclusion. Use inline citations [1], [2] etc. referencing the source index. Be factual and cite sources.`,
        },
        {
          role: 'user',
          content: `Research query: "${query}"\n\nSearch results:\n${sources.map((s, i) => `[${i + 1}] ${s.title}\nURL: ${s.url}\n${s.snippet}`).join('\n\n')}`,
        },
      ],
    })

    const report = completion?.choices?.[0]?.message?.content || ''

    return Response.json({ sources, report, data: null, mode: 'quick' })
  } catch (error) {
    console.error('[research] API error:', error)
    return Response.json({ error: error.message || 'Research failed' }, { status: 500 })
  }
}
