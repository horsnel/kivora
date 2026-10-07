export const runtime = 'edge' 
import { createClient } from '@supabase/supabase-js'
import { groq, MODEL, groqChat, GroqError, getPrimaryClientAsync, getFallbackClientAsync, setCerebrasApiKey, setSambanovaApiKey, setSiliconflowApiKey, setGeminiApiKey, setOpenrouterApiKey } from '@/lib/groq'
import { mistralChat, setMistralApiKeys, isMistralConfigured } from '@/lib/mistral'
import { getEnvVar } from '@/lib/cfEnv'
import { rateLimit, anonymousRateLimit, anonymousDailyLimit, getClientIP } from '@/lib/ratelimit'
import { requireCredits, refundCredits, CREDIT_COSTS } from '@/lib/credits'
import { resolveUserAndAdmin } from '@/lib/authUser'
import { normalizeExploreResult } from '@/lib/exploreSchema'

function slugify(text) {
  return text.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
    .slice(0, 80)
}

export async function POST(req) {
  const ip = getClientIP(req)
  if (!rateLimit(ip).ok) {
    return Response.json({ error: "You're sending requests too quickly. Slow down and try again shortly." }, { status: 429 })
  }

  try {
    // Wire the FULL multi-provider chain (same as /api/chat). Previously only
    // Groq/Gemini/OpenRouter were wired here — SiliconFlow and SambaNova (the
    // two most reliable direct providers) were never set, so when Groq hit its
    // daily cap and OpenRouter ran out of credits, generation had nowhere to
    // go and the Explore page silently produced nothing.
    const groqKey = await getEnvVar('GROQ_API_KEY')
    const groqFallbackKey = await getEnvVar('GROQ_API_KEY_FALLBACK')
    const cerebrasKey = await getEnvVar('CEREBRAS_API_KEY')
    const sambanovaKey = await getEnvVar('SAMBANOVA_API_KEY')
    const siliconflowKey = await getEnvVar('SILICONFLOW_API_KEY')
    const geminiKey = await getEnvVar('GEMINI_API_KEY')
    const openrouterKey = await getEnvVar('OPENROUTER_API_KEY')
    const mistralKey = await getEnvVar('MISTRAL_API_KEY')
    const mistralFallbackKey = await getEnvVar('MISTRAL_API_KEY_FALLBACK')
    setMistralApiKeys(mistralKey, mistralFallbackKey)
    setCerebrasApiKey(cerebrasKey)
    setSambanovaApiKey(sambanovaKey)
    setSiliconflowApiKey(siliconflowKey)
    setGeminiApiKey(geminiKey)
    setOpenrouterApiKey(openrouterKey)
    const groqClient = await getPrimaryClientAsync(groqKey)
    if (groqFallbackKey) await getFallbackClientAsync(groqFallbackKey)
    const supaUrl = await getEnvVar('NEXT_PUBLIC_SUPABASE_URL')
    const supaKey = await getEnvVar('SUPABASE_SERVICE_ROLE_KEY')
    const admin = supaUrl && supaKey ? createClient(supaUrl, supaKey) : null
    if (!groqClient || !admin) {
      return Response.json({ error: 'Service not configured' }, { status: 503 })
    }
    const { query, category } = await req.json()
    if (!query?.trim()) {
      return Response.json({ error: 'query is required' }, { status: 400 })
    }

    const slug = slugify(query)

    // Check cache first
    const { data: cached } = await admin
      .from('explore_cache')
      .select('*')
      .eq('slug', slug)
      .single()

    if (cached) {
      await admin
        .from('explore_cache')
        .update({ views: (cached.views || 0) + 1 })
        .eq('slug', slug)
      // Cache hit — free (no credit charge)
      return Response.json({ slug, result: cached.result, cached: true })
    }

    // ── Cache miss — charge 2 credits ──
    const { user: exploreUser, admin: chargerAdmin } = await resolveUserAndAdmin(req)
    if (chargerAdmin && exploreUser?.id) {
      const creditCheck = await requireCredits(req, chargerAdmin, exploreUser, 'explore', {
        description: `Explore: ${query.slice(0, 80)}`,
        metadata: { slug, category },
      })
      if (!creditCheck.ok) return creditCheck.response
    }

    // Anonymous user — apply daily limit (15 explore/day) + per-minute burst protection
    if (!exploreUser) {
      // Per-minute burst protection
      if (!anonymousRateLimit(ip, 3).ok) {
        return Response.json({
          error: "You're exploring too quickly. Slow down or sign in for unlimited access.",
          quotaExceeded: true,
          upgrade_url: '/auth',
        }, { status: 429 })
      }
      // Daily limit — 15 explore queries per day for anonymous visitors
      const dailyCheck = await anonymousDailyLimit(admin, ip, 'explore', 15)
      if (!dailyCheck.ok) {
        return Response.json({
          error: "You've used all 15 free explorations for today. Sign in for unlimited access.",
          quotaExceeded: true,
          anonLimitReached: true,
          limit: dailyCheck.limit,
          used: dailyCheck.used,
          upgrade_url: '/auth',
        }, { status: 429 })
      }
    }

    // Query wiki for existing context
    let wikiContext = ''
    try {
      const { data: wikiPages } = await admin
        .from('wiki_pages')
        .select('title, content')
        .or(`title.ilike.%${query.slice(0, 40)}%,content.ilike.%${query.slice(0, 40)}%`)
        .not('slug', 'like', 'article-%')
        .limit(3)
      if (wikiPages?.length) {
        wikiContext = wikiPages.map(p => `${p.title}: ${p.content.slice(0, 300)}`).join('\n\n')
      }
    } catch (_) {}

    // Generate: Mistral first (fast, proven in chat), then the full
    // multi-provider chain via groqChat.
    const genParams = {
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
    }

    let chat = null
    if (isMistralConfigured()) {
      try {
        chat = await mistralChat({
          model: 'mistral-small-latest',
          messages: genParams.messages,
          temperature: 0.3,
          maxTokens: 4096,
        })
      } catch (mErr) {
        console.warn(`[explore] mistral unavailable (${String(mErr?.message).slice(0, 80)}) — falling back to multi-provider chain`)
      }
    }
    if (!chat) {
      chat = await groqChat(genParams)
    }

    // ── Parse the model output as JSON, robustly ──────────────────────
    // Models often wrap the JSON in prose ("Here is your guide...") or
    // markdown fences even when told not to. Brace extraction handles that.
    // If it still fails, ONE repair round-trip asks the model to fix it —
    // cheaper for the user than a failed generation.
    const extractJson = (text) => {
      const cleaned = text.trim()
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '')
        .trim()
      try { return JSON.parse(cleaned) } catch { /* fall through */ }
      const first = cleaned.indexOf('{')
      const last = cleaned.lastIndexOf('}')
      if (first !== -1 && last > first) {
        try { return JSON.parse(cleaned.slice(first, last + 1)) } catch { /* fall through */ }
      }
      return null
    }

    let rawContent = chat?.choices?.[0]?.message?.content || ''
    let result = extractJson(rawContent)

    if (!result) {
      // Repair round-trip: show the model its own broken output
      console.log('[explore] JSON parse failed — attempting one repair round-trip')
      try {
        const repairParams = {
          ...genParams,
          messages: [
            { role: 'system', content: 'You output ONLY valid JSON objects. No prose, no markdown fences, no explanation.' },
            { role: 'user', content: `The following text was supposed to be a JSON object matching the schema I originally requested, but it is malformed. Return the corrected, complete, valid JSON object — nothing else.\n\n${rawContent.slice(0, 12000)}` },
          ],
        }
        let repaired = null
        if (isMistralConfigured()) {
          try {
            repaired = await mistralChat({
              model: 'mistral-small-latest',
              messages: repairParams.messages,
              temperature: 0,
              maxTokens: 4096,
            })
          } catch (_) { /* chain below */ }
        }
        if (!repaired) repaired = await groqChat(repairParams)
        result = extractJson(repaired?.choices?.[0]?.message?.content || '')
      } catch (repErr) {
        console.warn('[explore] repair round-trip failed:', repErr?.message)
      }
    }

    if (!result || typeof result !== 'object') {
      return Response.json({ error: 'The AI returned a malformed response. Please try again — it usually works on the second attempt.' }, { status: 502 })
    }

    // Normalize schema drift BEFORE caching — a drifted field (e.g.
    // failure_reasons: [{reason}]) previously crashed the guide renderer
    // with React #31 ("Something went wrong" boundary).
    const normalized = normalizeExploreResult(result)

    // Cache result
    await admin.from('explore_cache').upsert({
      slug,
      query,
      category: category || normalized.tags?.[0] || 'general',
      result: normalized,
      views: 1,
      created_at: new Date().toISOString()
    }, { onConflict: 'slug' })

    // Fire wiki ingest non-blocking
    const siteUrl = await getEnvVar('NEXT_PUBLIC_SITE_URL')
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

    return Response.json({ slug, result: normalized, cached: false })
  } catch (err) {
    console.error('[explore]', err)
    if (err instanceof GroqError && err.code === 'GROQ_QUOTA_EXCEEDED') {
      return Response.json({ error: 'Too many requests, try again later.', quotaExceeded: true }, { status: 429 })
    }
    return Response.json({ error: err.message || 'Server error' }, { status: 500 })
  }
}
