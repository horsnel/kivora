export const runtime = 'edge'

import { rateLimit } from '@/lib/ratelimit'
import { getEnvVar } from '@/lib/cfEnv'

// Tavily key loaded from Cloudflare secrets at request time
async function getTavilyKey() {
  return (await getEnvVar('TAVILY_API_KEY')) || ''
}

// Smart tier rotation — track request counts in memory to conserve free tiers
const tierState = {
  duckDuckGo: { count: 0, lastReset: Date.now() },
  jina: { count: 0, lastReset: Date.now() },
  tavily: { count: 0, lastReset: Date.now() },
}
const RESET_INTERVAL = 3600000 // 1 hour
const DUCKDUCKGO_LIMIT = 100
const JINA_LIMIT = 100
const TAVILY_LIMIT = 800 // Tavily dev key allows ~1000/month, be conservative

function canUse(tier, limit) {
  const state = tierState[tier]
  if (Date.now() - state.lastReset > RESET_INTERVAL) {
    state.count = 0
    state.lastReset = Date.now()
  }
  return state.count < limit
}

function increment(tier) {
  tierState[tier].count++
}

export async function POST(req) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!rateLimit(ip).ok) {
    return Response.json({ error: "You're sending requests too quickly. Slow down and try again shortly." }, { status: 429 })
  }

  try {
    const { query, mode = 'search', url } = await req.json()

    if (mode === 'read') {
      return await handleRead(url || query)
    }

    return await handleSearch(query)
  } catch (err) {
    console.error('[search]', err)
    return Response.json({ error: err.message || 'Search failed' }, { status: 500 })
  }
}

// ── Web Search: DuckDuckGo (primary) → Tavily (fallback) ──
async function handleSearch(query) {
  if (!query || typeof query !== 'string') {
    return Response.json({ error: 'query is required' }, { status: 400 })
  }

  let results = null
  let source = ''

  // Primary: DuckDuckGo Instant Answer API (free, no key)
  if (canUse('duckDuckGo', DUCKDUCKGO_LIMIT)) {
    try {
      const ddgRes = await fetch(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
        { headers: { 'Accept': 'application/json' } }
      )
      if (ddgRes.ok) {
        const ddgData = await ddgRes.json()
        increment('duckDuckGo')

        // Extract results from DuckDuckGo response
        const ddgResults = []

        // Abstract (direct answer)
        if (ddgData.Abstract) {
          ddgResults.push({
            title: ddgData.Heading || query,
            url: ddgData.AbstractURL || '',
            content: ddgData.Abstract,
            source: 'duckduckgo'
          })
        }

        // Related topics
        if (ddgData.RelatedTopics) {
          for (const topic of ddgData.RelatedTopics.slice(0, 5)) {
            if (topic.Text && topic.FirstURL) {
              ddgResults.push({
                title: topic.Text.slice(0, 80),
                url: topic.FirstURL,
                content: topic.Text,
                source: 'duckduckgo'
              })
            }
          }
        }

        // Infobox
        if (ddgData.Infobox?.content) {
          for (const item of ddgData.Infobox.content.slice(0, 3)) {
            if (item.value) {
              ddgResults.push({
                title: item.label || 'Info',
                url: item.wiki_order ? `https://en.wikipedia.org/wiki/${encodeURIComponent(query)}` : '',
                content: `${item.label || 'Info'}: ${item.value}`,
                source: 'duckduckgo'
              })
            }
          }
        }

        if (ddgResults.length > 0) {
          results = { answer: ddgData.Abstract || '', results: ddgResults }
          source = 'duckduckgo'
        }
      }
    } catch (ddgErr) {
      console.warn('[search] DuckDuckGo failed:', ddgErr.message)
    }
  }

  // If DuckDuckGo didn't return enough, use Tavily as fallback
  if (!results || results.results.length < 2) {
    if (canUse('tavily', TAVILY_LIMIT)) {
      try {
        const tavilyKey = await getTavilyKey()
        if (!tavilyKey) throw new Error('Tavily key not configured')
        const tavilyRes = await fetch('https://api.tavily.com/search', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tavilyKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            query,
            search_depth: 'basic',
            include_answer: true,
            max_results: 5
          })
        })

        if (tavilyRes.ok) {
          const tavilyData = await tavilyRes.json()
          increment('tavily')

          results = {
            answer: tavilyData.answer || '',
            results: (tavilyData.results || []).map(r => ({
              title: r.title,
              url: r.url,
              content: r.content,
              score: r.score,
              source: 'tavily'
            }))
          }
          source = 'tavily'
        }
      } catch (tavilyErr) {
        console.warn('[search] Tavily failed:', tavilyErr.message)
      }
    }
  }

  if (!results) {
    return Response.json({ error: 'All search providers failed. Please try again.' }, { status: 502 })
  }

  return Response.json({ ...results, source })
}

// ── URL Reading: Jina Reader API (free, no key) ──
async function handleRead(url) {
  if (!url || typeof url !== 'string') {
    return Response.json({ error: 'url is required for read mode' }, { status: 400 })
  }

  // Ensure URL has protocol
  let targetUrl = url
  if (!targetUrl.startsWith('http')) {
    targetUrl = 'https://' + targetUrl
  }

  try {
    // Jina Reader API: prepend r.jina.ai/ to any URL
    if (canUse('jina', JINA_LIMIT)) {
      const jinaRes = await fetch(`https://r.jina.ai/${targetUrl}`, {
        headers: {
          'Accept': 'text/markdown',
          'X-Return-Format': 'markdown'
        }
      })

      if (jinaRes.ok) {
        const content = await jinaRes.text()
        increment('jina')
        return Response.json({ content, url: targetUrl, source: 'jina' })
      }

      console.warn('[search] Jina failed:', jinaRes.status)
    }

    // Fallback: Try direct fetch with text extraction
    const directRes = await fetch(targetUrl, {
      headers: { 'Accept': 'text/html,text/plain' }
    })

    if (directRes.ok) {
      const html = await directRes.text()
      // Simple text extraction: strip HTML tags
      const text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 10000)

      return Response.json({ content: text, url: targetUrl, source: 'direct' })
    }

    return Response.json({ error: 'Failed to read URL' }, { status: 502 })
  } catch (err) {
    console.error('[search] Read failed:', err)
    return Response.json({ error: err.message || 'Failed to read URL' }, { status: 500 })
  }
}
