export const runtime = 'edge'

import { rateLimit } from '@/lib/ratelimit'

const TAVILY_API_KEY = process.env.TAVILY_API_KEY || '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'

export async function POST(req) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!rateLimit(ip).ok) {
    return Response.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 })
  }

  try {
    const { query, search_depth = 'basic', max_results = 5 } = await req.json()

    if (!query || typeof query !== 'string') {
      return Response.json({ error: 'query is required' }, { status: 400 })
    }

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TAVILY_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        query,
        search_depth,
        include_answer: true,
        max_results
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[search] Tavily error:', response.status, errorText)
      return Response.json(
        { error: 'Search service error', details: errorText },
        { status: response.status }
      )
    }

    const data = await response.json()
    return Response.json({
      answer: data.answer || '',
      results: (data.results || []).map(r => ({
        title: r.title,
        url: r.url,
        content: r.content,
        score: r.score
      }))
    })
  } catch (err) {
    console.error('[search]', err)
    return Response.json({ error: err.message || 'Search failed' }, { status: 500 })
  }
}
