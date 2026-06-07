export const runtime = 'edge'

import { rateLimit } from '@/lib/ratelimit'

// ── Groq Fallback Research API ──
// When the primary research worker fails entirely, this endpoint uses Groq
// to generate a research report directly — no search step, just LLM knowledge.
// Different prompts for Apex 1.7 (free) and Apex 2.3 (premium) tiers.

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

// Apex 1.7 Free — concise, fast research
const APEX_FREE_PROMPT = `You are Kivora Research AI (Apex 1.7 Free). Generate a concise but informative research report based on the user's query. Use your knowledge — no web search is available in fallback mode.

Structure your response EXACTLY as follows using Markdown:

## Executive Summary
5-8 sentences summarizing the key findings and why they matter.

## Key Findings
| # | Finding | Details | Confidence |
|---|---------|---------|------------|
Include 5-8 rows in the table. Then write 3-4 paragraphs of analysis.

## Overview
4-6 detailed paragraphs providing context, background, and current state.

## Analysis
4-6 paragraphs of in-depth analysis covering different aspects.

## Recommendations
3-5 actionable recommendations with brief justification for each.

## Questions for Further Research
1. [question]
2. [question]
3. [question]

RULES:
- Use confidence language: "Established", "Likely", "Possible", "Uncertain"
- Write clear, factual paragraphs (3-5 sentences each)
- Include a note at the top: "Generated in offline mode — no live sources were used"
- Be concise but thorough — aim for 800-1200 words total`

// Apex 2.3 Premium — detailed, comprehensive research
const APEX_PREMIUM_PROMPT = `You are Kivora Research AI (Apex 2.3 Premium). Generate a comprehensive, detailed research report based on the user's query. Use your knowledge — no web search is available in fallback mode. Be exhaustive and analytical.

Structure your response EXACTLY as follows using Markdown:

## Executive Summary
8-12 detailed sentences. What was found, why it matters, key numbers, critical implications. Include overall confidence rating.

## Key Findings
| # | Finding | Evidence | Confidence | Impact | Timeline |
|---|---------|----------|------------|--------|----------|
Include 8-12 rows in the table. Then write 5-8 paragraphs of detailed cross-source analysis.

## Foundational Context
Write 6-10 detailed paragraphs covering:
- Historical evolution and key milestones
- Current state with data and numbers
- Key stakeholders and organizations
- Market size, growth rates, economic data
- Regulatory landscape
- Technological infrastructure

## Detailed Analysis
Write 8-12 paragraphs organized by themes. Each theme gets 2-3 paragraphs of in-depth analysis with examples.

## Comparative Analysis
| Category | Option A | Option B | Verdict |
|----------|----------|----------|---------|
Include 2+ comparison tables with 4+ rows each. Each table followed by 2-3 paragraphs of analysis.

## Risk Assessment
| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
Include a risk table with 4-6 rows. Then write 3-4 paragraphs of analysis.

## Recommendations
5-8 actionable recommendations organized by priority with justification.

## Future Outlook
4-6 paragraphs on expected developments, trends, and predictions.

## Questions for Further Research
1. [question]
2. [question]
3. [question]
4. [question]
5. [question]

RULES:
- Use confidence language: "Established", "Likely", "Possible", "Uncertain"
- Write LONG paragraphs (5-8 sentences each)
- Include specific data, numbers, and examples wherever possible
- Include a note at the top: "Generated in offline mode — no live sources were used. For sourced research, try again when the service is available."
- Aim for 2000-3000+ words total`

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

    const groqKey = process.env.GROQ_API_KEY_FALLBACK || process.env.GROQ_API_KEY || ''
    if (!groqKey) {
      return Response.json({ error: 'Fallback service not configured.' }, { status: 503 })
    }

    // Choose prompt based on tier
    const systemPrompt = apex_model === 'apex-premium' ? APEX_PREMIUM_PROMPT : APEX_FREE_PROMPT

    // Choose model based on tier
    const model = apex_model === 'apex-premium'
      ? 'llama-3.3-70b-versatile'
      : 'llama-3.1-8b-instant'

    const maxTokens = apex_model === 'apex-premium' ? 8192 : 4096

    console.log(`[research-fallback] Using Groq ${model} for ${apex_model} tier`)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 60000)

    let groqRes
    try {
      groqRes = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqKey}`,
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
    } finally {
      clearTimeout(timeout)
    }

    if (!groqRes.ok) {
      const errText = await groqRes.text().catch(() => '')
      console.error(`[research-fallback] Groq error ${groqRes.status}:`, errText.slice(0, 300))
      return Response.json(
        { error: `Fallback service error (${groqRes.status}). Please try again later.` },
        { status: groqRes.status }
      )
    }

    const data = await groqRes.json()
    const report = data.choices?.[0]?.message?.content || ''

    if (!report || report.length < 100) {
      return Response.json({ error: 'Fallback produced no output. Please try again.' }, { status: 502 })
    }

    // Extract follow-up questions from the report
    const followups = []
    const questionRegex = /^\d+\.\s*(.+)/gm
    const questionsSection = report.match(/## Questions for Further Research[\s\S]*$/i)
    if (questionsSection) {
      let match
      while ((match = questionRegex.exec(questionsSection[0])) !== null) {
        if (followups.length < 5) followups.push(match[1].trim())
      }
    }

    return Response.json({
      sources: [],
      report,
      content: '',  // Will be rendered as markdown on the frontend
      title: query.trim(),
      followups,
      mode,
      fallback: true,
      fallback_provider: 'groq',
      fallback_model: model,
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
