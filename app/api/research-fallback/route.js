export const runtime = 'edge'

import { rateLimit } from '@/lib/ratelimit'

// ══════════════════════════════════════════════════════════════════
// FALLBACK RESEARCH API — Full pipeline: Search + LLM
// When the primary research worker fails entirely, this endpoint
// runs the same pipeline: search sources → format context → LLM.
// LLM chain: Mistral → Groq → Gemini → OpenRouter
// Search: Tavily + Firecrawl (same as worker quick mode)
// ══════════════════════════════════════════════════════════════════

// ── API Keys ──
function getTavilyKey() {
  return process.env.TAVILY_API_KEY || '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'
}
function getFirecrawlKey() {
  return process.env.FIRECRAWL_API_KEY || 'fc-9afd24762f1348c68c0c05e88130e890'
}
function getGeminiKey() {
  return process.env.GEMINI_API_KEY || ''
}
function getOpenRouterKey() {
  return process.env.OPENROUTER_API_KEY || ''
}
function getMistralKey() {
  return process.env.MISTRAL_API_KEY_FALLBACK || process.env.MISTRAL_API_KEY || ''
}
function getGroqKey() {
  return process.env.GROQ_API_KEY_FALLBACK || process.env.GROQ_API_KEY || ''
}

// ══════════════════════════════════════════════════════════════════
// SEARCH PROVIDERS (same as worker)
// ══════════════════════════════════════════════════════════════════

async function searchTavily(query, maxResults = 8, depth = 'basic') {
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getTavilyKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        search_depth: depth,
        include_answer: false,
        max_results: maxResults,
        include_raw_content: false,
      }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data.results || []).map(r => ({
      title: r.title || '',
      url: r.url || '',
      snippet: r.content || '',
      score: r.score || 0,
    }))
  } catch {
    return []
  }
}

async function searchFirecrawl(query, limit = 8) {
  const key = getFirecrawlKey()
  if (!key) return []
  try {
    const res = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, limit }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const data = await res.json()
    if (!data.success) return []
    return (data.data || []).map(r => ({
      title: r.title || r.metadata?.title || '',
      url: r.url || r.metadata?.sourceURL || '',
      snippet: r.snippet || r.description || r.metadata?.description || '',
      score: 0,
    }))
  } catch {
    return []
  }
}

// Quick search — 2 providers in parallel (same as worker)
async function searchQuick(query, maxSources = 10) {
  const [tavilyResults, firecrawlResults] = await Promise.all([
    searchTavily(query, 8, 'basic'),
    searchFirecrawl(query, 6),
  ])

  const seen = new Set()
  const all = []
  for (const r of [...tavilyResults, ...firecrawlResults]) {
    const key = r.url.toLowerCase().replace(/\/+$/, '')
    if (key && !seen.has(key)) {
      seen.add(key)
      all.push(r)
    }
  }
  return all.slice(0, maxSources)
}

// ══════════════════════════════════════════════════════════════════
// LLM PROVIDERS (fallback chain)
// ══════════════════════════════════════════════════════════════════

// OpenAI-compatible chat (works for Mistral, Groq, OpenRouter)
async function openaiCompatChat(url, apiKey, model, messages, maxTokens, timeout = 30000) {
  try {
    const t0 = Date.now()
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: maxTokens }),
      signal: AbortSignal.timeout(timeout),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error(`[fallback-llm] ${model} error ${res.status} in ${Date.now()-t0}ms:`, text.slice(0, 200))
      return null
    }
    const data = await res.json()
    const content = data.choices?.[0]?.message?.content || ''
    console.log(`[fallback-llm] ${model} success in ${Date.now()-t0}ms, chars: ${content.length}`)
    return content || null
  } catch (err) {
    console.error(`[fallback-llm] ${model} exception:`, err.message)
    return null
  }
}

// Google Gemini
async function geminiChat(messages, model = 'gemini-2.0-flash', maxTokens = 4096, timeout = 20000) {
  const apiKey = getGeminiKey()
  if (!apiKey) return null

  try {
    const t0 = Date.now()
    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }))

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: { temperature: 0.3, maxOutputTokens: maxTokens },
        }),
        signal: AbortSignal.timeout(timeout),
      }
    )

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      console.error(`[fallback-llm] Gemini ${model} error ${res.status} in ${Date.now()-t0}ms:`, text.slice(0, 200))
      return null
    }

    const data = await res.json()
    const result = data.candidates?.[0]?.content?.parts?.[0]?.text || null
    console.log(`[fallback-llm] Gemini ${model} success in ${Date.now()-t0}ms, chars: ${result?.length || 0}`)
    return result
  } catch (err) {
    console.error('[fallback-llm] Gemini exception:', err.message)
    return null
  }
}

// ── Output Quality Validation (same as worker) ──
function validateOutput(text, mode = 'quick') {
  if (!text || typeof text !== 'string') return false
  const minLen = mode === 'deep' ? 500 : 200
  if (text.length < minLen) {
    console.log(`[fallback-validate] FAIL: too short (${text.length} < ${minLen})`)
    return false
  }
  const wordCount = text.split(/\s+/).filter(w => w.length > 1).length
  if (wordCount < 50) {
    console.log(`[fallback-validate] FAIL: too few words (${wordCount})`)
    return false
  }
  const hasStructure = /^#{1,3}\s/m.test(text) || /\*\*.+\*\*/m.test(text)
  if (!hasStructure && mode === 'deep') {
    console.log('[fallback-validate] FAIL: no heading structure for deep mode')
    return false
  }
  console.log(`[fallback-validate] PASS: ${text.length} chars, ${wordCount} words`)
  return true
}

// ── LLM Fallback Chain: parallel race for first valid output ──
// Previously sequential (Mistral 60s → Groq 45s → Gemini → OpenRouter), which could
// take up to ~195s and exceed the frontend 60s fallback timeout before any provider
// after Mistral got a chance. Now we race all providers in parallel with
// Promise.any — first one to produce validated output wins. Total time = slowest
// single-provider timeout (≈25s for quick mode), not the sum.
async function generateWithFallback(messages, apexModel, mode = 'quick') {
  const isDeep = mode === 'deep'
  const maxTokens = apexModel === 'apex-premium' ? 8192 : 4096
  const errors = []

  // Tighter per-provider timeouts for quick mode (deep mode keeps generous timeouts)
  const t = isDeep
    ? { mistral: 60000, groq: 45000, gemini: 25000, openrouter: 35000 }
    : { mistral: 25000, groq: 15000, gemini: 15000, openrouter: 20000 }

  // Build the list of provider call descriptors
  const calls = []

  // 1. Mistral
  const mistralKey = getMistralKey()
  if (mistralKey) {
    const mistralModels = apexModel === 'apex-premium'
      ? ['mistral-large-latest', 'mistral-small-latest']
      : ['mistral-small-latest', 'ministral-8b-latest']
    for (const model of mistralModels) {
      calls.push({
        label: `Mistral/${model}`,
        run: () => openaiCompatChat(
          'https://api.mistral.ai/v1/chat/completions', mistralKey, model, messages, maxTokens, t.mistral
        ),
      })
    }
  } else {
    errors.push('Mistral: no key')
  }

  // 2. Groq
  const groqKey = getGroqKey()
  if (groqKey) {
    const groqModels = apexModel === 'apex-premium'
      ? ['llama-3.3-70b-versatile']
      : ['llama-3.1-8b-instant']
    for (const model of groqModels) {
      calls.push({
        label: `Groq/${model}`,
        run: () => openaiCompatChat(
          'https://api.groq.com/openai/v1/chat/completions', groqKey, model, messages, maxTokens, t.groq
        ),
      })
    }
  } else {
    errors.push('Groq: no key')
  }

  // 3. Gemini
  if (getGeminiKey()) {
    for (const model of ['gemini-2.0-flash', 'gemini-1.5-flash']) {
      calls.push({
        label: `Gemini/${model}`,
        run: () => geminiChat(messages, model, maxTokens, t.gemini),
      })
    }
  } else {
    errors.push('Gemini: no key')
  }

  // 4. OpenRouter
  if (getOpenRouterKey()) {
    for (const model of ['mistralai/mistral-small-3.1-24b-instruct', 'meta-llama/llama-4-maverick']) {
      calls.push({
        label: `OpenRouter/${model}`,
        run: () => openaiCompatChat(
          'https://openrouter.ai/api/v1/chat/completions', getOpenRouterKey(), model, messages, maxTokens, t.openrouter
        ),
      })
    }
  } else {
    errors.push('OpenRouter: no key')
  }

  if (calls.length === 0) {
    throw new Error('No fallback LLM providers configured. Tried: ' + errors.join(', '))
  }

  // Race them all in parallel — first valid output wins.
  // Each call's promise rejects if its output fails validation, so Promise.any
  // only resolves when at least one provider returned a usable report.
  const racingPromises = calls.map(({ label, run }) =>
    run().then(result => {
      if (!result || !validateOutput(result, mode)) {
        throw new Error(`${label}:${result ? 'bad-output' : 'null'}`)
      }
      const [provider, model] = label.split('/')
      return { report: result, provider: provider.toLowerCase(), model }
    })
  )

  try {
    const winner = await Promise.any(racingPromises)
    console.log(`[fallback-llm] Winner: ${winner.provider}/${winner.model}`)
    return winner
  } catch (aggregateError) {
    const tried = aggregateError.errors?.map(e => e.message).join(', ') || 'unknown'
    throw new Error(`All fallback LLM providers failed. Tried: ${tried}`)
  }
}

// ══════════════════════════════════════════════════════════════════
// PROMPTS — matching worker output format
// ══════════════════════════════════════════════════════════════════

// When we HAVE search results — use the same prompt as the worker
const QUICK_WITH_SOURCES_PROMPT = `You are APEX RESEARCH, a research synthesis engine. Produce a focused, evidence-backed report based on the provided sources.

OUTPUT BUDGET: ~600-1,000 words. Stay within this — finish cleanly with a Sources list. Truncation is the worst failure mode.

STYLE RULES:
1. Use plain prose. Reserve **bold** for genuinely critical terms (max 1-2 per paragraph). Do NOT bold entire sentences.
2. Use one markdown table only if comparison data genuinely helps. Do NOT add a table just for the sake of having one.
3. Cite claims with [N] matching source numbers. Only cite a source you actually read.
4. Use confidence language sparingly: "established" (2+ sources), "likely" (one source + reasoning), "uncertain" (speculative).
5. Do NOT invent statistics. If a number isn't in the sources, omit it or phrase it qualitatively.
6. Do NOT write filler like "Based on the search results," "In today's rapidly evolving landscape," etc. Start with the finding.
7. Write in third person, neutral analytical tone.

STRUCTURE (use these exact headings):

## Executive Summary
2-3 sentences. The finding, why it matters.

## Key Findings
A markdown table with 4-6 rows. Columns: Finding | Evidence | Confidence | Source.
Follow with 1-2 paragraphs of analysis — what sources agree on, where they diverge.

## Analysis
2-3 paragraphs. Themes, contradictions, gaps in the evidence.

## Implications
1-2 paragraphs. Who is affected, what they should do.

## Confidence Assessment
1 short paragraph. Overall confidence (High/Moderate/Low) + the single biggest uncertainty.

Do NOT include a Sources section — the sources list is shown separately in the UI. Keep [N] citations inline only.

FOLLOWUPS:
1. Specific, answerable follow-up question?
2. Specific, answerable follow-up question?
3. Specific, answerable follow-up question?`

const DEEP_WITH_SOURCES_PROMPT = `You are APEX RESEARCH DEEP, a research analyst. Write a thorough, well-structured research report based on the provided sources.

OUTPUT BUDGET: ~2,500-3,500 words. You have a hard token limit, so DO NOT aim for 10,000 words — finish every section cleanly. Truncation is the worst failure mode.

STYLE RULES:
1. Use plain prose for analysis. Reserve **bold** for genuinely critical terms (max 1-2 per paragraph). Do NOT bold entire sentences.
2. Use markdown tables only where comparison data genuinely helps (2-4 tables max). Do NOT add tables just to "look thorough."
3. Cite claims with [N] matching source numbers. Only cite a source you actually read.
4. Use confidence language sparingly: "established" (2+ sources), "likely" (one source + reasoning), "uncertain" (speculative).
5. Do NOT invent statistics. If a number isn't in the sources, either omit it or phrase it qualitatively ("growing", "significant", "limited").
6. Do NOT write filler like "Based on the search results," "In today's rapidly evolving landscape," etc. Get to the point.
7. Write in third person, neutral analytical tone — like a senior analyst's memo, not a marketing brochure.

STRUCTURE (use these exact headings):

## Executive Summary
4-6 sentences. The finding, why it matters, key uncertainties.

## Key Findings
A markdown table with 5-8 rows. Columns: Finding | Evidence | Confidence | Source.
Follow with 2-3 paragraphs of cross-source analysis — what multiple sources agree on, where they diverge.

## Context
3-4 paragraphs. Background the reader needs: history, key stakeholders, current state. Cite sources where possible.

## Analysis
4-6 paragraphs organized by theme. For each theme: what the sources say, what's missing, what the implications are. Challenge weak claims. Note contradictions between sources.

## Comparison
One table comparing 2-4 relevant options/frameworks/approaches (whatever the topic implies). 4-6 rows. Follow with 1-2 paragraphs of analysis.

## Implications
2-3 paragraphs. Who is affected, what they should do, what to watch for.

## Confidence Assessment
1 short paragraph. Overall confidence (High/Moderate/Low) + the single biggest uncertainty.

Do NOT include a Sources section — the sources list is shown separately in the UI. Keep [N] citations inline only.

FOLLOWUPS:
1. Specific, answerable follow-up question?
2. Specific, answerable follow-up question?
3. Specific, answerable follow-up question?`

// When we DON'T have search results — LLM-only mode (offline)
const QUICK_OFFLINE_PROMPT = `You are APEX RESEARCH, a research synthesis engine. Produce a focused report based on the user's query. You are in offline mode — no live web search. Use your training knowledge; mark anything you are not sure about.

OUTPUT BUDGET: ~600-1,000 words. Finish cleanly. Truncation is the worst failure mode.

STYLE RULES:
1. Use plain prose. Reserve **bold** for genuinely critical terms (max 1-2 per paragraph). Do NOT bold entire sentences.
2. Use one markdown table only if comparison data genuinely helps.
3. Mark knowledge boundaries inline: [ESTABLISHED], [LIKELY], [UNCERTAIN], [UNKNOWN].
4. Do NOT invent statistics, citations, or URLs. If you don't have a number, write qualitatively.
5. Do NOT write filler like "As of my training data," "In today's rapidly evolving landscape," etc. Start with the finding.
6. Write in third person, neutral analytical tone.

STRUCTURE (use these exact headings):

## Executive Summary
2-3 sentences. The finding, why it matters.

## Key Findings
A markdown table with 4-6 rows. Columns: Finding | Evidence | Confidence | Notes.
Follow with 1-2 paragraphs of analysis.

## Analysis
2-3 paragraphs. Themes, debates, gaps. Flag uncertainties explicitly.

## Implications
1-2 paragraphs. Who is affected, what they should do.

## Confidence Assessment
1 short paragraph. Overall confidence (High/Moderate/Low) + the single biggest uncertainty.

FOLLOWUPS:
1. Specific, answerable follow-up question?
2. Specific, answerable follow-up question?
3. Specific, answerable follow-up question?`

const DEEP_OFFLINE_PROMPT = `You are APEX RESEARCH DEEP, a research analyst. Write a thorough, well-structured research report based on the user's query. You are in offline mode — no live web search. Use your training knowledge; mark anything you are not sure about.

OUTPUT BUDGET: ~2,500-3,500 words. You have a hard token limit. DO NOT aim for more — finish every section cleanly. Truncation is the worst failure mode.

STYLE RULES:
1. Use plain prose for analysis. Reserve **bold** for genuinely critical terms (max 1-2 per paragraph). Do NOT bold entire sentences.
2. Use markdown tables only where comparison data genuinely helps (2-4 tables max).
3. Mark knowledge boundaries inline: [ESTABLISHED], [LIKELY], [UNCERTAIN], [UNKNOWN].
4. Do NOT invent statistics, citations, or URLs. If you don't have a number, write qualitatively ("growing", "significant", "limited").
5. Do NOT write filler like "In today's rapidly evolving landscape." Get to the point.
6. Write in third person, neutral analytical tone — like a senior analyst's memo.

STRUCTURE (use these exact headings):

## Executive Summary
4-6 sentences. The finding, why it matters, key uncertainties.

## Key Findings
A markdown table with 5-8 rows. Columns: Finding | Evidence | Confidence | Notes.
Follow with 2-3 paragraphs of analysis — patterns, divergences, gaps.

## Context
3-4 paragraphs. Background the reader needs: history, key stakeholders, current state.

## Analysis
4-6 paragraphs organized by theme. For each theme: what is known, what is debated, what the implications are. Flag uncertainties explicitly.

## Comparison
One table comparing 2-4 relevant options/frameworks/approaches. 4-6 rows. Follow with 1-2 paragraphs of analysis.

## Implications
2-3 paragraphs. Who is affected, what they should do, what to watch for.

## Confidence Assessment
1 short paragraph. Overall confidence (High/Moderate/Low) + the single biggest uncertainty.

FOLLOWUPS:
1. Specific, answerable follow-up question?
2. Specific, answerable follow-up question?
3. Specific, answerable follow-up question?`

// ══════════════════════════════════════════════════════════════════
// EXTRACT FOLLOWUPS (same as worker)
// ══════════════════════════════════════════════════════════════════

function extractFollowups(text) {
  if (!text) return { report: '', followups: [] }

  const match = text.match(/FOLLOWUPS:\s*\n([\s\S]*?)$/i)
  if (match) {
    const followups = match[1]
      .split('\n')
      .map(line => line.replace(/^\d+\.\s*/, '').trim())
      .filter(q => q.length > 0 && q.endsWith('?'))
    const report = text.replace(/FOLLOWUPS:\s*\n[\s\S]*$/i, '').trim()
    return { report, followups }
  }

  const questionsSection = text.match(/## Questions for Further Research[\s\S]*$/i)
  if (questionsSection) {
    const followups = []
    const questionRegex = /^\d+\.\s*(.+)/gm
    let m
    while ((m = questionRegex.exec(questionsSection[0])) !== null) {
      if (followups.length < 5) followups.push(m[1].trim())
    }
    if (followups.length > 0) {
      const report = text.replace(/## Questions for Further Research[\s\S]*$/i, '').trim()
      return { report, followups }
    }
  }

  const lines = text.split('\n')
  const tail = lines.slice(-15)
  const questions = []
  for (const line of tail) {
    const cleaned = line.replace(/^[-*]\s*/, '').replace(/^\d+\.\s*/, '').trim()
    if (cleaned.length > 10 && cleaned.endsWith('?')) questions.push(cleaned)
  }
  if (questions.length > 0) {
    let report = text
    for (const q of questions) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      report = report.replace(new RegExp(`^.*${escaped}.*$`, 'm'), '')
    }
    return { report: report.trim(), followups: questions }
  }

  return { report: text, followups: [] }
}

// ══════════════════════════════════════════════════════════════════
// MAIN HANDLER
// ══════════════════════════════════════════════════════════════════

export async function POST(req) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!rateLimit(ip).ok) {
    return Response.json({ error: 'Too many requests.' }, { status: 429 })
  }

  try {
    const body = await req.json()
    const { query, mode = 'quick', apex_model = 'apex-free' } = body

    if (!query || typeof query !== 'string') {
      return Response.json({ error: 'Query is required' }, { status: 400 })
    }

    if (query.length > 2000) {
      return Response.json({ error: 'Query too long (max 2000 characters)' }, { status: 400 })
    }

    const t0 = Date.now()

    // ── PHASE 1: Search (try to get live sources) ──
    console.log(`[research-fallback] Phase 1: Searching for "${query.slice(0, 50)}"`)
    let searchResults = []
    let hasSources = false

    try {
      searchResults = await searchQuick(query, 10)
      hasSources = searchResults.length > 0
      console.log(`[research-fallback] Found ${searchResults.length} sources in ${Date.now() - t0}ms`)
    } catch (err) {
      console.log('[research-fallback] Search failed, using offline mode:', err.message)
    }

    // ── PHASE 2: Choose prompt & build messages ──
    const isDeep = mode === 'deep'
    let systemPrompt
    let userContent

    if (hasSources) {
      // Same pipeline as the worker — cite sources with [N]
      systemPrompt = isDeep ? DEEP_WITH_SOURCES_PROMPT : QUICK_WITH_SOURCES_PROMPT
      const sourcesContext = searchResults.map((s, i) =>
        `[${i + 1}] ${s.title}\n${s.snippet}`
      ).join('\n\n')
      userContent = `Research query: "${query}"\n\nSources:\n${sourcesContext}`
    } else {
      // Offline mode — LLM knowledge only
      systemPrompt = isDeep ? DEEP_OFFLINE_PROMPT : QUICK_OFFLINE_PROMPT
      userContent = query.trim()
    }

    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ]

    // ── PHASE 3: Generate with LLM fallback chain ──
    console.log(`[research-fallback] Phase 2: Generating report (${hasSources ? 'with sources' : 'offline'}, ${apex_model})`)
    const llmResult = await generateWithFallback(messages, apex_model, mode)
    console.log(`[research-fallback] Report generated by ${llmResult.provider}/${llmResult.model} in ${Date.now() - t0}ms`)

    // ── PHASE 4: Process output ──
    const { report, followups } = extractFollowups(llmResult.report)

    // Format sources for frontend
    const sources = hasSources ? searchResults.map((s, i) => ({
      id: i,
      url: s.url,
      title: s.title || `Source ${i + 1}`,
      snippet: s.snippet?.slice(0, 200) || '',
      favicon: '',
      status: 'loaded',
    })) : []

    // Fallback followups if model didn't provide any
    // Use a short topic label instead of the full query
    const topic = query.trim().length > 40 ? query.trim().slice(0, 37) + '...' : query.trim()
    const finalFollowups = followups.length > 0 ? followups : [
      `What are the latest developments in ${topic}?`,
      `What are the main criticisms or controversies around ${topic}?`,
      `How does ${topic} compare to alternative approaches?`,
    ]

    return Response.json({
      sources,
      report,
      content: '',
      title: query.trim(),
      followups: finalFollowups,
      mode,
      fallback: true,
      fallback_provider: llmResult.provider,
      fallback_model: llmResult.model,
      fallback_tier: apex_model,
      fallback_sourced: hasSources,
    })
  } catch (error) {
    console.error('[research-fallback] Error:', error)

    if (error.name === 'TimeoutError' || error.message?.includes('abort')) {
      return Response.json({ error: 'Fallback timed out. Please try again.' }, { status: 504 })
    }

    return Response.json({ error: error.message || 'Fallback research failed' }, { status: 500 })
  }
}
