import { supabaseAdmin } from '@/lib/supabase'
import { groq, MODEL } from '@/lib/groq'
import { rateLimit } from '@/lib/ratelimit'

function slugify(text) {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .slice(0, 80)
}

export async function POST(req) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!rateLimit(ip).ok) {
    return Response.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 })
  }

  try {
    if (!supabaseAdmin || !groq) {
      return Response.json({ error: 'Service not configured' }, { status: 503 })
    }
    const { query, category } = await req.json()
    if (!query?.trim()) {
      return Response.json({ error: 'query is required' }, { status: 400 })
    }

    const slug = slugify(query)

    // Check cache first
    const { data: cached } = await supabaseAdmin
      .from('explore_cache')
      .select('*')
      .eq('slug', slug)
      .single()

    if (cached) {
      await supabaseAdmin
        .from('explore_cache')
        .update({ views: (cached.views || 0) + 1 })
        .eq('slug', slug)
      return Response.json({ slug, result: cached.result, cached: true })
    }

    // Query wiki for existing context
    let wikiContext = ''
    try {
      const { data: wikiPages } = await supabaseAdmin
        .from('wiki_pages')
        .select('title, content')
        .or(`title.ilike.%${query.slice(0, 40)}%,content.ilike.%${query.slice(0, 40)}%`)
        .not('slug', 'like', 'article-%')
        .limit(3)
      if (wikiPages?.length) {
        wikiContext = wikiPages.map(p => `${p.title}: ${p.content.slice(0, 300)}`).join('\n\n')
      }
    } catch (_) {}

    // Generate with Groq
    const chat = await groq.chat.completions.create({
      model: MODEL,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content: `You are the Kivora Intelligence Engine — a global opportunity guide for builders everywhere.
You produce structured, honest, practical guides for anyone wanting to build a business or income stream.
Your audience is global: developers, students, entrepreneurs in Africa, the diaspora, Europe, and North America.
Always give dollar-denominated costs (USD). Be honest about failure rates and real costs.
${wikiContext ? `\nExisting platform context:\n${wikiContext}` : ''}
Respond ONLY with valid JSON — no markdown fences, no explanation, just the JSON object.`
        },
        {
          role: 'user',
          content: `Query: "${query}"
Category: ${category || 'general'}

Return a JSON object with EXACTLY this shape:
{
  "title": "Compelling title for this opportunity",
  "tagline": "One punchy sentence hook",
  "income_min": 100,
  "income_max": 2000,
  "income_period": "month",
  "start_days": 3,
  "monthly_cost": 20,
  "overview": "3-4 paragraph honest overview of this opportunity, why it works, who it's for, and why now",
  "cost_breakdown": [
    { "tool": "Tool Name", "cost": 0, "note": "what it does" }
  ],
  "failure_reasons": [
    "Specific reason 1 most people fail",
    "Specific reason 2",
    "Specific reason 3"
  ],
  "tool_stack": [
    {
      "name": "Tool Name",
      "cost": "$0/mo",
      "works_without_vpn": true,
      "accepts_local_payment": true,
      "url": "https://example.com",
      "use": "What you use it for"
    }
  ],
  "action_plan": [
    { "period": "Day 1", "task": "Specific actionable task" },
    { "period": "Day 2", "task": "Specific actionable task" },
    { "period": "Week 2", "task": "Specific actionable task" },
    { "period": "Month 1", "task": "Specific actionable task" },
    { "period": "Month 3", "task": "Specific milestone or goal" }
  ],
  "works_in": ["Nigeria", "Kenya", "Ghana", "UK", "USA", "Canada", "Remote"],
  "tags": ["tag1", "tag2", "tag3"]
}`
        }
      ]
    })

    let result
    try {
      const raw = chat.choices[0].message.content.trim()
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim()
      result = JSON.parse(raw)
    } catch (e) {
      return Response.json({ error: 'Failed to parse AI response. Try again.' }, { status: 500 })
    }

    // Cache result
    await supabaseAdmin.from('explore_cache').upsert({
      slug,
      query,
      category: category || result.tags?.[0] || 'general',
      result,
      views: 1,
      created_at: new Date().toISOString()
    }, { onConflict: 'slug' })

    // Fire wiki ingest non-blocking
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || ''
    if (siteUrl) {
      fetch(`${siteUrl}/api/wiki/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: result.title,
          content: result.overview,
          category: category || 'general',
          date: new Date().toISOString().slice(0, 10)
        })
      }).catch(() => {})
    }

    return Response.json({ slug, result, cached: false })
  } catch (err) {
    console.error('[explore]', err)
    return Response.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
