export const runtime = 'edge'

import { rateLimit } from '@/lib/ratelimit'

// ══════════════════════════════════════════════════════════════════
// FALLBACK RESEARCH API — Mistral AI (primary) + Groq (secondary)
// When the primary research worker fails entirely, this endpoint
// generates a research report using LLM knowledge alone (no search).
// Different prompts for Apex 1.7 (free) and Apex 2.3 (premium).
// ══════════════════════════════════════════════════════════════════

const MISTRAL_API_URL = 'https://api.mistral.ai/v1/chat/completions'
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

// ── Apex 1.7 Free Prompt — concise, fast, matches worker output format ──
const APEX_FREE_PROMPT = `You are APEX RESEARCH, an elite research synthesis engine. Produce a comprehensive, evidence-backed report based on the user's query. You are operating in offline mode — no live web search is available. Use your training knowledge to deliver the most accurate and current information possible.

RULES:
1. Use confidence language: "Established" (broad consensus), "Likely" (strong evidence), "Possible" (some evidence), "Uncertain" (limited evidence).
2. Include markdown tables where they compress information effectively.
3. No filler. No "Based on my knowledge" or "As of my training data". Start directly with information.
4. Be thorough but concise — every sentence must carry information.
5. Quantify whenever possible. "Significant" → give the effect size. "Recently" → give the year. "Many studies" → give numbers.
6. Mark knowledge boundaries: [ESTABLISHED], [ACTIVE DEBATE], [SPECULATIVE], [UNKNOWN].
7. Do NOT fabricate citations or URLs. If referencing studies, use [Author, Year] format and note they are from memory.

STRUCTURE:
## Executive Summary
3-5 sentences. What was found, why it matters. Include overall confidence rating.

## Key Findings
Table with 5-8 rows:
| # | Finding | Evidence | Confidence | Implication |
|---|---------|----------|------------|-------------|
Then 2-3 paragraphs elaborating the most important findings.

## Overview
4-6 detailed paragraphs providing context, background, current state, and key milestones.

## Detailed Analysis
3-5 paragraphs of in-depth analysis. Cover themes, contradictions, different perspectives. Cite specific data and examples.

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

// ── Apex 2.3 Premium Prompt — comprehensive, deep, matches worker output format ──
const APEX_PREMIUM_PROMPT = `You are APEX RESEARCH DEEP, a world-class research analyst. Produce a COMPREHENSIVE, publication-quality report based on the user's query. You are operating in offline mode — no live web search is available. Use your training knowledge to deliver the most accurate, detailed, and current information possible. Think like a senior analyst at a top consulting firm.

CRITICAL RULES:
1. Write AT LEAST 2000-3000+ words. Expand every section fully.
2. Include AT LEAST 4 markdown tables, each with 5+ rows. More tables = better.
3. Use confidence language: "Established" (broad consensus), "Likely" (strong evidence), "Possible" (some evidence), "Uncertain" (limited evidence), "Speculative" (logical inference).
4. No filler. Start directly with information. Every sentence must carry substance.
5. Quantify whenever possible. Give specific numbers, years, percentages, market sizes.
6. Mark knowledge boundaries: [ESTABLISHED], [ACTIVE DEBATE], [SPECULATIVE], [UNKNOWN].
7. Include specific real-world examples, case studies, and data points.
8. Do NOT fabricate citations or URLs. If referencing studies, use [Author, Year] format and note they are from memory.
9. Do NOT write brief summaries. Write exhaustive, detailed analysis for every section.

STRUCTURE (write each section as a detailed analysis):

## Executive Summary
8-12 sentences. What was found, why it matters, key numbers, critical implications. Include overall confidence rating.

## Key Findings
LARGE TABLE with 8-12 rows:
| # | Finding | Evidence | Confidence | Impact | Timeline |
|---|---------|----------|------------|--------|----------|
Then 5-8 paragraphs of detailed cross-source analysis. Discuss each finding in depth with examples and data.

## Foundational Context
8-12 paragraphs covering:
- Historical evolution and key milestones
- Current state of the field/industry/topic with data
- Key stakeholders and their positions
- Market size, growth rates, and economic data
- Regulatory landscape and policy frameworks
- Technological infrastructure and dependencies

## Detailed Analysis
10-15 paragraphs organized by themes. Each theme gets 2-3 paragraphs of in-depth analysis with examples and data.

## Comparative Analysis
AT LEAST 2 detailed comparison tables (5+ rows each):
- Table 1: Feature/capability comparison
- Table 2: Market/industry comparison with metrics
Each table followed by 3-4 paragraphs of analysis explaining the comparisons.

## Active Debates & Conflicting Evidence
TABLE with 5+ rows:
| Debate | Position A | Position B | Current Consensus |
Then 2-3 paragraphs per debate, analyzing the evidence on each side.

## Risk & Opportunity Assessment
TABLE with 6+ rows (3 risks + 3 opportunities):
| Category | Item | Probability | Impact | Mitigation/Leverage |
Then 4-5 paragraphs of detailed risk analysis and opportunity framing.

## Practical Recommendations
5-8 actionable recommendations, each with specific action steps, expected outcome, and evidence justification.

## Future Outlook
4-6 paragraphs covering near-term (1-2 years), medium-term (3-5 years), and long-term scenarios.

## Confidence Assessment
Overall confidence + by section. Key uncertainties. What further research would improve confidence.

FOLLOWUPS:
1. [specific, actionable follow-up research question]
2. [specific, actionable follow-up research question]
3. [specific, actionable follow-up research question]
4. [specific, actionable follow-up research question]
5. [specific, actionable follow-up research question]`

// ── Provider configurations ──
const PROVIDERS = {
  mistral: {
    url: MISTRAL_API_URL,
    keyEnv: 'MISTRAL_API_KEY_FALLBACK',
    secondaryKeyEnv: 'MISTRAL_API_KEY',
    models: {
      'apex-free': 'mistral-small-latest',
      'apex-premium': 'mistral-large-latest',
    },
    maxTokens: {
      'apex-free': 4096,
      'apex-premium': 8192,
    },
    timeout: 60000,
  },
  groq: {
    url: GROQ_API_URL,
    keyEnv: 'GROQ_API_KEY_FALLBACK',
    secondaryKeyEnv: 'GROQ_API_KEY',
    models: {
      'apex-free': 'llama-3.1-8b-instant',
      'apex-premium': 'llama-3.3-70b-versatile',
    },
    maxTokens: {
      'apex-free': 4096,
      'apex-premium': 8192,
    },
    timeout: 45000,
  },
}

// ── Call a provider and return the result ──
async function callProvider(providerName, apiKey, systemPrompt, query, apexModel) {
  const provider = PROVIDERS[providerName]
  const model = provider.models[apexModel] || provider.models['apex-free']
  const maxTokens = provider.maxTokens[apexModel] || 4096

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), provider.timeout)

  try {
    const res = await fetch(provider.url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: query.trim() },
        ],
        temperature: 0.3,
        max_tokens: maxTokens,
      }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error(`[research-fallback] ${providerName}/${model} error ${res.status}:`, errText.slice(0, 300))
      return { success: false, error: `${providerName} error ${res.status}`, status: res.status }
    }

    const data = await res.json()
    const report = data.choices?.[0]?.message?.content || ''

    if (!report || report.length < 100) {
      return { success: false, error: `${providerName} produced no output` }
    }

    return { success: true, report, model, provider: providerName }
  } catch (err) {
    if (err.name === 'AbortError' || err.name === 'TimeoutError') {
      console.error(`[research-fallback] ${providerName} timed out`)
      return { success: false, error: `${providerName} timed out` }
    }
    console.error(`[research-fallback] ${providerName} exception:`, err.message)
    return { success: false, error: err.message }
  } finally {
    clearTimeout(timeout)
  }
}

// ── Extract followups from the report using the same format as the worker ──
function extractFollowups(text) {
  if (!text) return { report: '', followups: [] }

  // Try "FOLLOWUPS:" section (matches worker format)
  const match = text.match(/FOLLOWUPS:\s*\n([\s\S]*?)$/i)
  if (match) {
    const followups = match[1]
      .split('\n')
      .map(line => line.replace(/^\d+\.\s*/, '').trim())
      .filter(q => q.length > 0 && q.endsWith('?'))
    const report = text.replace(/FOLLOWUPS:\s*\n[\s\S]*$/i, '').trim()
    return { report, followups }
  }

  // Fallback: "Questions for Further Research" heading
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

  // Final fallback: scan last 15 lines for numbered/bulleted questions
  const lines = text.split('\n')
  const tail = lines.slice(-15)
  const questions = []
  for (const line of tail) {
    const cleaned = line.replace(/^[-*]\s*/, '').replace(/^\d+\.\s*/, '').trim()
    if (cleaned.length > 10 && cleaned.endsWith('?')) {
      questions.push(cleaned)
    }
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

    // Choose prompt based on tier
    const systemPrompt = apex_model === 'apex-premium' ? APEX_PREMIUM_PROMPT : APEX_FREE_PROMPT

    // ── Provider fallback chain: Mistral → Groq ──
    const errors = []
    let result = null

    // 1. Mistral AI (primary)
    const mistralKey = process.env.MISTRAL_API_KEY_FALLBACK || process.env.MISTRAL_API_KEY || ''
    if (mistralKey) {
      console.log(`[research-fallback] Trying Mistral for ${apex_model} tier`)
      result = await callProvider('mistral', mistralKey, systemPrompt, query, apex_model)
      if (result.success) {
        console.log(`[research-fallback] Mistral succeeded (${result.model}, ${result.report.length} chars)`)
      } else {
        errors.push(`Mistral: ${result.error}`)
      }
    } else {
      errors.push('Mistral: no API key')
    }

    // 2. Groq (secondary)
    if (!result?.success) {
      const groqKey = process.env.GROQ_API_KEY_FALLBACK || process.env.GROQ_API_KEY || ''
      if (groqKey) {
        console.log(`[research-fallback] Trying Groq for ${apex_model} tier`)
        result = await callProvider('groq', groqKey, systemPrompt, query, apex_model)
        if (result.success) {
          console.log(`[research-fallback] Groq succeeded (${result.model}, ${result.report.length} chars)`)
        } else {
          errors.push(`Groq: ${result.error}`)
        }
      } else {
        errors.push('Groq: no API key')
      }
    }

    // All providers failed
    if (!result?.success) {
      return Response.json(
        { error: `All fallback providers failed. Tried: ${errors.join(', ')}` },
        { status: 502 }
      )
    }

    // Extract followups using the same logic as the worker
    const { report, followups } = extractFollowups(result.report)

    // Generate fallback followups if the model didn't provide any
    const finalFollowups = followups.length > 0 ? followups : [
      `What are the latest developments in ${query.trim()}?`,
      `What are the main criticisms or controversies around ${query.trim()}?`,
      `How does ${query.trim()} compare to alternative approaches?`,
    ]

    return Response.json({
      sources: [],
      report,
      content: '',  // Will be rendered as markdown on the frontend
      title: query.trim(),
      followups: finalFollowups,
      mode,
      fallback: true,
      fallback_provider: result.provider,
      fallback_model: result.model,
      fallback_tier: apex_model,
    })
  } catch (error) {
    console.error('[research-fallback] Error:', error)

    if (error.name === 'TimeoutError' || error.message?.includes('abort')) {
      return Response.json({ error: 'Fallback timed out. Please try again.' }, { status: 504 })
    }

    return Response.json({ error: error.message || 'Fallback research failed' }, { status: 500 })
  }
}
