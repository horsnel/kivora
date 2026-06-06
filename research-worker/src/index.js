// ══════════════════════════════════════════════════════════════════
// KIVORA RESEARCH WORKER — Cloudflare Worker (v4.0.0)
// Target: Quick ~10-15s, Deep ~30-60s (with 16K+ token output)
// Key optimizations:
//   - Quick mode: fast search (Tavily basic + Firecrawl), fast LLM (4K tokens)
//   - Deep mode: parallel URL reads, high-output LLM (16K tokens = ~12K words)
//   - Models: Gemini 2.5 Flash (65K output) via OpenRouter as primary for Deep
//   - Multiple LLM providers: OpenRouter → Google Gemini → Workers AI → Pollinations AI
//   - Apex model routing: apex-free (Pollinations-first) and apex-premium (OpenRouter-first)
// ══════════════════════════════════════════════════════════════════

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function jsonRes(data, status = 200) {
  return Response.json(data, { status, headers: CORS_HEADERS });
}

// ── API Keys ──
function getTavilyKey(env) {
  return env.TAVILY_API_KEY || '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';
}
function getOpenRouterKey(env) {
  return env.OPENROUTER_API_KEY || '';
}
function getGeminiKey(env) {
  return env.GEMINI_API_KEY || '';
}
function getBraveKey(env) {
  return env.BRAVE_SEARCH_API_KEY || '';
}
function getFirecrawlKey(env) {
  return env.FIRECRAWL_API_KEY || 'fc-9afd24762f1348c68c0c05e88130e890';
}

// ══════════════════════════════════════════════════════════════════
// SEARCH PROVIDERS
// ══════════════════════════════════════════════════════════════════

// Tavily — primary search (basic = ~1.4s, advanced = ~2.2s)
async function searchTavily(query, env, maxResults = 8, depth = 'basic') {
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getTavilyKey(env)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        search_depth: depth,
        include_answer: false, // skip answer to save time
        max_results: maxResults,
        include_raw_content: false,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).map(r => ({
      title: r.title || '',
      url: r.url || '',
      snippet: r.content || '',
      score: r.score || 0,
    }));
  } catch {
    return [];
  }
}

// Brave — optional, requires key
async function searchBrave(query, env, count = 8) {
  const key = getBraveKey(env);
  if (!key) return [];
  try {
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`, {
      headers: { 'X-Subscription-Token': key, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.web?.results || []).map(r => ({
      title: r.title || '',
      url: r.url || '',
      snippet: r.description || '',
      score: 0,
    }));
  } catch {
    return [];
  }
}

// Firecrawl Search — ~1.7s, high quality results
async function searchFirecrawl(query, env, limit = 8) {
  const key = getFirecrawlKey(env);
  if (!key) return [];
  try {
    const res = await fetch('https://api.firecrawl.dev/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, limit }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.success) return [];
    return (data.data || []).map(r => ({
      title: r.title || r.metadata?.title || '',
      url: r.url || r.metadata?.sourceURL || '',
      snippet: r.snippet || r.description || r.metadata?.description || '',
      score: 0,
    }));
  } catch {
    return [];
  }
}

// ── Fast search for quick mode (2 providers, ~2s total) ──
async function searchQuick(query, env, maxSources = 10) {
  const [tavilyResults, firecrawlResults] = await Promise.all([
    searchTavily(query, env, 8, 'basic'),  // ~1.4s
    searchFirecrawl(query, env, 6),         // ~1.7s
  ]);

  const seen = new Set();
  const all = [];
  for (const r of [...tavilyResults, ...firecrawlResults]) {
    const key = r.url.toLowerCase().replace(/\/+$/, '');
    if (key && !seen.has(key)) {
      seen.add(key);
      all.push(r);
    }
  }
  return all.slice(0, maxSources);
}

// ── Full search for deep mode (4 providers, ~2.5s total) ──
async function searchDeep(query, env, maxSources = 15) {
  const [tavilyResults, braveResults, firecrawlResults] = await Promise.all([
    searchTavily(query, env, 10, 'advanced'), // ~2.2s
    searchBrave(query, env, 8),                // ~skip if no key
    searchFirecrawl(query, env, 8),            // ~1.7s
  ]);

  const seen = new Set();
  const all = [];
  for (const r of [...tavilyResults, ...braveResults, ...firecrawlResults]) {
    const key = r.url.toLowerCase().replace(/\/+$/, '');
    if (key && !seen.has(key)) {
      seen.add(key);
      all.push(r);
    }
  }
  return all.slice(0, maxSources);
}

// ══════════════════════════════════════════════════════════════════
// URL READER (Jina Reader — fast, free, ~1-3s per URL)
// ══════════════════════════════════════════════════════════════════

async function readUrlJina(url) {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { 'Accept': 'text/markdown', 'X-Return-Format': 'markdown' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text.slice(0, 15000);
  } catch {
    return null;
  }
}

async function readUrlsParallel(urls, maxParallel = 5) {
  const results = [];
  for (let i = 0; i < urls.length; i += maxParallel) {
    const batch = urls.slice(i, i + maxParallel);
    const batchResults = await Promise.all(batch.map(url => readUrlJina(url)));
    for (let j = 0; j < batchResults.length; j++) {
      if (batchResults[j]) {
        results.push({ url: batch[j], content: batchResults[j] });
      }
    }
  }
  return results;
}

// ══════════════════════════════════════════════════════════════════
// LLM CALLS — SPEED OPTIMIZED
// ══════════════════════════════════════════════════════════════════

// OpenRouter (fast external LLM — Gemini Flash is ~5-10s for 4K tokens)
async function openrouterChat(env, messages, model = 'meta-llama/llama-4-maverick', maxTokens = 4096, timeout = 20000) {
  const apiKey = getOpenRouterKey(env);
  if (!apiKey) return null;

  try {
    const t0 = Date.now();
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://kivora.pages.dev',
        'X-Title': 'Kivora Research',
      },
      body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: maxTokens }),
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error(`[OpenRouter] ${model} error ${res.status} in ${Date.now()-t0}ms:`, text.slice(0, 300));
      return null;
    }
    const data = await res.json();
    console.log(`[OpenRouter] ${model} success in ${Date.now()-t0}ms, tokens:`, data.usage);
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error('[OpenRouter] exception:', err.message);
    return null;
  }
}

// Workers AI — free, built-in. 8b model is ~10-15s, 70b is ~60-70s
async function workersAiChat(env, messages, model, maxTokens = 2048) {
  if (!env.AI) return null;
  try {
    const t0 = Date.now();
    const response = await env.AI.run(model, {
      messages,
      max_tokens: maxTokens,
    });
    console.log(`[WorkersAI] ${model} responded in ${Date.now()-t0}ms`);
    return response?.response || null;
  } catch (err) {
    console.error(`[WorkersAI] ${model} exception:`, err.message);
    return null;
  }
}

// Google Gemini — free tier (15 RPM for Flash). Very fast ~3-8s
async function geminiChat(env, messages, model = 'gemini-2.0-flash', maxTokens = 4096, timeout = 20000) {
  const apiKey = getGeminiKey(env);
  if (!apiKey) return null;

  try {
    const t0 = Date.now();
    // Convert messages to Gemini format
    const contents = messages.map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: maxTokens,
          },
        }),
        signal: AbortSignal.timeout(timeout),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      console.error(`[Gemini] ${model} error ${res.status} in ${Date.now()-t0}ms:`, text.slice(0, 300));
      return null;
    }

    const data = await res.json();
    const result = data.candidates?.[0]?.content?.parts?.[0]?.text || null;
    console.log(`[Gemini] ${model} success in ${Date.now()-t0}ms, chars: ${result?.length || 0}`);
    return result;
  } catch (err) {
    console.error('[Gemini] exception:', err.message);
    return null;
  }
}

// Pollinations AI — free, no API key needed. ~3-8s for 4K tokens
async function pollinationsChat(messages, model = 'openai', maxTokens = 4096, timeout = 30000) {
  try {
    const t0 = Date.now();
    const res = await fetch('https://text.pollinations.ai/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        model,
        temperature: 0.3,
        max_tokens: maxTokens,
        seed: Math.floor(Math.random() * 10000),
      }),
      signal: AbortSignal.timeout(timeout),
    });
    if (!res.ok) return null;
    const text = await res.text();
    // Pollinations returns plain text, not JSON
    if (!text || text.length < 10) return null;
    console.log(`[Pollinations] ${model} success in ${Date.now()-t0}ms, chars: ${text.length}`);
    return text;
  } catch (err) {
    console.error('[Pollinations] exception:', err.message);
    return null;
  }
}

// Apex 1.7 — Free tier model routing (Pollinations → Workers AI → Gemini → OpenRouter)
async function llmApexFree(env, messages, maxTokens = 4096) {
  const errors = [];

  // 1. Pollinations AI — completely free
  const pollModels = ['openai', 'mistral', 'llama'];
  for (const model of pollModels) {
    const result = await pollinationsChat(messages, model, maxTokens, 30000);
    if (result) return result;
    errors.push(`Poll:${model}:null`);
  }

  // 2. Workers AI — free, built-in
  if (env.AI) {
    const workersAiModels = [
      '@cf/meta/llama-3.1-8b-instruct-fp8',
      '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      '@cf/qwen/qwen3-30b-a3b-fp8',
      '@cf/mistralai/mistral-small-3.1-24b-instruct',
    ];
    for (const m of workersAiModels) {
      const result = await workersAiChat(env, messages, m, Math.min(maxTokens, 4096));
      if (result) return result;
      errors.push(`WAI:${m}:null`);
    }
  }

  // 3. Google Gemini — free tier
  if (getGeminiKey(env)) {
    const geminiModels = [
      { model: 'gemini-2.0-flash', timeout: 20000 },
      { model: 'gemini-1.5-flash', timeout: 20000 },
    ];
    for (const { model, timeout } of geminiModels) {
      const result = await geminiChat(env, messages, model, maxTokens, timeout);
      if (result) return result;
      errors.push(`Gemini:${model}:null`);
    }
  }

  // 4. OpenRouter — last resort (uses credits)
  if (getOpenRouterKey(env)) {
    const orModels = [
      { model: 'meta-llama/llama-4-maverick', timeout: 30000 },
      { model: 'mistralai/mistral-small-3.1-24b-instruct', timeout: 20000 },
    ];
    for (const { model, timeout } of orModels) {
      const result = await openrouterChat(env, messages, model, maxTokens, timeout);
      if (result) return result;
      errors.push(`OR:${model}:null`);
    }
  }

  throw new Error(`All LLM providers failed (Apex 1.7 Free). Tried: ${errors.join(', ')}`);
}

// Apex 2.3 — Premium tier model routing (OpenRouter → Gemini → Workers AI → Pollinations)
async function llmApexPremium(env, messages, maxTokens = 4096) {
  const errors = [];

  // 1. OpenRouter — premium models first
  if (getOpenRouterKey(env)) {
    const orModels = [
      { model: 'meta-llama/llama-4-maverick', timeout: 30000 },
      { model: 'deepseek/deepseek-chat-v3-0324', timeout: 25000 },
      { model: 'qwen/qwen3-235b-a22b', timeout: 30000 },
    ];
    for (const { model, timeout } of orModels) {
      const result = await openrouterChat(env, messages, model, maxTokens, timeout);
      if (result) return result;
      errors.push(`OR:${model}:null`);
    }
  }

  // 2. Google Gemini
  if (getGeminiKey(env)) {
    const geminiModels = [
      { model: 'gemini-2.5-flash', timeout: 90000 },
      { model: 'gemini-2.0-flash', timeout: 60000 },
    ];
    for (const { model, timeout } of geminiModels) {
      const result = await geminiChat(env, messages, model, maxTokens, timeout);
      if (result) return result;
      errors.push(`Gemini:${model}:null`);
    }
  }

  // 3. Workers AI
  if (env.AI) {
    const workersAiModels = [
      '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      '@cf/qwen/qwen3-30b-a3b-fp8',
      '@cf/mistralai/mistral-small-3.1-24b-instruct',
    ];
    for (const m of workersAiModels) {
      const result = await workersAiChat(env, messages, m, Math.min(maxTokens, 4096));
      if (result) return result;
      errors.push(`WAI:${m}:null`);
    }
  }

  // 4. Pollinations — free fallback
  const pollModels = ['openai', 'mistral'];
  for (const model of pollModels) {
    const result = await pollinationsChat(messages, model, maxTokens, 30000);
    if (result) return result;
    errors.push(`Poll:${model}:null`);
  }

  throw new Error(`All LLM providers failed (Apex 2.3 Premium). Tried: ${errors.join(', ')}`);
}

// Quick LLM — uses reliable model chain
async function llmQuick(env, messages, maxTokens = 4096) {
  const errors = [];

  // 1. OpenRouter — try models fastest-first
  if (getOpenRouterKey(env)) {
    const orModels = [
      { model: 'meta-llama/llama-4-maverick', timeout: 30000 },
      { model: 'mistralai/mistral-small-3.1-24b-instruct', timeout: 20000 },
      { model: 'deepseek/deepseek-chat-v3-0324', timeout: 25000 },
    ];
    for (const { model, timeout } of orModels) {
      const result = await openrouterChat(env, messages, model, maxTokens, timeout);
      if (result) return result;
      errors.push(`OR:${model}:null`);
    }
  }

  // 2. Google Gemini — free tier, very fast
  if (getGeminiKey(env)) {
    const geminiModels = [
      { model: 'gemini-2.0-flash', timeout: 20000 },
      { model: 'gemini-1.5-flash', timeout: 20000 },
    ];
    for (const { model, timeout } of geminiModels) {
      const result = await geminiChat(env, messages, model, maxTokens, timeout);
      if (result) return result;
      errors.push(`Gemini:${model}:null`);
    }
  }

  // 3. Workers AI — fallback chain
  if (env.AI) {
    const workersAiModels = [
      '@cf/meta/llama-3.1-8b-instruct',
      '@cf/meta/llama-3.1-8b-instruct-fp8',
      '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      '@cf/qwen/qwen3-30b-a3b-fp8',
      '@cf/mistralai/mistral-small-3.1-24b-instruct',
    ];
    for (const m of workersAiModels) {
      const result = await workersAiChat(env, messages, m, Math.min(maxTokens, 4096));
      if (result) return result;
      errors.push(`WAI:${m}:null`);
    }
  }

  throw new Error(`All LLM providers failed. Tried: ${errors.join(', ')}`);
}

// Deep LLM — prioritizes high-output models (16K+ tokens = ~12K words)
async function llmDeep(env, messages, maxTokens = 16384) {
  const errors = [];

  // 1. OpenRouter — try models that work within credit limits
  //    Note: Gemini models are 403 region-blocked, Qwen/DeepSeek may exceed credit limits
  //    Maverick is the most credit-efficient model available
  if (getOpenRouterKey(env)) {
    const orModels = [
      { model: 'meta-llama/llama-4-maverick', timeout: 90000 },       // Most credit-efficient
      { model: 'deepseek/deepseek-chat-v3-0324', timeout: 90000 },    // Fallback
      { model: 'qwen/qwen3-235b-a22b', timeout: 90000 },              // Fallback
    ];
    // Cap maxTokens to what credits can afford (~6K output with large context)
    const effectiveMaxTokens = Math.min(maxTokens, 6000);
    for (const { model, timeout } of orModels) {
      const result = await openrouterChat(env, messages, model, effectiveMaxTokens, timeout);
      if (result) return result;
      errors.push(`OR:${model}:null`);
    }
  }

  // 2. Google Gemini direct — free tier (lower output limits but still good)
  if (getGeminiKey(env)) {
    const geminiModels = [
      { model: 'gemini-2.5-flash', timeout: 90000 },
      { model: 'gemini-2.0-flash', timeout: 60000 },
      { model: 'gemini-1.5-flash', timeout: 60000 },
    ];
    for (const { model, timeout } of geminiModels) {
      const result = await geminiChat(env, messages, model, maxTokens, timeout);
      if (result) return result;
      errors.push(`Gemini:${model}:null`);
    }
  }

  // 3. Workers AI — fallback chain (limited to 4K output)
  if (env.AI) {
    const workersAiModels = [
      '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      '@cf/qwen/qwen3-30b-a3b-fp8',
      '@cf/mistralai/mistral-small-3.1-24b-instruct',
      '@cf/meta/llama-3.1-8b-instruct-fp8',
    ];
    for (const m of workersAiModels) {
      const result = await workersAiChat(env, messages, m, Math.min(maxTokens, 4096));
      if (result) return result;
      errors.push(`WAI:${m}:null`);
    }
  }

  throw new Error(`All LLM providers failed. Tried: ${errors.join(', ')}`);
}

// Gap analysis LLM — very fast, minimal output
async function llmGapAnalysis(env, messages) {
  // 1. Gemini Flash (fastest)
  if (getGeminiKey(env)) {
    const result = await geminiChat(env, messages, 'gemini-2.0-flash', 512, 10000);
    if (result) return result;
  }

  // 2. OpenRouter
  if (getOpenRouterKey(env)) {
    const result = await openrouterChat(env, messages, 'mistralai/mistral-small-3.1-24b-instruct', 512, 15000);
    if (result) return result;
  }

  // 3. Workers AI — always use 8b for gap analysis (speed > quality)
  const result = await workersAiChat(env, messages, '@cf/meta/llama-3.1-8b-instruct-fp8', 512);
  if (result) return result;

  throw new Error('All LLM providers failed for gap analysis');
}

// ══════════════════════════════════════════════════════════════════
// PROMPTS — Streamlined for speed without sacrificing quality
// ══════════════════════════════════════════════════════════════════

const QUICK_SYSTEM_PROMPT = `You are KIVORA RESEARCH, an elite research synthesis engine. Produce comprehensive, evidence-backed reports.

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

## Sources
Numbered list with URLs.

FOLLOWUPS:
1. Question one?
2. Question two?
3. Question three?`;

const DEEP_SYSTEM_PROMPT = `You are KIVORA RESEARCH DEEP, a world-class research analyst. Produce COMPREHENSIVE, publication-quality reports of 10,000+ words. Your reports must be exhaustive, data-rich, and equivalent to a professional consulting engagement.

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
- Discuss regional/geographic variations
- Examine short-term vs long-term implications
- Evaluate different theoretical frameworks or perspectives
- Include specific case studies and real-world examples

## Comparative Analysis
AT LEAST 3 detailed comparison tables (6+ rows each):
- Table 1: Feature/capability comparison across options/approaches
- Table 2: Market/industry comparison with metrics
- Table 3: Timeline/adoption comparison
Each table must be followed by 3-4 paragraphs of analysis explaining the comparisons.

## Active Debates & Conflicting Evidence
TABLE with 5+ rows:
| Debate | Position A | Position B | Evidence A | Evidence B | Current Consensus | Resolution Path |
Then 2-3 paragraphs per debate, analyzing the evidence on each side.

## Statistical Data & Metrics
TABLE compiling key statistics, benchmarks, and KPIs with sources. Then 4-6 paragraphs analyzing trends in the data.

## Risk & Opportunity Assessment
TABLE with 8+ rows (4 risks + 4 opportunities):
| Category | Item | Probability | Impact | Evidence | Mitigation/Leverage |
Then 5-6 paragraphs of detailed risk analysis and opportunity framing.

## Practical Recommendations
7-10 actionable recommendations, each with:
- Specific action steps
- Expected outcome and timeline
- Required resources
- Evidence justification
- Potential obstacles

## Future Outlook
6-8 paragraphs covering:
- Near-term developments (1-2 years)
- Medium-term trajectories (3-5 years)
- Long-term scenarios (5-10 years)
- Key signals to watch
- Potential disruptions
- Scenario analysis (optimistic, moderate, pessimistic)

## Confidence Assessment
Overall confidence + by section. Key uncertainties. What further research would improve confidence. Methodology notes.

## Sources
Numbered list with full URLs.

FOLLOWUPS:
1-5. Specific, actionable follow-up research questions?`;

const GAP_ANALYSIS_PROMPT = `Identify 2 knowledge gaps in these sources for the given query. Return ONLY a JSON array:
[{"gap": "description", "search_query": "specific search query"}]`;

// ══════════════════════════════════════════════════════════════════
// MARKDOWN → HTML CONVERTER
// ══════════════════════════════════════════════════════════════════

function markdownToHtml(md) {
  if (!md) return '';
  const lines = md.split('\n');
  let html = '';
  let inTable = false;
  let tableRows = [];
  let inList = false;
  let listType = '';
  let listItems = [];

  function flushList() {
    if (listItems.length > 0) {
      const tag = listType === 'ol' ? 'ol' : 'ul';
      html += `<${tag} class="ml-4 mb-3 ${listType === 'ol' ? 'list-decimal' : 'list-disc'}">`;
      for (const item of listItems) {
        html += `<li class="text-sm text-[#a0a0a0] leading-relaxed mb-1">${renderInline(item)}</li>`;
      }
      html += `</${tag}>`;
    }
    listItems = [];
    inList = false;
    listType = '';
  }

  function flushTable() {
    if (tableRows.length === 0) return;
    html += '<div class="my-3"><table class="w-full border-collapse" style="font-size:11px;table-layout:fixed;width:100%">';
    for (let i = 0; i < tableRows.length; i++) {
      const cells = tableRows[i];
      const tag = i === 0 ? 'th' : 'td';
      const bgClass = i === 0 ? 'bg-[#1a1a1a] text-white font-semibold' : (i % 2 === 0 ? 'bg-[#0f0f0f]' : '');
      html += '<tr>';
      for (const cell of cells) {
        const width = `${Math.floor(100 / cells.length)}%`;
        const extra = i === 0
          ? 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis'
          : 'word-break:break-word;overflow-wrap:break-word';
        html += `<${tag} class="border border-[#262626] ${bgClass}" style="width:${width};padding:0.25rem 0.5rem;font-size:${i === 0 ? '9px' : '11px'};${extra}">${renderInline(cell.trim())}</${tag}>`;
      }
      html += '</tr>';
    }
    html += '</table></div>';
    tableRows = [];
    inTable = false;
  }

  function renderInline(str) {
    if (!str) return '';
    return str
      .replace(/\*\*(.+?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
      .replace(/__(.+?)__/g, '<strong class="text-white font-semibold">$1</strong>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-red-400 hover:text-red-300 underline underline-offset-2">$1</a>')
      .replace(/\[(\d+)\]/g, '<sup class="text-red-400 font-mono text-[10px]">[$1]</sup>');
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      flushList();
      if (/^\|[\s\-:]+\|/.test(line.trim())) continue;
      const cells = line.split('|').slice(1, -1);
      tableRows.push(cells);
      inTable = true;
      continue;
    } else if (inTable) {
      flushTable();
    }

    if (line.startsWith('### ')) { flushList(); html += `<h3 class="text-base font-semibold text-white mt-5 mb-2">${renderInline(line.slice(4))}</h3>`; continue; }
    if (line.startsWith('## ')) { flushList(); html += `<h2 class="text-lg font-semibold text-white mt-6 mb-2.5">${renderInline(line.slice(3))}</h2>`; continue; }
    if (line.startsWith('# ')) { flushList(); html += `<h1 class="text-xl font-bold text-white mt-4 mb-3">${renderInline(line.slice(2))}</h1>`; continue; }

    if (/^---+$/.test(line.trim())) { flushList(); html += '<hr class="border-[#1a1a1a] my-4" />'; continue; }

    if (/^[-*]\s/.test(line)) {
      if (inList && listType !== 'ul') flushList();
      inList = true; listType = 'ul';
      listItems.push(line.replace(/^[-*]\s/, ''));
      continue;
    }
    if (/^\d+\.\s/.test(line)) {
      if (inList && listType !== 'ol') flushList();
      inList = true; listType = 'ol';
      listItems.push(line.replace(/^\d+\.\s/, ''));
      continue;
    }
    if (!line.trim()) { flushList(); continue; }

    flushList();
    html += `<p class="text-sm text-[#a0a0a0] leading-relaxed mb-3">${renderInline(line)}</p>`;
  }

  flushList();
  flushTable();
  return html;
}

// ══════════════════════════════════════════════════════════════════
// EXTRACT FOLLOWUPS
// ══════════════════════════════════════════════════════════════════

function extractFollowups(text) {
  if (!text) return { report: '', followups: [] };

  // Try "FOLLOWUPS:" section first
  const match = text.match(/FOLLOWUPS:\s*\n([\s\S]*?)$/i);
  if (match) {
    const followups = match[1]
      .split('\n')
      .map(line => line.replace(/^\d+\.\s*/, '').trim())
      .filter(q => q.length > 0 && q.endsWith('?'));
    const report = text.replace(/FOLLOWUPS:\s*\n[\s\S]*$/i, '').trim();
    return { report, followups };
  }

  // Fallback: look for any "Follow-up" or "Follow up" heading with question lines after it
  const followupHeading = text.match(/^#{0,3}\s*(?:Follow[- ]?[Uu]p\s*[Qq]uestions?|Related\s*[Qq]uestions?)\s*$/m);
  if (followupHeading) {
    const afterHeading = text.slice(followupHeading.index + followupHeading[0].length);
    const questions = afterHeading
      .split('\n')
      .map(line => line.replace(/^[-*]\s*/, '').replace(/^\d+\.\s*/, '').trim())
      .filter(q => q.length > 0 && q.endsWith('?'));
    if (questions.length > 0) {
      const report = text.slice(0, followupHeading.index).trim();
      return { report, followups: questions };
    }
  }

  // Final fallback: scan last 20 lines for any numbered/bulleted questions
  const lines = text.split('\n');
  const tail = lines.slice(-20);
  const questions = [];
  for (const line of tail) {
    const cleaned = line.replace(/^[-*]\s*/, '').replace(/^\d+\.\s*/, '').trim();
    if (cleaned.length > 10 && cleaned.endsWith('?')) {
      questions.push(cleaned);
    }
  }
  if (questions.length > 0) {
    // Remove those question lines from the report
    let report = text;
    for (const q of questions) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      report = report.replace(new RegExp(`^.*${escaped}.*$`, 'm'), '');
    }
    return { report: report.trim(), followups: questions };
  }

  return { report: text, followups: [] };
}

// ══════════════════════════════════════════════════════════════════
// MAIN RESEARCH PIPELINE — SPEED OPTIMIZED
// ══════════════════════════════════════════════════════════════════

async function quickResearch(query, env, apexModel = 'apex-free') {
  const t0 = Date.now();
  
  // Step 1: Fast search (2 providers, ~2s)
  console.log('[Quick] Searching...');
  const searchResults = await searchQuick(query, env, 10);

  if (searchResults.length === 0) {
    return { error: 'No sources found. Please try a different query.' };
  }

  console.log(`[Quick] Found ${searchResults.length} sources in ${Date.now() - t0}ms`);

  // Step 2: Format sources for the LLM
  const sourcesContext = searchResults.map((s, i) =>
    `[${i + 1}] ${s.title}\n${s.snippet}`
  ).join('\n\n');

  // Step 3: Generate report with Apex model routing
  console.log('[Quick] Generating report...');
  const userContent = `Research query: "${query}"\n\nSources:\n${sourcesContext}`;

  let rawReport;
  if (apexModel === 'apex-premium') {
    rawReport = await llmApexPremium(env, [
      { role: 'system', content: QUICK_SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ], 4096);
  } else {
    rawReport = await llmApexFree(env, [
      { role: 'system', content: QUICK_SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ], 4096);
  }

  console.log(`[Quick] Report generated in ${Date.now() - t0}ms`);

  // Step 4: Process report
  const { report, followups } = extractFollowups(rawReport);
  const content = markdownToHtml(report);

  const titleMatch = report.match(/^##\s+(.+)$/m) || report.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].replace(/[*_]/g, '') : query;

  const sources = searchResults.map((s, i) => ({
    id: i,
    url: s.url,
    title: s.title || `Source ${i + 1}`,
    snippet: s.snippet?.slice(0, 200) || '',
    favicon: '',
    status: 'loaded',
  }));

  return { sources, report, content, title, followups, mode: 'quick' };
}

async function deepResearch(query, env, apexModel = 'apex-free') {
  const t0 = Date.now();

  // ── PHASE 1: Search (3 providers, ~2.5s) ──
  console.log('[Deep] Phase 1: Searching...');
  const searchResults = await searchDeep(query, env, 15);

  if (searchResults.length === 0) {
    return { error: 'No sources found. Please try a different query.' };
  }

  // ── PHASE 2: Deep read top 5 URLs (more content = richer report) ──
  console.log('[Deep] Phase 2: Reading sources...');

  const topUrls = searchResults
    .filter(s => s.url && s.url.startsWith('http'))
    .slice(0, 5)
    .map(s => s.url);

  const [deepContents] = await Promise.all([
    readUrlsParallel(topUrls, 5),
  ]);

  console.log(`[Deep] Phase 2 done in ${Date.now() - t0}ms, read ${deepContents.length} URLs`);

  // Mark deep-read sources
  const sources = searchResults.map((s, i) => ({
    id: i,
    url: s.url,
    title: s.title || `Source ${i + 1}`,
    snippet: s.snippet?.slice(0, 200) || '',
    favicon: '',
    status: deepContents.some(dc => dc.url === s.url) ? 'deep' : 'loaded',
  }));

  // ── PHASE 3: Multi-section report generation ──
  // 2 parallel LLM calls with Apex model routing
  console.log('[Deep] Phase 3: Generating multi-section report...');

  const allSourcesContext = sources.map((s, i) =>
    `[${i + 1}] ${s.title}\nURL: ${s.url}\n${s.snippet}`
  ).join('\n\n');

  const deepContent = deepContents.map(dc =>
    `--- FULL CONTENT FROM ${dc.url} ---\n${dc.content.slice(0, 6000)}`
  ).join('\n\n');

  const contextBlock = `Research query: "${query}"\n\nSOURCES:\n${allSourcesContext}\n\nDEEP CONTENT:\n${deepContent}`;

  const llmFn = apexModel === 'apex-premium' ? llmApexPremium : llmApexFree;
  const effectiveMaxTokens = apexModel === 'apex-premium' ? 8192 : 6000;

  // Section prompts — 2 parallel LLM calls for credit efficiency
  const sections = [
    {
      name: 'part1',
      prompt: `You are KIVORA RESEARCH DEEP. Write the FIRST HALF of a comprehensive research report including Executive Summary, Key Findings, Foundational Context, and Detailed Analysis. Write as MUCH as possible — aim for 3000+ words. Be exhaustive and detailed.

RULES: Cite every claim with [N] matching source numbers. Use confidence language: "Established", "Likely", "Possible", "Uncertain". No filler. Write LONG paragraphs (5-8 sentences each). Include specific data, numbers, and examples.

## Executive Summary
8-12 detailed sentences. What was found, why it matters, key numbers, critical implications. Include overall confidence rating.

## Key Findings
LARGE TABLE with 8-12 rows (REQUIRED):
| # | Finding | Evidence | Confidence | Sources | Impact | Timeline |
|---|---------|----------|------------|---------|--------|----------|
Then 5-8 paragraphs of detailed cross-source analysis.

## Foundational Context
Write 8-12 detailed paragraphs covering:
- Historical evolution and key milestones
- Current state with data and numbers
- Key stakeholders and organizations
- Market size, growth rates, economic data
- Regulatory landscape
- Technological infrastructure

## Detailed Analysis
Write 10-15 paragraphs organized by themes. Each theme gets 2-3 paragraphs of in-depth analysis with examples and citations.

## Comparative Analysis
AT LEAST 2 comparison tables (5+ rows each). Each table followed by 3-4 paragraphs of analysis.`,
    },
    {
      name: 'part2',
      prompt: `You are KIVORA RESEARCH DEEP. Write the SECOND HALF of a comprehensive research report including Risk Assessment, Recommendations, Future Outlook, and Confidence Assessment. Write as MUCH as possible — aim for 2000+ words.

RULES: Cite every claim with [N] matching source numbers. No filler. Write LONG paragraphs (5-8 sentences). Include tables.

## Active Debates & Conflicting Evidence
TABLE with 4+ rows:
| Debate | Position A | Position B | Evidence A | Evidence B | Consensus |
Then 2-3 paragraphs per debate.

## Statistical Data & Metrics
TABLE with 6+ rows:
| Metric | Value | Source | Trend | Implication |
Then 4-6 paragraphs analyzing trends.

## Risk & Opportunity Assessment
TABLE with 6+ rows (3 risks + 3 opportunities):
| Category | Item | Probability | Impact | Evidence | Mitigation/Leverage |
Then 4-6 paragraphs of analysis.

## Practical Recommendations
Write 6-8 actionable recommendations, each with specific action steps, timeline, and evidence.

## Future Outlook
Write 6-8 paragraphs covering near-term (1-2 years), medium-term (3-5), and long-term (5-10) scenarios.

## Confidence Assessment
Overall confidence + by section. Key uncertainties. Methodology notes.

FOLLOWUPS:
1-5. Specific follow-up research questions?`,
    },
  ];

  // Generate both parts in parallel for speed
  const sectionPromises = sections.map(async (section) => {
    const sectionT0 = Date.now();
    const result = await llmFn(env, [
      { role: 'system', content: section.prompt },
      { role: 'user', content: contextBlock },
    ], effectiveMaxTokens);
    console.log(`[Deep] Section '${section.name}' done in ${Date.now() - sectionT0}ms, ${result?.length || 0} chars`);
    return { name: section.name, content: result || '' };
  });
  const sectionResults = await Promise.all(sectionPromises);

  // Combine all sections into one report
  const rawReport = sectionResults.map(s => s.content).join('\n\n');

  console.log(`[Deep] Complete in ${Date.now() - t0}ms, total report: ${rawReport.length} chars`);

  // Process report
  const { report, followups } = extractFollowups(rawReport);
  const content = markdownToHtml(report);

  const titleMatch = report.match(/^##\s+(.+)$/m) || report.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].replace(/[*_]/g, '') : query;

  return { sources, report, content, title, followups, mode: 'deep' };
}

// ══════════════════════════════════════════════════════════════════
// WORKER ENTRY POINT
// ══════════════════════════════════════════════════════════════════

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // Debug endpoint — shows key status (no key values exposed)
    if (url.pathname === '/debug') {
      return jsonRes({
        openrouter: getOpenRouterKey(env) ? `yes-${getOpenRouterKey(env).length}chars` : 'no',
        gemini: getGeminiKey(env) ? `yes-${getGeminiKey(env).length}chars` : 'no',
        workers_ai: !!env.AI,
        tavily: getTavilyKey(env) ? `yes-${getTavilyKey(env).length}chars` : 'no',
        firecrawl: getFirecrawlKey(env) ? `yes-${getFirecrawlKey(env).length}chars` : 'no',
        brave: getBraveKey(env) ? `yes-${getBraveKey(env).length}chars` : 'no',
        pollinations: 'available (free)',
      });
    }

    // Test AI endpoint — tests each LLM provider and returns detailed results
    if (url.pathname === '/test-ai') {
      const results = {};
      const testMessages = [{ role: 'user', content: 'Say hello in one word.' }];

      // Test OpenRouter
      if (getOpenRouterKey(env)) {
        try {
          const r = await openrouterChat(env, testMessages, 'meta-llama/llama-4-maverick', 50, 10000);
          results.openrouter = r ? `OK: ${r.slice(0, 100)}` : 'FAILED: returned null';
        } catch (e) {
          results.openrouter = `ERROR: ${e.message}`;
        }
      } else {
        results.openrouter = 'NO_KEY';
      }

      // Test Gemini
      if (getGeminiKey(env)) {
        try {
          const r = await geminiChat(env, testMessages, 'gemini-2.0-flash', 50, 10000);
          results.gemini = r ? `OK: ${r.slice(0, 100)}` : 'FAILED: returned null';
        } catch (e) {
          results.gemini = `ERROR: ${e.message}`;
        }
      } else {
        results.gemini = 'NO_KEY';
      }

      // Test Workers AI models — with raw response for debugging
      if (env.AI) {
        const waiModels = [
          '@cf/meta/llama-3.1-8b-instruct',
          '@cf/meta/llama-3.1-8b-instruct-fp8',
          '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
        ];
        results.workers_ai = {};
        for (const m of waiModels) {
          try {
            const rawResponse = await env.AI.run(m, {
              messages: testMessages,
              max_tokens: 50,
            });
            // Log the full raw response for debugging
            const rawStr = JSON.stringify(rawResponse);
            const extractedText = rawResponse?.response || rawResponse?.result?.response || null;
            results.workers_ai[m] = extractedText
              ? `OK: ${extractedText.slice(0, 100)}`
              : `FAILED: raw=${rawStr.slice(0, 300)}`;
          } catch (e) {
            results.workers_ai[m] = `ERROR: ${e.message}`;
          }
        }
      } else {
        results.workers_ai = 'NO_BINDING';
      }

      return jsonRes(results);
    }

    // Health check
    if (url.pathname === '/health') {
      return jsonRes({
        status: 'ok',
        service: 'kivora-research',
        version: '4.0.0',
        providers: {
          openrouter: !!getOpenRouterKey(env),
          gemini: !!getGeminiKey(env),
          workers_ai: !!env.AI,
          pollinations: true,
          tavily: !!getTavilyKey(env),
          brave: !!getBraveKey(env),
          firecrawl: !!getFirecrawlKey(env),
        },
      });
    }

    // Main research endpoint
    if (url.pathname === '/research' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { query, mode = 'quick', openrouter_key = '', apex_model = 'apex-free' } = body;

        if (!query || typeof query !== 'string') {
          return jsonRes({ error: 'Query is required' }, 400);
        }

        if (query.length > 2000) {
          return jsonRes({ error: 'Query too long (max 2000 characters)' }, 400);
        }

        // Allow OpenRouter key to be passed per-request from Kivora
        // Per-request key always takes priority over Worker secret
        if (openrouter_key) {
          env.OPENROUTER_API_KEY = openrouter_key;
        }

        console.log(`[Research] ${mode} mode: "${query}", OR key: ${getOpenRouterKey(env) ? `yes-${getOpenRouterKey(env).length}chars` : 'no'}, apex: ${apex_model}`);

        const result = mode === 'deep'
          ? await deepResearch(query, env, apex_model)
          : await quickResearch(query, env, apex_model);

        if (result.error) {
          return jsonRes(result, 500);
        }

        return jsonRes(result);
      } catch (err) {
        console.error('[Research] Error:', err);
        return jsonRes({ error: err.message || 'Research failed' }, 500);
      }
    }

    // 404
    return jsonRes({ error: 'Not found. Use POST /research with { query, mode }' }, 404);
  },
};
