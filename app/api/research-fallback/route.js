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
  return process.env.TAVILY_API_KEY || ''
}
function getFirecrawlKey() {
  return process.env.FIRECRAWL_API_KEY || ''
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
async function openaiCompatChat(url, apiKey, model, messages, maxTokens, timeout = 60000) {
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

// ── LLM Fallback Chain: Mistral → Groq → Gemini → OpenRouter ──
async function generateWithFallback(messages, apexModel, mode = 'quick') {
  const errors = []
  const maxTokens = apexModel === 'apex-premium' ? 8192 : 4096

  // 1. Mistral (primary)
  const mistralKey = getMistralKey()
  if (mistralKey) {
    const mistralModels = apexModel === 'apex-premium'
      ? ['mistral-large-latest', 'mistral-medium-latest']
      : ['mistral-small-latest', 'ministral-8b-latest']
    for (const model of mistralModels) {
      const result = await openaiCompatChat(
        'https://api.mistral.ai/v1/chat/completions', mistralKey, model, messages, maxTokens, 60000
      )
      if (result && validateOutput(result, mode)) return { report: result, provider: 'mistral', model }
      errors.push(`Mistral/${model}:${result ? 'bad-output' : 'null'}`)
    }
  } else {
    errors.push('Mistral: no key')
  }

  // 2. Groq (secondary)
  const groqKey = getGroqKey()
  if (groqKey) {
    const groqModels = apexModel === 'apex-premium'
      ? ['llama-3.3-70b-versatile']
      : ['llama-3.1-8b-instant']
    for (const model of groqModels) {
      const result = await openaiCompatChat(
        'https://api.groq.com/openai/v1/chat/completions', groqKey, model, messages, maxTokens, 45000
      )
      if (result && validateOutput(result, mode)) return { report: result, provider: 'groq', model }
      errors.push(`Groq/${model}:${result ? 'bad-output' : 'null'}`)
    }
  } else {
    errors.push('Groq: no key')
  }

  // 3. Google Gemini (tertiary)
  if (getGeminiKey()) {
    const geminiModels = [
      { model: 'gemini-2.0-flash', timeout: 20000 },
      { model: 'gemini-1.5-flash', timeout: 20000 },
    ]
    for (const { model, timeout } of geminiModels) {
      const result = await geminiChat(messages, model, maxTokens, timeout)
      if (result && validateOutput(result, mode)) return { report: result, provider: 'gemini', model }
      errors.push(`Gemini/${model}:${result ? 'bad-output' : 'null'}`)
    }
  } else {
    errors.push('Gemini: no key')
  }

  // 4. OpenRouter (last resort)
  if (getOpenRouterKey()) {
    const orModels = [
      { model: 'meta-llama/llama-4-maverick', timeout: 60000 },
      { model: 'mistralai/mistral-small-3.1-24b-instruct', timeout: 20000 },
    ]
    for (const { model, timeout } of orModels) {
      const result = await openaiCompatChat(
        'https://openrouter.ai/api/v1/chat/completions', getOpenRouterKey(), model, messages, maxTokens, timeout
      )
      if (result && validateOutput(result, mode)) return { report: result, provider: 'openrouter', model }
      errors.push(`OpenRouter/${model}:${result ? 'bad-output' : 'null'}`)
    }
  } else {
    errors.push('OpenRouter: no key')
  }

  throw new Error(`All fallback LLM providers failed. Tried: ${errors.join(', ')}`)
}

// ══════════════════════════════════════════════════════════════════
// PROMPTS — matching worker output format
// ══════════════════════════════════════════════════════════════════

// When we HAVE search results — use the same prompt as the worker
const QUICK_WITH_SOURCES_PROMPT = `You are APEX RESEARCH, an elite research synthesis engine. Produce comprehensive, evidence-backed reports.

RULES:
1. Cite every claim with [N] notation matching source numbers.
2. Use confidence language: "Established" (2+ sources), "Likely" (strong evidence), "Possible" (some evidence).
3. Include at least 1 markdown table.
4. No filler. No "Based on the search results". Start directly with information.
5. Be thorough but concise — every sentence must carry information.

STRUCTURE:
## Executive Summary
3-5 sentences. What was found, why it matters.

## Key Findings
Table with 5-7 rows:
| # | Finding | Evidence | Source | Implication |
|---|---------|----------|--------|-------------|
Then 2-3 paragraphs elaborating.

## Detailed Analysis
3-5 paragraphs of deep analysis. Cite sources. Cover themes, contradictions, context.

## Comparison Table
| Category | Option A | Option B | Option C |
|----------|----------|----------|----------|
At least 4 rows + brief analysis.

## Practical Implications
2-3 paragraphs. Who should care, what to do, what to watch for.

## Confidence Assessment
Rate: [High/Moderate/Low]. Justify in 2-3 sentences.

FOLLOWUPS:
1. Question one?
2. Question two?
3. Question three?`

const DEEP_WITH_SOURCES_PROMPT = `You are APEX RESEARCH DEEP, a world-class research analyst. Produce COMPREHENSIVE, publication-quality reports of 10,000+ words. Your reports must be exhaustive, data-rich, and equivalent to a professional consulting engagement.

CRITICAL RULES:
1. LENGTH: Write AT LEAST 10,000 words. This is non-negotiable. Expand every section fully.
2. TABLES: Include AT LEAST 5 markdown tables, each with 5+ rows. More tables = better.
3. CITATIONS: Cite every claim with [N] notation matching source numbers.
4. CONFIDENCE: Use "Established", "Likely", "Possible", "Uncertain", "Speculative".
5. NO FILLER: Start directly with information. Every sentence must carry substance.
6. DEPTH: Think like a senior analyst. Identify patterns, synthesize, challenge assumptions, quantify impacts.
7. EXAMPLES: Include specific real-world examples, case studies, statistics, and data points.
8. NO SUMMARIZATION: Do NOT write brief summaries. Write exhaustive, detailed analysis for every section.

STRUCTURE (write each section as a MINI-ESSAY of 500-1000+ words):

## Executive Summary
8-12 sentences. What was found, why it matters, key numbers, critical implications. Include overall confidence rating.

## Key Findings
LARGE TABLE with 10-15 rows:
| # | Finding | Evidence | Confidence | Sources | Impact | Timeline |
|---|---------|----------|------------|---------|--------|----------|
Then 5-8 paragraphs of detailed cross-source analysis. Discuss each finding in depth with examples and data.

## Foundational Context
8-12 paragraphs covering:
- Historical evolution and key milestones
- Current state of the field/industry/topic
- Key stakeholders and their positions
- Market size, growth rates, and economic data
- Regulatory landscape and policy frameworks
- Technological infrastructure and dependencies

## Detailed Analysis
12-18 paragraphs organized by themes. Each theme gets 3-4 paragraphs of deep analysis:
- Cover patterns, contradictions, and gaps in the evidence
- Analyze emerging trends with supporting data
- Include specific case studies and real-world examples

## Comparative Analysis
AT LEAST 3 detailed comparison tables (6+ rows each). Each table must be followed by 3-4 paragraphs of analysis.

## Risk & Opportunity Assessment
TABLE with 8+ rows (4 risks + 4 opportunities):
| Category | Item | Probability | Impact | Evidence | Mitigation/Leverage |
Then 5-6 paragraphs of detailed risk analysis.

## Practical Recommendations
7-10 actionable recommendations, each with specific action steps, expected outcome, and evidence justification.

## Future Outlook
6-8 paragraphs covering near-term, medium-term, and long-term scenarios.

## Confidence Assessment
Overall confidence + by section. Key uncertainties. What further research would improve confidence.

FOLLOWUPS:
1-5. Specific, actionable follow-up research questions?`

// When we DON'T have search results — LLM-only mode (offline)
const QUICK_OFFLINE_PROMPT = `You are APEX RESEARCH, an elite research synthesis engine. Produce a comprehensive, evidence-backed report based on the user's query. You are operating in offline mode — no live web search is available. Use your training knowledge to deliver the most accurate and current information possible.

RULES:
1. Use confidence language: "Established" (broad consensus), "Likely" (strong evidence), "Possible" (some evidence), "Uncertain" (limited evidence).
2. Include markdown tables where they compress information effectively.
3. No filler. No "Based on my knowledge" or "As of my training data". Start directly with information.
4. Quantify whenever possible. "Significant" → give the effect size. "Recently" → give the year.
5. Mark knowledge boundaries: [ESTABLISHED], [ACTIVE DEBATE], [SPECULATIVE], [UNKNOWN].
6. Do NOT fabricate citations or URLs. Use [Author, Year] format and note from memory.

STRUCTURE:
## Executive Summary
3-5 sentences. What was found, why it matters. Include overall confidence rating.

## Key Findings
Table with 5-8 rows:
| # | Finding | Evidence | Confidence | Implication |
|---|---------|----------|------------|-------------|
Then 2-3 paragraphs elaborating.

## Overview
4-6 detailed paragraphs providing context, background, current state.

## Detailed Analysis
3-5 paragraphs of in-depth analysis. Cover themes, contradictions, perspectives.

## Comparison Table
| Category | Option A | Option B | Option C |
|----------|----------|----------|----------|
At least 4 rows + brief analysis.

## Practical Implications
2-3 paragraphs. Who should care, what to do, what to watch for.

## Confidence Assessment
Rate: [High/Moderate/Low]. Justify in 2-3 sentences. Flag key uncertainties.

FOLLOWUPS:
1. [specific, actionable follow-up research question]
2. [specific, actionable follow-up research question]
3. [specific, actionable follow-up research question]`

const DEEP_OFFLINE_PROMPT = `You are APEX RESEARCH DEEP, a world-class research analyst. Produce a COMPREHENSIVE, publication-quality report based on the user's query. You are operating in offline mode — no live web search is available. Think like a senior analyst at a top consulting firm.

CRITICAL RULES:
1. Write AT LEAST 2000-3000+ words. Expand every section fully.
2. Include AT LEAST 4 markdown tables, each with 5+ rows.
3. Use confidence language: "Established", "Likely", "Possible", "Uncertain", "Speculative".
4. No filler. Start directly with information.
5. Quantify whenever possible. Give specific numbers, years, percentages, market sizes.
6. Mark knowledge boundaries: [ESTABLISHED], [ACTIVE DEBATE], [SPECULATIVE], [UNKNOWN].
7. Include specific real-world examples, case studies, and data points.
8. Do NOT fabricate citations or URLs. Use [Author, Year] format and note from memory.

STRUCTURE:
## Executive Summary
8-12 sentences. What was found, why it matters, key numbers, critical implications.

## Key Findings
LARGE TABLE with 8-12 rows:
| # | Finding | Evidence | Confidence | Impact | Timeline |
|---|---------|----------|------------|--------|----------|
Then 5-8 paragraphs of detailed analysis.

## Foundational Context
8-12 paragraphs: history, current state, stakeholders, market data, regulation, technology.

## Detailed Analysis
10-15 paragraphs by themes with examples and data.

## Comparative Analysis
AT LEAST 2 comparison tables (5+ rows each) + 3-4 paragraphs analysis each.

## Active Debates & Conflicting Evidence
TABLE with 5+ rows + 2-3 paragraphs per debate.

## Risk & Opportunity Assessment
TABLE with 6+ rows + 4-5 paragraphs analysis.

## Practical Recommendations
5-8 actionable recommendations with justification.

## Future Outlook
4-6 paragraphs: near-term, medium-term, long-term scenarios.

## Confidence Assessment
Overall + by section. Key uncertainties.

FOLLOWUPS:
1. [specific, actionable follow-up research question]
2. [specific, actionable follow-up research question]
3. [specific, actionable follow-up research question]
4. [specific, actionable follow-up research question]
5. [specific, actionable follow-up research question]`

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
      title: query.trim(),
      followups: finalFollowups,
      mode,
      classification: 'general',
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
