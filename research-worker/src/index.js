// ══════════════════════════════════════════════════════════════════
// KIVORA RESEARCH WORKER — Cloudflare Worker (v5.1.0)
// Target: Quick ~8-12s, Deep ~25-45s (with 16K+ token output)
// Key optimizations:
//   - Quick mode: fast search (Tavily basic + Firecrawl), fast LLM (4K tokens)
//   - Deep mode: parallel URL reads, high-output LLM (16K tokens = ~12K words)
//   - Models: Gemini 2.5 Flash (65K output) via OpenRouter as primary for Deep
//   - Multiple LLM providers: OpenRouter → Workers AI → Gemini → Pollinations AI
//   - Apex model routing: apex-free (OpenRouter-first) and apex-premium (OpenRouter-first)
//   - Pollinations moved to last resort (429 errors, unreliable)
//   - Deprecated @cf/meta/llama-3.1-8b-instruct removed from all chains
//   - Query classification: academic/biomedical/tech/finance/general search routing
//   - Academic providers: Semantic Scholar, Crossref, PubMed (free, no API keys)
//   - Tech providers: GitHub repository search (free, rate-limited)
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
  return env.TAVILY_API_KEY || '';
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
  return env.FIRECRAWL_API_KEY || '';
}

// ── Source Tier Enforcement ──
const SOURCE_TIER_DOMAINS = {
  P1: [
    'arxiv.org', 'pubmed.ncbi.nlm.nih.gov', 'nature.com', 'science.org',
    'who.int', 'cdc.gov', 'nih.gov', 'fda.gov', 'sec.gov', 'doi.org',
    'dl.acm.org', 'ieeexplore.ieee.org', 'jmlr.org', 'aclanthology.org',
    'openreview.net', 'biorxiv.org', 'medrxiv.org', 'springer.com',
    'wiley.com', 'plos.org', 'nejm.org', 'lancet.com', 'cell.com',
    'pnas.org', 'bmj.com', 'eur-lex.europa.eu', 'gov.uk',
    'cambridge.org', 'oxfordacademic.com', 'chemrxiv.org',
    'sciencedirect.com', 'jstor.org', 'core.ac.uk',
  ],
  P2: [
    'reuters.com', 'bloomberg.com', 'economist.com', 'ft.com',
    'wsj.com', 'nytimes.com', 'bbc.com', 'apa.org', 'ieee.org',
    'acm.org', 'mit.edu', 'stanford.edu', 'harvard.edu',
    'semanticscholar.org', 'openalex.org', 'clinicaltrials.gov',
    'cochrane.org', 'ourworldindata.org', 'pewresearch.org',
    'nber.org', 'ssrn.com', 'hbr.org', 'mckinsey.com',
    'react.dev', 'vuejs.org', 'angular.io', 'nextjs.org',
    'typescriptlang.org', 'developer.mozilla.org', 'docs.python.org',
    'rust-lang.org', 'go.dev', 'kubernetes.io', 'docker.com',
    'aws.amazon.com', 'cloud.google.com', 'azure.microsoft.com',
  ],
  P3: [
    'medium.com', 'towardsdatascience.com', 'wikipedia.org',
    'wikidata.org', 'stackoverflow.com', 'github.com', 'reddit.com',
    'hackernews.com', 'youtube.com', 'substack.com', 'quora.com',
    'researchgate.net', 'academia.edu',
    'w3schools.com', 'geeksforgeeks.org', 'freecodecamp.org',
    'codepen.io', 'dev.to', 'hashnode.dev', 'hackernoon.com',
  ],
};

// Reverse lookup: domain → tier
const _DOMAIN_TIER_MAP = {};
for (const [tier, domains] of Object.entries(SOURCE_TIER_DOMAINS)) {
  for (const domain of domains) {
    _DOMAIN_TIER_MAP[domain] = tier;
  }
}

const TIER_LABELS = {
  P1: 'P1 — Academic',
  P2: 'P2 — Professional',
  P3: 'P3 — Community',
  UNV: 'UNV — Unverified',
};

/**
 * Classify a source URL into a tier (P1/P2/P3/UNV).
 * Checks exact domain match first, then walks up to parent domains.
 * @param {string} url  The source URL
 * @param {string} [currentTier]  Existing tier to keep if no match found
 * @returns {{ tier: string, tierLabel: string }}
 */
function enforceSourceTier(url, currentTier) {
  if (!url || typeof url !== 'string') {
    const tier = currentTier || 'UNV';
    return { tier, tierLabel: TIER_LABELS[tier] };
  }

  try {
    const hostname = new URL(url).hostname.toLowerCase();

    // 1. Exact match
    if (_DOMAIN_TIER_MAP[hostname]) {
      const tier = _DOMAIN_TIER_MAP[hostname];
      return { tier, tierLabel: TIER_LABELS[tier] };
    }

    // 2. Walk up parent domains (e.g. subdomain.nature.com → nature.com)
    const parts = hostname.split('.');
    for (let i = 1; i < parts.length - 1; i++) {
      const parent = parts.slice(i).join('.');
      if (_DOMAIN_TIER_MAP[parent]) {
        const tier = _DOMAIN_TIER_MAP[parent];
        return { tier, tierLabel: TIER_LABELS[tier] };
      }
    }
  } catch {
    // Invalid URL — fall through
  }

  const tier = currentTier || 'UNV';
  return { tier, tierLabel: TIER_LABELS[tier] };
}

// ══════════════════════════════════════════════════════════════════
// QUERY CLASSIFICATION
// ══════════════════════════════════════════════════════════════════

const CLASSIFICATION_PATTERNS = {
  academic: [
    'research', 'study', 'paper', 'journal', 'effect of', 'meta-analysis',
    'systematic review', 'RCT', 'clinical trial', 'hypothesis', 'methodology',
    'DOI', 'arxiv', 'peer-reviewed', 'publication', 'literature review',
    'empirical', 'qualitative', 'quantitative', 'longitudinal',
  ],
  biomedical: [
    'health', 'medical', 'disease', 'treatment', 'drug', 'therapy',
    'diagnosis', 'symptoms', 'patient', 'clinical', 'pharmaceutical',
    'vaccine', 'epidemiology', 'pathology', 'medicine', 'hospital',
    'surgery', 'prognosis', 'mortality', 'morbidity',
  ],
  tech: [
    'software', 'programming', 'framework', 'API', 'library', 'algorithm',
    'code', 'developer', 'deployment', 'infrastructure', 'cloud',
    'AI model', 'machine learning', 'open source', 'repository',
    'devops', 'kubernetes', 'docker', 'serverless',
  ],
  finance: [
    'stock', 'market', 'investment', 'revenue', 'profit', 'GDP',
    'economy', 'financial', 'crypto', 'bitcoin', 'trading', 'portfolio',
    'hedge fund', 'equity', 'dividend', 'fiscal', 'monetary',
    'inflation', 'bond', 'commodity',
  ],
};

function classifyQuery(query) {
  const lower = query.toLowerCase();
  const scores = {};

  for (const [category, terms] of Object.entries(CLASSIFICATION_PATTERNS)) {
    let score = 0;
    for (const term of terms) {
      // Use word boundary matching for short terms, substring for phrases
      if (term.includes(' ')) {
        // Multi-word: simple substring match
        if (lower.includes(term.toLowerCase())) score += 2;
      } else {
        // Single word: word boundary match to avoid false positives
        const regex = new RegExp(`\\b${term.toLowerCase()}\\b`, 'i');
        if (regex.test(lower)) score += 1;
      }
    }
    scores[category] = score;
  }

  // Find the highest scoring category
  let bestCategory = 'general';
  let bestScore = 0;
  for (const [category, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      bestCategory = category;
    }
  }

  // Need at least 1 match to override 'general'
  if (bestScore === 0) return 'general';

  // Biomedical wins over academic if both match (biomedical is more specific)
  if (bestCategory === 'academic' && scores.biomedical >= bestScore) {
    return 'biomedical';
  }

  return bestCategory;
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
    return (data.web?.results || []).map(r => {
      const { tier, tierLabel } = enforceSourceTier(r.url);
      return {
        title: r.title || '',
        url: r.url || '',
        snippet: r.description || '',
        score: 0,
        tier,
        tierLabel,
      };
    });
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

// ── Academic Search Providers ──

// Semantic Scholar — free academic search API
async function searchSemanticScholar(query, limit = 5) {
  try {
    const res = await fetch(
      `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=title,url,abstract,year,citationCount,authors,externalIds`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.data || []).map(p => ({
      title: p.title || '',
      url: p.url || `https://semanticscholar.org/paper/${p.paperId}`,
      snippet: p.abstract || '',
      score: p.citationCount || 0,
      source: 'semantic-scholar',
      authors: (p.authors || []).map(a => a.name || ''),
      year: p.year || null,
      citations: p.citationCount || 0,
      doi: p.externalIds?.DOI || '',
    }));
  } catch {
    return [];
  }
}

// Crossref — free scholarly metadata API (no API key needed)
async function searchCrossref(query, rows = 5) {
  try {
    const res = await fetch(
      `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=${rows}`,
      { signal: AbortSignal.timeout(8000) },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.message?.items || []).map(item => ({
      title: (item.title || [])[0] || '',
      url: item.URL || (item.doi ? `https://doi.org/${item.doi}` : ''),
      snippet: (item.abstract || '').replace(/<[^>]*>/g, '').slice(0, 500),
      score: item['is-referenced-by-count'] || 0,
      source: 'crossref',
      authors: (item.author || []).map(a => `${a.given || ''} ${a.family || ''}`.trim()),
      year: item.published?.['date-parts']?.[0]?.[0] || item.created?.['date-parts']?.[0]?.[0] || null,
      citations: item['is-referenced-by-count'] || 0,
      doi: item.doi || '',
    }));
  } catch {
    return [];
  }
}

// PubMed — via NCBI E-utilities (free, no API key required for basic use)
async function searchPubMed(query, retmax = 5) {
  try {
    // Step 1: Search for PMIDs
    const searchRes = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(query)}&retmax=${retmax}&retmode=json`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (!searchRes.ok) return [];
    const searchData = await searchRes.json();
    const ids = searchData.esearchresult?.idlist || [];
    if (ids.length === 0) return [];

    // Step 2: Get summaries for those PMIDs
    const summaryRes = await fetch(
      `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(',')}&retmode=json`,
      { signal: AbortSignal.timeout(6000) },
    );
    if (!summaryRes.ok) return [];
    const summaryData = await summaryRes.json();
    const result = summaryData.result || {};

    return ids.map(id => {
      const item = result[id] || {};
      return {
        title: item.title || '',
        url: id ? `https://pubmed.ncbi.nlm.nih.gov/${id}/` : '',
        snippet: (item.abstract || '').slice(0, 500),
        score: 0,
        source: 'pubmed',
        authors: (item.authors || []).map(a => a.name || ''),
        year: item.pubdate ? parseInt(item.pubdate, 10) || null : null,
        citations: 0,
        doi: item.elocationid || '',
      };
    });
  } catch {
    return [];
  }
}

// GitHub — search repositories (free, unauthenticated rate limit: 10 req/min)
async function searchGitHub(query, perPage = 5) {
  try {
    const res = await fetch(
      `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&per_page=${perPage}&sort=stars`,
      {
        headers: { 'Accept': 'application/vnd.github.v3+json' },
        signal: AbortSignal.timeout(6000),
      },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.items || []).map(repo => ({
      title: repo.full_name || repo.name || '',
      url: repo.html_url || '',
      snippet: repo.description || '',
      score: repo.stargazers_count || 0,
      source: 'github',
      authors: [repo.owner?.login || ''],
      year: repo.created_at ? new Date(repo.created_at).getFullYear() : null,
      citations: repo.stargazers_count || 0,
      doi: '',
    }));
  } catch {
    return [];
  }
}

// ── Fast search for quick mode (2 providers + classified extras, ~2-3s total) ──
async function searchQuick(query, env, maxSources = 10, classification = 'general') {
  // Base providers always run
  const basePromises = [
    searchTavily(query, env, 8, 'basic'),  // ~1.4s
    searchFirecrawl(query, env, 6),         // ~1.7s
  ];

  // Add classified search providers
  if (classification === 'academic' || classification === 'biomedical') {
    basePromises.push(searchSemanticScholar(query, 5));
    basePromises.push(searchCrossref(query, 5));
    if (classification === 'biomedical') {
      basePromises.push(searchPubMed(query, 5));
    }
  } else if (classification === 'tech') {
    basePromises.push(searchGitHub(query, 5));
  }

  const results = await Promise.all(basePromises);

  // Merge all results — base providers first, then classified extras
  const allArrays = [results[0], results[1]];
  for (let i = 2; i < results.length; i++) {
    allArrays.push(results[i]);
  }

  const seen = new Set();
  const all = [];
  for (const r of allArrays.flat()) {
    const key = r.url.toLowerCase().replace(/\/+$/, '');
    if (key && !seen.has(key)) {
      seen.add(key);
      // Apply tier enforcement if not already classified
      if (!r.tier) {
        const { tier, tierLabel } = enforceSourceTier(r.url);
        r.tier = tier;
        r.tierLabel = tierLabel;
      }
      all.push(r);
    }
  }
  return all.slice(0, maxSources);
}

// ── Full search for deep mode (3+ providers + classified extras, ~2.5-4s total) ──
async function searchDeep(query, env, maxSources = 15, classification = 'general') {
  // Base providers always run
  const basePromises = [
    searchTavily(query, env, 10, 'advanced'), // ~2.2s
    searchBrave(query, env, 8),                // ~skip if no key
    searchFirecrawl(query, env, 8),            // ~1.7s
  ];

  // Add classified search providers
  if (classification === 'academic' || classification === 'biomedical') {
    basePromises.push(searchSemanticScholar(query, 5));
    basePromises.push(searchCrossref(query, 5));
    if (classification === 'biomedical') {
      basePromises.push(searchPubMed(query, 5));
    }
  } else if (classification === 'tech') {
    basePromises.push(searchGitHub(query, 5));
  }

  const results = await Promise.all(basePromises);

  // Merge all results — base providers first, then classified extras
  const allArrays = [results[0], results[1], results[2]];
  for (let i = 3; i < results.length; i++) {
    allArrays.push(results[i]);
  }

  const seen = new Set();
  const all = [];
  for (const r of allArrays.flat()) {
    const key = r.url.toLowerCase().replace(/\/+$/, '');
    if (key && !seen.has(key)) {
      seen.add(key);
      // Apply tier enforcement if not already classified
      if (!r.tier) {
        const { tier, tierLabel } = enforceSourceTier(r.url);
        r.tier = tier;
        r.tierLabel = tierLabel;
      }
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
async function pollinationsChat(messages, model = 'openai', maxTokens = 4096, timeout = 8000) {
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

// ── Output Quality Validation ──
// Checks if LLM output is usable. Returns true if good, false if bad (triggers next provider).
function validateOutput(text, mode = 'quick') {
  if (!text || typeof text !== 'string') return false;

  // Absolute minimum — anything less is clearly broken
  const minLen = mode === 'deep' ? 500 : 200;
  if (text.length < minLen) {
    console.log(`[Validate] FAIL: too short (${text.length} < ${minLen})`);
    return false;
  }

  // Must contain at least some real words (not just symbols/repeat chars)
  const wordCount = text.split(/\s+/).filter(w => w.length > 1).length;
  if (wordCount < 50) {
    console.log(`[Validate] FAIL: too few words (${wordCount})`);
    return false;
  }

  // Should have at least one heading-like structure (## or ** or line with caps)
  const hasStructure = /^#{1,3}\s/m.test(text) || /\*\*.+\*\*/m.test(text);
  if (!hasStructure && mode === 'deep') {
    console.log('[Validate] FAIL: no heading structure for deep mode');
    return false;
  }

  // Should not be truncated mid-sentence (ends without punctuation)
  const trimmed = text.trimEnd();
  const endsWithPunctuation = /[.!?]$/m.test(trimmed) || trimmed.endsWith('---') || trimmed.endsWith('```');
  if (!endsWithPunctuation && text.length > 1000) {
    // Likely truncated — still usable but log it
    console.log('[Validate] WARN: output may be truncated (no ending punctuation)');
  }

  console.log(`[Validate] PASS: ${text.length} chars, ${wordCount} words`);
  return true;
}

// Apex 1.7 — Free tier model routing (OpenRouter → Workers AI → Gemini → Pollinations)
async function llmApexFree(env, messages, maxTokens = 4096, mode = 'quick') {
  const errors = [];

  // 1. OpenRouter — fastest when credits available
  if (getOpenRouterKey(env)) {
    const orModels = [
      { model: 'mistralai/mistral-small-3.1-24b-instruct', timeout: 15000, maxTokens: Math.min(maxTokens, 3000) },
      { model: 'meta-llama/llama-4-maverick', timeout: 15000, maxTokens: Math.min(maxTokens, 2000) },
    ];
    for (const { model, timeout, maxTokens: mt } of orModels) {
      const result = await openrouterChat(env, messages, model, mt, timeout);
      if (result && validateOutput(result, mode)) return result;
      if (result) errors.push(`OR:${model}:bad-output`);
      else errors.push(`OR:${model}:null`);
    }
  }

  // 2. Workers AI — free, built-in (skip deprecated models)
  if (env.AI) {
    const workersAiModels = [
      '@cf/meta/llama-3.1-8b-instruct-fp8',
      '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
      '@cf/qwen/qwen3-30b-a3b-fp8',
      '@cf/mistralai/mistral-small-3.1-24b-instruct',
    ];
    for (const m of workersAiModels) {
      const result = await workersAiChat(env, messages, m, Math.min(maxTokens, 4096));
      if (result && validateOutput(result, mode)) return result;
      if (result) errors.push(`WAI:${m}:bad-output`);
      else errors.push(`WAI:${m}:null`);
    }
  }

  // 3. Google Gemini — free tier
  if (getGeminiKey(env)) {
    const geminiModels = [
      { model: 'gemini-2.0-flash', timeout: 15000 },
      { model: 'gemini-1.5-flash', timeout: 15000 },
    ];
    for (const { model, timeout } of geminiModels) {
      const result = await geminiChat(env, messages, model, maxTokens, timeout);
      if (result && validateOutput(result, mode)) return result;
      if (result) errors.push(`Gemini:${model}:bad-output`);
      else errors.push(`Gemini:${model}:null`);
    }
  }

  // 4. Pollinations AI — last resort (free but unreliable, 429 errors common)
  const pollModels = ['openai', 'mistral'];
  for (const model of pollModels) {
    const result = await pollinationsChat(messages, model, maxTokens, 8000);
    if (result && validateOutput(result, mode)) return result;
    if (result) errors.push(`Poll:${model}:bad-output`);
    else errors.push(`Poll:${model}:null`);
  }

  throw new Error(`All LLM providers failed (Apex 1.7 Free). Tried: ${errors.join(', ')}`);
}

// Apex 2.3 — Premium tier model routing (OpenRouter → Gemini → Workers AI → Pollinations)
async function llmApexPremium(env, messages, maxTokens = 4096, mode = 'quick') {
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
      if (result && validateOutput(result, mode)) return result;
      if (result) errors.push(`OR:${model}:bad-output`);
      else errors.push(`OR:${model}:null`);
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
      if (result && validateOutput(result, mode)) return result;
      if (result) errors.push(`Gemini:${model}:bad-output`);
      else errors.push(`Gemini:${model}:null`);
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
      if (result && validateOutput(result, mode)) return result;
      if (result) errors.push(`WAI:${m}:bad-output`);
      else errors.push(`WAI:${m}:null`);
    }
  }

  // 4. Pollinations — free fallback
  const pollModels = ['openai', 'mistral'];
  for (const model of pollModels) {
    const result = await pollinationsChat(messages, model, maxTokens, 30000);
    if (result && validateOutput(result, mode)) return result;
    if (result) errors.push(`Poll:${model}:bad-output`);
    else errors.push(`Poll:${model}:null`);
  }

  throw new Error(`All LLM providers failed (Apex 2.3 Premium). Tried: ${errors.join(', ')}`);
}

// Quick LLM — uses reliable model chain (credit-aware)
async function llmQuick(env, messages, maxTokens = 4096) {
  const errors = [];

  // 1. Workers AI — free, fast, no credit limit
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

  // 2. OpenRouter — credit-limited, use reduced token counts
  if (getOpenRouterKey(env)) {
    const orModels = [
      { model: 'mistralai/mistral-small-3.1-24b-instruct', timeout: 15000, mt: Math.min(maxTokens, 3000) },
      { model: 'meta-llama/llama-4-maverick', timeout: 15000, mt: Math.min(maxTokens, 2000) },
    ];
    for (const { model, timeout, mt } of orModels) {
      const result = await openrouterChat(env, messages, model, mt, timeout);
      if (result) return result;
      errors.push(`OR:${model}:null`);
    }
  }

  // 3. Google Gemini — free tier, very fast
  if (getGeminiKey(env)) {
    const geminiModels = [
      { model: 'gemini-2.0-flash', timeout: 15000 },
      { model: 'gemini-1.5-flash', timeout: 15000 },
    ];
    for (const { model, timeout } of geminiModels) {
      const result = await geminiChat(env, messages, model, maxTokens, timeout);
      if (result) return result;
      errors.push(`Gemini:${model}:null`);
    }
  }

  throw new Error(`All LLM providers failed. Tried: ${errors.join(', ')}`);
}

// Deep LLM — prioritizes high-output models (credit-aware)
async function llmDeep(env, messages, maxTokens = 16384) {
  const errors = [];

  // 1. Workers AI — free, no credit limit (limited to 4K output but reliable)
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

  // 2. OpenRouter — credit-limited, cap tokens to what's affordable
  if (getOpenRouterKey(env)) {
    const effectiveMaxTokens = Math.min(maxTokens, 2000);
    const orModels = [
      { model: 'mistralai/mistral-small-3.1-24b-instruct', timeout: 30000 },
      { model: 'meta-llama/llama-4-maverick', timeout: 30000 },
    ];
    for (const { model, timeout } of orModels) {
      const result = await openrouterChat(env, messages, model, effectiveMaxTokens, timeout);
      if (result) return result;
      errors.push(`OR:${model}:null`);
    }
  }

  // 3. Google Gemini direct — free tier (lower output limits but still good)
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

  // 3. Workers AI — always use fp8 for gap analysis (speed > quality, deprecated model skipped)
  const result = await workersAiChat(env, messages, '@cf/meta/llama-3.1-8b-instruct-fp8', 512);
  if (result) return result;

  throw new Error('All LLM providers failed for gap analysis');
}

// ══════════════════════════════════════════════════════════════════
// PROMPTS — Streamlined for speed without sacrificing quality
// ══════════════════════════════════════════════════════════════════

const QUICK_SYSTEM_PROMPT = `You are KIVORA RESEARCH, an elite research synthesis engine. Produce focused, evidence-backed reports.

OUTPUT BUDGET: ~600-1,000 words. Truncation is the worst failure mode — finish cleanly.

RULES:
1. Cite every claim with [N] notation matching source numbers. Only cite a source you actually read.
2. Confidence language: "established" (2+ sources), "likely" (one source + reasoning), "uncertain" (speculative).
3. Reserve **bold** for genuinely critical terms (max 1-2 per paragraph). Do NOT bold entire sentences.
4. Do NOT invent statistics. If a number isn't in the sources, omit or phrase qualitatively.
5. No filler like "Based on the search results" — start with the finding.
6. Third person, neutral analytical tone.
7. Use ONE markdown table only if comparison data genuinely helps.

FORMATTING (CRITICAL for readability — models often ignore this, so follow exactly):
- Put a ---  horizontal rule between every major section. This creates visual breathing room.
- Use bullet points with **bold lead-in** for findings:  - **Finding** — short explanation [N]
- For ranked items, use numbered list with bold + em-dash + descriptor:  1. **Item** — Best for X
- For sub-points, use  - **Label**: value  (e.g.  - **Mechanism**: ...,  - **Evidence**: ...,  - **Limitation**: ...)
- Keep paragraphs SHORT: 2-4 sentences max. Split dense paragraphs.
- One blank line between paragraphs and around --- dividers.

STRUCTURE (use these exact headings, with --- between each):

## Executive Summary
2-3 sentences. The finding, why it matters.

---

## Key Findings
- **Finding 1** — short description [N]
- **Finding 2** — short description [N]
- **Finding 3** — short description [N]
- **Finding 4** — short description [N]

Then 1-2 short paragraphs of analysis — what sources agree on, where they diverge.

---

## Detailed Analysis
2-3 short paragraphs of deep analysis. Cite sources. Cover themes, contradictions, context.

---

## Comparison Table
One table comparing 2-4 relevant options/frameworks/approaches (whatever the topic implies). 4-6 rows. Follow with 1-2 short paragraphs of analysis.

---

## Practical Implications
1-2 short paragraphs. Who should care, what to do, what to watch for.

---

## Confidence Assessment
Overall: High / Moderate / Low. Biggest uncertainty: ...

Do NOT include a Sources section — the sources list is shown separately in the UI. Keep [N] citations inline only.

FOLLOWUPS:
1. Specific, answerable follow-up question?
2. Specific, answerable follow-up question?
3. Specific, answerable follow-up question?`;

const DEEP_SYSTEM_PROMPT = `You are KIVORA RESEARCH DEEP, a world-class research analyst. Produce thorough, publication-quality reports.

OUTPUT BUDGET: ~2,500-3,500 words. You have a hard token limit. DO NOT aim for 10,000 words — finish every section cleanly. Truncation is the worst failure mode.

CRITICAL RULES:
1. LENGTH: Stay within 2,500-3,500 words. Do NOT exceed — truncation is the worst failure mode. Finish every section cleanly.
2. TABLES: Use 1-2 markdown tables only where comparison data genuinely helps. Do NOT add tables just to "look thorough."
3. CITATIONS: Cite every claim with [N] notation matching source numbers. Only cite a source you actually read.
4. CONFIDENCE: "established" (2+ sources), "likely" (one source + reasoning), "uncertain" (speculative).
5. NO FILLER: Start directly with information. No "Based on the search results," no "In today's rapidly evolving landscape."
6. NO INVENTED STATS: If a number isn't in the sources, omit or phrase qualitatively ("growing", "significant", "limited").
7. DEPTH: Think like a senior analyst. Identify patterns, synthesize, challenge assumptions.
8. Third person, neutral analytical tone — like a senior analyst's memo, not a marketing brochure.

FORMATTING (CRITICAL for readability — models often ignore this, so follow exactly):
- Put a ---  horizontal rule between every major section. This creates visual breathing room.
- Use bullet points with **bold lead-in** for findings:  - **Finding** — short explanation [N]
- For ranked items, use numbered list with bold + em-dash + descriptor:  1. **Item** — Best for X
- For sub-points, use  - **Label**: value  (e.g.  - **Mechanism**: ...,  - **Evidence**: ...,  - **Limitation**: ...)
- Keep paragraphs SHORT: 3-5 sentences max. Split dense paragraphs into smaller ones.
- One blank line between paragraphs and around --- dividers.

STRUCTURE (use these exact headings, with --- between each):

## Executive Summary
4-6 sentences. The finding, why it matters, key uncertainties.

---

## Key Findings
- **Finding 1** — short description [N]
- **Finding 2** — short description [N]
- **Finding 3** — short description [N]
- **Finding 4** — short description [N]
- **Finding 5** — short description [N]
- **Finding 6** — short description [N]

Then 2-3 short paragraphs of cross-source analysis — what multiple sources agree on, where they diverge.

---

## Context
3-4 short paragraphs. Background the reader needs: history, key stakeholders, current state. Cite sources where possible.

---

## Detailed Analysis
3-5 thematic subsections. Use **bold subheading** for each theme, followed by 2-3 short paragraphs. Cover patterns, contradictions, and gaps in the evidence. Include specific examples and case studies where the sources support them.

---

## Comparative Analysis
One table comparing 2-4 relevant options/frameworks/approaches (whatever the topic implies). 4-6 rows. Follow with 2-3 short paragraphs of analysis explaining the comparisons.

---

## Risk & Opportunity Assessment
- **Risk 1** — description [N]
- **Risk 2** — description [N]
- **Opportunity 1** — description [N]
- **Opportunity 2** — description [N]

Then 2-3 short paragraphs framing the risk/opportunity landscape.

---

## Practical Recommendations
1. **Recommendation 1** — Specific action + expected outcome [N]
2. **Recommendation 2** — Specific action + expected outcome [N]
3. **Recommendation 3** — Specific action + expected outcome [N]
4. **Recommendation 4** — Specific action + expected outcome [N]
5. **Recommendation 5** — Specific action + expected outcome [N]

---

## Future Outlook
2-3 short paragraphs covering near-term (1-2 years), medium-term (3-5 years), and key signals to watch.

---

## Confidence Assessment
Overall: High / Moderate / Low. Biggest uncertainty: ...

Do NOT include a Sources section — the sources list is shown separately in the UI. Keep [N] citations inline only.

FOLLOWUPS:
1. Specific, answerable follow-up question?
2. Specific, answerable follow-up question?
3. Specific, answerable follow-up question?`;

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
    
    // Wrap in a clean div matching the streaming container layout
    html += '<div class="-mx-1 px-1 mb-3"><table class="w-full border-collapse">';
    
    for (let i = 0; i < tableRows.length; i++) {
      const cells = tableRows[i];
      
      // Open structure groups
      if (i === 0) {
        html += '<thead><tr>';
      } else if (i === 1) {
        html += '<tbody><tr>';
      } else {
        html += '<tr>';
      }

      const tag = i === 0 ? 'th' : 'td';
      
      for (const cell of cells) {
        // Let the CSS handle sizing, layout, and overflow. 
        // No inline widths or borders here.
        html += `<${tag}>${renderInline(cell.trim())}</${tag}>`;
      }
      
      html += '</tr>';
      if (i === 0) html += '</thead>';
    }
    
    if (tableRows.length > 1) html += '</tbody>';
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
// STRIP SOURCES SECTION — models often append a "## Sources" or
// "Sources:" block at the end of the report despite instructions
// not to. The Sources tab in the UI already shows the source list,
// so we strip any trailing Sources block from the report body here.
// ══════════════════════════════════════════════════════════════════

function stripSourcesSection(report) {
  if (!report) return report;
  // Strip "## Sources" markdown heading + everything after (until end of
  // string or until a "FOLLOWUPS:" block, which we already extracted)
  let stripped = report.replace(/^[ \t]*(?:#{1,6}\s*)?Sources?\s*:?\s*\n[\s\S]*?$/im, '');
  // Also strip a trailing bare "Sources:" plain-text line + numbered list
  if (/^[ \t]*Sources?\s*:?\s*\n/i.test(stripped)) {
    stripped = stripped.replace(/^[ \t]*Sources?\s*:?\s*\n[\s\S]*?$/im, '');
  }
  return stripped.trim();
}

// ══════════════════════════════════════════════════════════════════
// MAIN RESEARCH PIPELINE — SPEED OPTIMIZED
// ══════════════════════════════════════════════════════════════════

// Standardized response shape (Fix #25)
function makeResponse({ sources, report, title, followups, mode, classification }) {
  return { sources, report, title, followups, mode, classification };
}

async function quickResearch(query, env, apexModel = 'apex-free') {
  const t0 = Date.now();
  
  // Step 0: Classify the query for search routing
  const classification = classifyQuery(query);
  console.log(`[Quick] Query classified as: ${classification}`);
  
  // Step 1: Fast search (2 providers + classified extras, ~2-3s)
  console.log('[Quick] Searching...');
  const searchResults = await searchQuick(query, env, 10, classification);

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
    ], 4096, 'quick');
  } else {
    rawReport = await llmApexFree(env, [
      { role: 'system', content: QUICK_SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ], 4096, 'quick');
  }

  console.log(`[Quick] Report generated in ${Date.now() - t0}ms`);

  // Step 4: Process report
  const { report: rawReport2, followups } = extractFollowups(rawReport);
  // Strip trailing "Sources:" section model may have appended despite instructions
  const report = stripSourcesSection(rawReport2);
  // Fix #22: No markdownToHtml — frontend handles rendering
  const titleMatch = report.match(/^##\s+(.+)$/m) || report.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].replace(/[*_]/g, '') : query;

  const sources = searchResults.map((s, i) => {
    const sourceObj = {
      id: i,
      url: s.url,
      title: s.title || `Source ${i + 1}`,
      snippet: s.snippet?.slice(0, 200) || '',
      favicon: '',
      status: 'loaded',
      tier: s.tier || 'UNV',
      tierLabel: s.tierLabel || 'UNV — Unverified',
    };
    // Add enhanced metadata for academic sources
    if (s.source === 'semantic-scholar' || s.source === 'crossref' || s.source === 'pubmed') {
      sourceObj.authors = s.authors || [];
      sourceObj.year = s.year || null;
      sourceObj.citations = s.citations || 0;
      sourceObj.doi = s.doi || '';
      sourceObj.sourceType = s.source;
    }
    if (s.source === 'github') {
      sourceObj.authors = s.authors || [];
      sourceObj.year = s.year || null;
      sourceObj.sourceType = 'github';
    }
    return sourceObj;
  });

  // Fix #25: Standardized response shape — no content field
  return makeResponse({ sources, report, title, followups, mode: 'quick', classification });
}

async function deepResearch(query, env, apexModel = 'apex-free') {
  const t0 = Date.now();

  // ── PHASE 0: Classify the query for search routing ──
  const classification = classifyQuery(query);
  console.log(`[Deep] Query classified as: ${classification}`);

  // ── PHASE 1: Search (3+ providers + classified extras, ~2.5-4s) ──
  console.log('[Deep] Phase 1: Searching...');
  const searchResults = await searchDeep(query, env, 15, classification);

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
  const sources = searchResults.map((s, i) => {
    const sourceObj = {
      id: i,
      url: s.url,
      title: s.title || `Source ${i + 1}`,
      snippet: s.snippet?.slice(0, 200) || '',
      favicon: '',
      status: deepContents.some(dc => dc.url === s.url) ? 'deep' : 'loaded',
      tier: s.tier || 'UNV',
      tierLabel: s.tierLabel || 'UNV — Unverified',
    };
    // Add enhanced metadata for academic sources
    if (s.source === 'semantic-scholar' || s.source === 'crossref' || s.source === 'pubmed') {
      sourceObj.authors = s.authors || [];
      sourceObj.year = s.year || null;
      sourceObj.citations = s.citations || 0;
      sourceObj.doi = s.doi || '';
      sourceObj.sourceType = s.source;
    }
    if (s.source === 'github') {
      sourceObj.authors = s.authors || [];
      sourceObj.year = s.year || null;
      sourceObj.sourceType = 'github';
    }
    return sourceObj;
  });

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
    ], effectiveMaxTokens, 'deep');
    console.log(`[Deep] Section '${section.name}' done in ${Date.now() - sectionT0}ms, ${result?.length || 0} chars`);
    return { name: section.name, content: result || '' };
  });
  const sectionResults = await Promise.all(sectionPromises);

  // Combine all sections into one report
  const rawReport = sectionResults.map(s => s.content).join('\n\n');

  console.log(`[Deep] Complete in ${Date.now() - t0}ms, total report: ${rawReport.length} chars`);

  // Process report
  const { report: rawReport2, followups } = extractFollowups(rawReport);
  // Strip trailing "Sources:" section model may have appended despite instructions
  const report = stripSourcesSection(rawReport2);
  // Fix #22/#23: No markdownToHtml, no content field
  const titleMatch = report.match(/^##\s+(.+)$/m) || report.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].replace(/[*_]/g, '') : query;

  // Fix #25: Standardized response shape
  return makeResponse({ sources, report, title, followups, mode: 'deep', classification });
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
        academic_providers: {
          semantic_scholar: 'available (free)',
          crossref: 'available (free)',
          pubmed: 'available (free)',
          github: 'available (free, rate-limited)',
        },
        classifications: ['academic', 'biomedical', 'tech', 'finance', 'general'],
      });
    }

    // Classify endpoint — returns query classification for testing
    if (url.pathname === '/classify' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { query } = body;
        if (!query) return jsonRes({ error: 'Query is required' }, 400);
        const classification = classifyQuery(query);
        return jsonRes({ query, classification });
      } catch {
        return jsonRes({ error: 'Invalid JSON body' }, 400);
      }
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
        version: '5.1.0',
        providers: {
          openrouter: !!getOpenRouterKey(env),
          gemini: !!getGeminiKey(env),
          workers_ai: !!env.AI,
          pollinations: true,
          tavily: !!getTavilyKey(env),
          brave: !!getBraveKey(env),
          firecrawl: !!getFirecrawlKey(env),
          semantic_scholar: true,
          crossref: true,
          pubmed: true,
          github: true,
        },
        classifications: ['academic', 'biomedical', 'tech', 'finance', 'general'],
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
