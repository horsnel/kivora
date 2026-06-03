export const runtime = 'edge'

import { performSearch, readUrl } from '@/lib/toolRegistry'
import { openrouterChat } from '@/lib/openrouter'
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

    // Step 1: Web search for sources (DuckDuckGo + Tavily — same as chat page)
    const searchResult = await performSearch(query)

    if (!searchResult) {
      return Response.json({ error: 'Search failed. Please try again.' }, { status: 500 })
    }

    // Normalize search results into our source format
    const sources = (searchResult.results || []).map((r, i) => ({
      id: i,
      url: r.url || '',
      title: r.title || `Source ${i + 1}`,
      snippet: r.content || r.snippet || r.description || '',
      favicon: r.favicon || '',
      status: 'loaded',
    }))

    const deepSystemPrompt = `You are an elite research analyst grounded in evidence, not opinion. Your job is to synthesize the provided sources into a rigorous, structured report that a decision-maker can trust and act on.

CORE PRINCIPLES:
- Evidence over inference. Every claim must be tied to a source via [1], [2] inline citations.
- Acknowledge uncertainty. Use calibrated language: "Established" (multiple independent sources agree), "Likely" (strong evidence but not conclusive), "Possible" (some evidence exists), "Uncertain" (conflicting or weak evidence), "Unlikely" (evidence points against).
- Check for bias. Flag if sources may have conflicts of interest, ideological leanings, or are funded by interested parties.
- Falsify yourself. After your main conclusions, generate 2-3 alternative explanations that could also fit the evidence.

SOURCE EVALUATION:
Rate each source you rely on heavily:
- Tier 1: Primary/official sources (government data, peer-reviewed research, official reports)
- Tier 2: Established outlets (reputable news, industry analysts, well-known experts)
- Tier 3: Supporting sources (blogs, forums, social media, unverified claims)
Flag any source that requires special skepticism.

OUTPUT FORMAT (markdown):
## Executive Summary
2-3 sentence overview of the most important takeaway.

## Key Findings
List 5-7 findings. Each finding must include:
- A clear statement
- Evidence strength: [Strong / Moderate / Weak / Insufficient]
- Inline citations [1], [2]

## Critical Analysis
- Deep analysis cross-referencing sources
- Identify contradictions between sources
- Highlight gaps in the available evidence
- Note any methodological concerns in the sources

## Alternative Explanations
2-3 plausible alternative interpretations of the evidence that differ from your primary conclusions.

## Implications
What these findings mean in practice. What should the reader do or watch for?

## Confidence Assessment
Overall confidence in the report's conclusions: [High / Moderate / Low] with a brief justification.

## Sources
Numbered list of all sources with URLs.

After the Sources section, suggest 3-5 follow-up research questions formatted as:
FOLLOWUPS:
1. Question one?
2. Question two?
3. Question three?

Write at least 800 words. Be thorough, precise, and intellectually honest.`

    const quickSystemPrompt = `You are a precise research assistant. Synthesize the provided sources into a concise, evidence-backed summary.

RULES:
- Every factual claim must cite a source: [1], [2], etc.
- Use calibrated confidence: "Established" (strong consensus), "Likely" (good evidence), "Possible" (some evidence), "Uncertain" (weak/conflicting).
- Flag any source with obvious bias or conflict of interest.

OUTPUT FORMAT (markdown):
## Key Findings
3-5 findings with evidence ratings [Strong / Moderate / Weak] and citations.

## Analysis
Cross-reference sources, note contradictions or gaps.

## Conclusion
Brief takeaway with overall confidence [High / Moderate / Low].

## Sources
Numbered list with URLs.

After the Sources section, suggest 3-5 follow-up research questions formatted as:
FOLLOWUPS:
1. Question one?
2. Question two?
3. Question three?

Be factual, concise, and cite everything.`

    const userContent = `Research query: "${query}"\n\nSearch results:\n${sources.map((s, i) => `[${i + 1}] ${s.title}\nURL: ${s.url}\n${s.snippet}`).join('\n\n')}`

    if (mode === 'deep') {
      // Deep mode: Read top sources for deeper content (Jina Reader — same as chat page)
      const topContents = []
      const readLimit = Math.min(4, sources.length)

      for (let i = 0; i < readLimit; i++) {
        try {
          if (!sources[i].url) continue
          const pageResult = await readUrl(sources[i].url)
          const text = pageResult?.content || sources[i].snippet

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

      const deepUserContent = `${userContent}\n\nDetailed source content:\n${topContents.map(c => `[${c.index + 1}] ${c.title}\n${c.content}`).join('\n\n---\n\n')}`

      // Generate comprehensive report via OpenRouter (deep model)
      const completion = await openrouterChat({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: deepSystemPrompt },
          { role: 'user', content: deepUserContent },
        ],
        temperature: 0.3,
        max_tokens: 8192,
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

    // Quick mode: fast OpenRouter call with Gemini 2.5 Flash Lite
    const completion = await openrouterChat({
      model: 'google/gemini-2.5-flash-lite',
      messages: [
        { role: 'system', content: quickSystemPrompt },
        { role: 'user', content: userContent },
      ],
      temperature: 0.3,
      max_tokens: 4096,
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
