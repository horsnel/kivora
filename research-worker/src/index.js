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
function getMistralKey(env) {
  return env.MISTRAL_API_KEY || '';
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

// ── Image Description (Vision) ──
// Used when the user attaches an image to a research query. The image (base64
// data URL) is sent to a vision-capable LLM which returns a textual
// description. That description is then prepended to the research query so
// the research LLM can reason about the image's contents.
//
// Provider chain:
//   1. Gemini 2.0 Flash (native vision support, generous free tier)
//   2. OpenRouter llama-4-maverick (vision-capable, 20K RPM free tier)
//   3. Workers AI @cf/llava-hf (Cloudflare's hosted vision model)
// Each provider is tried in order; the first non-empty response wins.

// Determine if a file is "text-like" (we can safely inline its content).
// Checks both the file extension and MIME type for robustness.
const TEXT_FILE_EXTENSIONS = ['txt', 'md', 'json', 'csv', 'js', 'py', 'ts', 'jsx', 'tsx', 'css', 'html', 'sql', 'xml', 'yaml', 'yml', 'log'];
function isTextLikeFile(fileName, mimeType) {
  if (mimeType && (mimeType.startsWith('text/') || mimeType === 'application/json' || mimeType === 'application/javascript' || mimeType === 'application/xml')) {
    return true;
  }
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  return TEXT_FILE_EXTENSIONS.includes(ext);
}

async function describeImage(env, imageDataUrl, mimeType = 'image/png') {
  if (!imageDataUrl) return null;

  // Strip the data URL prefix to get raw base64
  const base64 = imageDataUrl.replace(/^data:[^;]+;base64,/, '');

  // Vision prompt — detailed and structured to match the quality of the chat page analysis.
  // Asks for text elements, graphics, colors, and overall impression so the research
  // model gets rich context about the image content (not just metadata).
  const VISION_PROMPT = 'Analyze this image thoroughly. Describe:\n1. What the image shows (objects, people, scenes, charts/diagrams)\n2. ALL text elements visible in the image (titles, headlines, labels, captions, UI text) — quote them exactly\n3. Graphics, symbols, logos, icons, and visual elements\n4. Color scheme and overall visual style\n5. The overall impression / what the image is communicating\n\nBe specific and detailed. Your description will be used as context for a research query, so capture every meaningful visual element.';

  // --- Provider 1: Mistral Pixtral (vision) ---
  // Mistral's pixtral-12b-2409 is a dedicated vision model that produces rich,
  // structured descriptions. Primary provider because it handles text-in-image
  // extraction especially well (ads, screenshots, documents).
  if (getMistralKey(env)) {
    try {
      const t0 = Date.now();
      const res = await fetch('https://api.mistral.ai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getMistralKey(env)}`,
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          model: 'pixtral-12b-2409',
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: VISION_PROMPT },
              { type: 'image_url', image_url: { url: imageDataUrl } },
            ],
          }],
          max_tokens: 1500,
          temperature: 0.2,
        }),
        signal: AbortSignal.timeout(20000),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content;
        // Mistral may return content as string or array of content blocks
        const desc = typeof text === 'string'
          ? text
          : Array.isArray(text)
            ? text.map(b => b?.text || '').join('')
            : '';
        if (desc && desc.length > 30) {
          console.log(`[Vision/Mistral] success in ${Date.now()-t0}ms, chars: ${desc.length}`);
          return desc.trim();
        }
      } else {
        const errBody = await res.text().catch(() => '');
        console.error(`[Vision/Mistral] error ${res.status}: ${errBody.slice(0, 200)}`);
      }
    } catch (err) {
      console.error('[Vision/Mistral] exception:', err.message);
    }
  }

  // --- Provider 2: Gemini 2.0 Flash (vision) ---
  if (getGeminiKey(env)) {
    try {
      const t0 = Date.now();
      const apiKey = getGeminiKey(env);
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              role: 'user',
              parts: [
                { text: VISION_PROMPT },
                { inline_data: { mime_type: mimeType, data: base64 } },
              ],
            }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 1536 },
          }),
          signal: AbortSignal.timeout(15000),
        }
      );
      if (res.ok) {
        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && text.length > 20) {
          console.log(`[Vision/Gemini] success in ${Date.now()-t0}ms, chars: ${text.length}`);
          return text.trim();
        }
      } else {
        console.error(`[Vision/Gemini] error ${res.status}`);
      }
    } catch (err) {
      console.error('[Vision/Gemini] exception:', err.message);
    }
  }

  // --- Provider 3: OpenRouter llama-4-maverick (vision) ---
  if (getOpenRouterKey(env)) {
    try {
      const t0 = Date.now();
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getOpenRouterKey(env)}`,
          'HTTP-Referer': 'https://kivora.pages.dev',
          'X-Title': 'Kivora Research',
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-maverick',
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: VISION_PROMPT },
              { type: 'image_url', image_url: { url: imageDataUrl } },
            ],
          }],
          max_tokens: 1500,
          temperature: 0.2,
        }),
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content;
        if (text && text.length > 20) {
          console.log(`[Vision/OpenRouter] success in ${Date.now()-t0}ms, chars: ${text.length}`);
          return text.trim();
        }
      } else {
        console.error(`[Vision/OpenRouter] error ${res.status}`);
      }
    } catch (err) {
      console.error('[Vision/OpenRouter] exception:', err.message);
    }
  }

  // --- Provider 4: Workers AI Llava (fallback) ---
  if (env.AI) {
    try {
      const t0 = Date.now();
      // Convert base64 to Uint8Array for Workers AI
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
      const response = await env.AI.run('@cf/llava-hf', {
        image: bytes,
        prompt: VISION_PROMPT,
      });
      const text = response?.description || response?.response;
      if (text && text.length > 20) {
        console.log(`[Vision/WorkersAI] success in ${Date.now()-t0}ms, chars: ${text.length}`);
        return text.trim();
      }
    } catch (err) {
      console.error('[Vision/WorkersAI] exception:', err.message);
    }
  }

  console.error('[Vision] All providers failed');
  return null;
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
7. Use exactly 2 markdown tables: one in Key Findings (summary table with one row per finding) and one in Comparison Table (options/approaches matrix). Do NOT add more.

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

Then 1 short paragraph of analysis — what sources agree on, where they diverge.

Then 1 summary table with columns: Finding | Confidence | Key Insight. One row per finding (4 rows).

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
2. TABLES: Use 3-5 markdown tables distributed across sections (1 in Context, 1 in Detailed Analysis, 1 in Comparative Analysis, 1 in Risk & Opportunity or Future Outlook). Each table MUST use proper markdown syntax with a separator row of | --- | between the header and body. Tables must carry information that bullets cannot.
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
- For markdown tables, ALWAYS include the separator row of | --- | between the header row and body rows.

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
3-4 short paragraphs. Background the reader needs: history, key stakeholders, current state. Cite sources where possible. Include 1 table summarizing key background data (timeline, stakeholder matrix, or market data depending on topic).

---

## Detailed Analysis
3-5 thematic subsections. Use **bold subheading** for each theme, followed by 2-3 short paragraphs. Cover patterns, contradictions, and gaps in the evidence. End the section with 1 CONSOLIDATED comparison table that covers all themes together (do NOT add one table per sub-theme). Include specific examples and case studies where the sources support them.

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
// MARKDOWN → HTML CONVERTER (DEPRECATED — Fix #22)
// ══════════════════════════════════════════════════════════════════
// This function is no longer called. The frontend renders the raw
// markdown string via react-markdown + remark-gfm, styled by the
// .report-body CSS block in app/research/page.jsx. Kept here only as
// a reference for the previous HTML-output pipeline. Safe to delete.

// ══════════════════════════════════════════════════════════════════
// EXTRACT FOLLOWUPS
// ══════════════════════════════════════════════════════════════════

// Strip inline markdown formatting from a single follow-up question.
// We strip **bold**, __italic__, *italic*, _italic_, and `code` markers
// because the UI renders follow-ups as plain text (not via ReactMarkdown).
// We also strip leading bullet/number prefixes that the model sometimes
// leaves attached to the question text.
function cleanFollowupQuestion(q) {
  return q
    .replace(/\*\*(.+?)\*\*/g, '$1')   // **bold**
    .replace(/__(.+?)__/g, '$1')        // __bold__
    .replace(/\*(.+?)\*/g, '$1')        // *italic*
    .replace(/_(.+?)_/g, '$1')          // _italic_
    .replace(/`([^`]+)`/g, '$1')        // `code`
    .replace(/^\s*[-*]\s+/, '')         // leading bullet
    .replace(/^\s*\d+[.)]\s+/, '')      // leading number
    .trim();
}

// Bulletproof regex for any heading-style follow-ups section. Matches every
// variant the model has been observed to produce:
//   "## Follow-ups"           — basic heading
//   "## Follow-ups:"           — with trailing colon
//   "## Follow-ups for Further Research"  — with descriptive suffix
//   "## **Follow-ups**"        — markdown bold wrapping the word
//   "## **Follow-ups:**"       — bold with colon INSIDE the markers
//   "## Suggested Follow-ups (5 questions)" — prefix + suffix
//   "## Follow-Ups"            — capital U in middle
//   "Follow-ups:"              — bare, no #
//   "## Follow Up Questions"   — variant phrasing
//   "## Related Questions"     — alternative heading
//   "### Follow-up Questions"  — different heading level
//   "Specific follow-up questions:" — lowercase + custom prefix
//   "## Follow-up Inquiries"   — variant noun
//   "## Questions for Further Research" — reordered phrasing
//   "## Further Investigation" — variant phrasing
//   "## Next Steps"            — variant phrasing (sometimes used)
// Allows 0-3 leading '#', optional markdown bold (**...**), optional prefix
// word, optional trailing descriptor in parentheses or after a colon, and is
// CASE-INSENSITIVE so "follow-up", "Follow-up", "FOLLOW-UP" all match.
// The trailing portion allows any combination of bold markers, colons, and
// whitespace so "Follow-ups:**" and "**Follow-ups:**" both match.
const FOLLOWUP_PREFIX_WORDS = '(?:suggested|potential|recommended|possible|additional|further|specific|other|relevant|proposed|noteworthy|interesting)';
const FOLLOWUP_KEYWORDS = '(?:follow[-\\s]?[Uu]?ps?|follow[-\\s]?[Uu]?p\\s+(?:questions?|inquiries|items|research\\s+questions?)|related\\s+questions?|questions\\s+for\\s+(?:further\\s+)?research|further\\s+(?:investigation|questions?|research)|next\\s+steps)';
const FOLLOWUP_HEADING_RE = new RegExp(
  '^[ \\t]*#{0,3}\\s*(?:\\*{1,2}\\s*)?' +
  '(?:' + FOLLOWUP_PREFIX_WORDS + '\\s+)?' +
  FOLLOWUP_KEYWORDS +
  '[\\s*:：\\*]*(?:\\([^)]*\\)[\\s*:：\\*]*)?(?:\\s+for\\s+[^\\n]+)?\\s*$',
  'im'
);

// Looser variant used for defensive line-by-line scan inside stripSourcesSection.
// Matches any line whose stripped form starts with a follow-ups-style word,
// regardless of trailing punctuation or descriptor text. Used as a last-resort
// catch for heading formats the main regex might miss.
// IMPORTANT: The prefix word group MUST have `\\s+` after it (same as main
// regex), otherwise "Suggested Follow-ups" won't match — the space between
// "Suggested" and "Follow-ups" would not be consumed, and the regex would fail
// to match the keyword after the prefix.
const FOLLOWUP_HEADING_LOOSE_RE = new RegExp(
  '^[ \\t]*#{0,3}\\s*(?:\\*{1,2}\\s*)?' +
  '(?:' + FOLLOWUP_PREFIX_WORDS + '\\s+)?' +
  FOLLOWUP_KEYWORDS,
  'im'
);

function extractFollowups(text) {
  if (!text) return { report: '', followups: [] };

  // Helper: extract question lines from a block of text
  function extractQuestionsFromBlock(block) {
    return block
      .split('\n')
      .map(line => cleanFollowupQuestion(line))
      .filter(q => q.length > 10 && q.endsWith('?'));
  }

  // ── Pattern 1: explicit "FOLLOWUPS:" keyword ──
  // The model is instructed to end the report with this keyword. Most common case.
  const kwMatch = text.match(/FOLLOWUPS:\s*\n([\s\S]*?)$/i);
  if (kwMatch) {
    const followups = extractQuestionsFromBlock(kwMatch[1]);
    if (followups.length > 0) {
      // Strip from "FOLLOWUPS:" to end of text. Also strip any "## Follow-ups"
      // heading that may precede the keyword (the model sometimes emits both).
      let report = text.replace(/FOLLOWUPS:\s*\n[\s\S]*$/i, '');
      // If a follow-ups heading immediately precedes the keyword, remove it too.
      report = report.replace(/([ \t]*#{0,3}\s*(?:Follow[-\s]?[Uu]ps?|Follow[-\s]?[Uu]p\s+Questions?|Related\s+Questions?)\s*:?\s*\n+)$/im, '');
      return { report: report.trim(), followups };
    }
  }

  // ── Pattern 2: ## Follow-ups / ## Followups / ## Follow Up Questions heading ──
  // The model sometimes outputs the section as a markdown heading instead of
  // using the FOLLOWUPS: keyword. This is the case that was leaking through
  // to the report body in production (see "## Followups" bug).
  //
  // IMPORTANT: In deep mode, the report is assembled from part1 + part2.
  // If a Follow-ups heading appears at the end of part1, we must NOT strip
  // everything after it blindly — that would delete part2. Instead, we strip
  // only up to the next `---` horizontal rule (the part1/part2 divider) and
  // preserve everything after the divider.
  const headingMatch = text.match(FOLLOWUP_HEADING_RE);
  if (headingMatch) {
    const headingStart = headingMatch.index;
    const headingEnd = headingStart + headingMatch[0].length;
    const afterHeading = text.slice(headingEnd);
    const questions = extractQuestionsFromBlock(afterHeading);
    if (questions.length > 0) {
      // Check if there's a `---` divider after the heading — if so, only strip
      // up to that divider and preserve any part2 content that follows.
      const dividerAfterHeading = afterHeading.indexOf('\n---');
      let report;
      if (dividerAfterHeading !== -1) {
        // Preserve content after the divider (likely part2 of a deep-mode report)
        const beforeDivider = text.slice(0, headingStart);
        const afterDivider = afterHeading.slice(dividerAfterHeading + 1); // skip the leading \n, keep the --- line
        report = beforeDivider + '\n' + afterDivider;
      } else {
        // No divider — strip the heading AND everything after it (the questions).
        report = text.slice(0, headingStart);
      }
      return { report: report.trim(), followups: questions };
    }
    // ── Pattern 2.5: heading matched but no questions followed ──
    // The model emitted a "## Follow-ups" heading but the content after it
    // didn't look like questions (no '?' endings). We STILL need to strip the
    // heading + everything after it up to the next `---` divider — otherwise
    // the heading and its non-question follow-up content leak into the report
    // body. We then fall through to Pattern 3 with the stripped text in case
    // there are question lines ELSEWHERE in the remaining text.
    const dividerAfterHeading = afterHeading.indexOf('\n---');
    let report2_5;
    if (dividerAfterHeading !== -1) {
      // Preserve content after the divider (likely part2 of a deep-mode report)
      const beforeDivider = text.slice(0, headingStart);
      const afterDivider = afterHeading.slice(dividerAfterHeading + 1);
      report2_5 = beforeDivider + '\n' + afterDivider;
    } else {
      // No divider — strip heading + everything after it. The content after
      // a Follow-ups heading is follow-up content (even if not questions),
      // so it should not appear in the report body.
      report2_5 = text.slice(0, headingStart);
    }
    text = report2_5.trim();
    // Fall through to Pattern 3 to look for question lines elsewhere.
  }

  // ── Pattern 3 (last-resort fallback): scan last 25 lines for question lines ──
  // Used when the model didn't use either the keyword or a heading.
  const lines = text.split('\n');
  const tailStart = Math.max(0, lines.length - 25);
  const tail = lines.slice(tailStart);
  const questions = [];
  const questionLineIndices = [];
  for (let i = 0; i < tail.length; i++) {
    const cleaned = cleanFollowupQuestion(tail[i]);
    if (cleaned.length > 10 && cleaned.endsWith('?')) {
      questions.push(cleaned);
      questionLineIndices.push(tailStart + i);
    }
  }
  if (questions.length > 0) {
    // Remove the question lines from the report body.
    const reportLines = lines.slice();
    questionLineIndices.sort((a, b) => b - a);  // descending so splice doesn't shift
    for (const idx of questionLineIndices) {
      reportLines.splice(idx, 1);
    }
    // If a "## Follow-ups" style heading immediately preceded the first question,
    // remove that line too so we don't leave a dangling empty heading.
    const firstIdx = Math.min(...questionLineIndices);
    if (firstIdx > 0) {
      const prevLine = reportLines[firstIdx - 1] || '';
      if (FOLLOWUP_HEADING_RE.test(prevLine)) {
        reportLines.splice(firstIdx - 1, 1);
      }
    }
    return { report: reportLines.join('\n').trim(), followups: questions };
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
  // Belt-and-suspenders: strip any "## Follow-ups" / "## Followups" /
  // "## Follow Up Questions" / "## Related Questions" / "## Next Steps" /
  // "## Questions for Further Research" heading + everything after it.
  // extractFollowups() should have already removed this content, but if the
  // model used a slightly different heading format (e.g. extra whitespace, or
  // no question mark at the end of questions), some content could leak
  // through. This guarantees the report body never contains a duplicate
  // Follow-ups section that overlaps with the UI's section.
  // Uses the same bulletproof pattern (FOLLOWUP_HEADING_RE) that
  // extractFollowups uses — built from FOLLOWUP_PREFIX_WORDS +
  // FOLLOWUP_KEYWORDS so every variant is caught:
  // ## Follow-ups, ## **Follow-ups**, ## **Follow-ups:** (colon inside bold),
  // ## Suggested Follow-ups (5), ## Follow-ups for Further Research, bare
  // Follow-ups:, ## Next Steps, ## Questions for Further Research, etc.
  // We use a RegExp built from the same source strings to avoid duplicating
  // the pattern logic.
  const SINK_FOLLOWUP_RE = new RegExp(
    '^[ \\t]*#{0,3}\\s*(?:\\*{1,2}\\s*)?' +
    '(?:' + FOLLOWUP_PREFIX_WORDS + '\\s+)?' +
    FOLLOWUP_KEYWORDS +
    '[\\s*:：\\*]*(?:\\([^)]*\\)[\\s*:：\\*]*)?(?:\\s+for\\s+[^\\n]+)?\\s*\\n[\\s\\S]*$',
    'im'
  );
  stripped = stripped.replace(SINK_FOLLOWUP_RE, '');
  // Also strip a bare "FOLLOWUPS:" keyword + everything after it (defensive
  // — extractFollowups should have caught this, but if it returned an empty
  // followups array because questions didn't end in '?', the keyword could
  // still be in the report body).
  stripped = stripped.replace(/^[ \t]*FOLLOWUPS:\s*\n[\s\S]*$/im, '');
  // Final defensive line-by-line scan: if ANY line still looks like a
  // follow-ups heading (using the loose regex), drop that line and any
  // subsequent question-style lines (ending in '?'). This is the last
  // line of defense against heading formats that slipped through the
  // regex-based strip above. We also strip the heading line itself even
  // if no questions follow (a bare "**Follow-ups:**" at the end of the
  // report with no questions after it should still be removed).
  const lines = stripped.split('\n');
  let firstFollowupIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (FOLLOWUP_HEADING_LOOSE_RE.test(lines[i])) {
      firstFollowupIdx = i;
      break;
    }
  }
  if (firstFollowupIdx !== -1) {
    // Check if the lines after the heading look like questions (end in '?')
    const tail = lines.slice(firstFollowupIdx + 1).join('\n');
    const questionCount = (tail.match(/\?\s*$/gm) || []).length;
    if (questionCount >= 1) {
      // Questions follow — strip heading + all subsequent lines
      lines.splice(firstFollowupIdx);
      stripped = lines.join('\n').trim();
    } else {
      // No questions after — just strip the bare heading line itself.
      // This handles the case where the model output "**Follow-ups:**" as
      // a trailing line with no actual questions (the questions may have
      // been extracted earlier by Pattern 1 via the FOLLOWUPS: keyword,
      // but the heading line was left behind).
      lines.splice(firstFollowupIdx, 1);
      stripped = lines.join('\n').trim();
    }
  }
  // Collapse multiple consecutive --- horizontal rules into one. This
  // happens at the part1/part2 boundary when the model appends a trailing
  // --- despite instructions and the join adds another --- between parts.
  stripped = stripped.replace(/(\n\s*---\s*\n[\s]*){2,}/g, '\n\n---\n\n');
  // Promote part2's known top-level sections from ### (h3) to ## (h2).
  // The part2 model sometimes downgrades heading level after seeing part1's
  // h3 sub-themes — these section names MUST be h2 to get the red accent
  // border + 1.3rem size from .report-body h2 CSS.
  stripped = stripped.replace(/^###\s+(Comparative Analysis|Risk & Opportunity Assessment|Practical Recommendations|Future Outlook|Confidence Assessment)\s*$/gm, '## $1');
  // Ensure every h2 section is preceded by a --- divider (except the first).
  // The part2 model often skips --- between its sections despite explicit
  // instructions. We split by h2 headings, strip any trailing --- from each
  // section (to avoid doubles), and re-join with --- between every pair.
  const h2Sections = stripped.split(/(?=^## [A-Z])/m);
  if (h2Sections.length > 1) {
    // If the first element is just whitespace (report starts with ##),
    // drop it so we don't get a leading blank section.
    const hasPreamble = h2Sections[0].trim().length > 0;
    const sections = hasPreamble
      ? h2Sections
      : h2Sections.slice(1);
    const cleaned = sections.map(s =>
      s.trim().replace(/\n+---\s*$/, '').trim()
    );
    stripped = cleaned.join('\n\n---\n\n') + '\n';
  }
  // Trim trailing --- / whitespace that the section-rejoin above may have left.
  stripped = stripped.replace(/(\n\s*---\s*)+$/g, '').trim();
  return stripped.trim();
}

// ══════════════════════════════════════════════════════════════════
// IMAGE INTELLIGENCE PIPELINE — multi-pass, OSINT-style analysis
// ══════════════════════════════════════════════════════════════════
//
// Designed for "government computer system" style depth: extract entities
// from the image description, generate targeted search queries, run them
// in parallel, then cross-reference findings against the image content
// to verify authenticity and identify scams / real products / context.

// Phase 2: Extract structured entities from the vision description.
// Uses a fast LLM call (Groq llama-3.1-8b via llmApexFree) to pull out:
//   - brand_names:    recognized brands, products, platforms, organizations
//   - key_numbers:    token amounts, prices, dates, version numbers
//   - visual_elements: logos, QR codes, icons, characters, flags
//   - text_content:   key text elements quoted from the image
//   - context:        what the image appears to be (ad, screenshot, diagram)
//   - topic_category: marketing/scam/educational/news/personal/document
//   - search_queries: 2-3 targeted web search queries derived from entities
async function extractImageEntities(env, imageDescription, userQuery) {
  const t0 = Date.now();
  const prompt = `You are an intelligence analyst. Analyze this image description and extract structured entities for an OSINT investigation.

Image description:
${imageDescription}

${userQuery ? `User question: ${userQuery}` : ''}

Return STRICT JSON only (no markdown, no commentary). Schema:
{
  "brand_names": ["recognized brands, platforms, organizations, products"],
  "key_numbers": ["token amounts, prices, dates, version numbers, statistics"],
  "visual_elements": ["logos, QR codes, icons, characters, flags, charts, screenshots"],
  "text_content": ["key text strings quoted from the image (headlines, CTAs, labels)"],
  "context": "one sentence: what this image appears to be (advertisement, screenshot, diagram, photo, document, meme, etc.)",
  "topic_category": "one of: marketing | scam_or_phishing | educational | news | personal_photo | document | meme | technical_diagram | other",
  "search_queries": ["2-3 targeted web search queries (3-7 words each) that would find authoritative information about this image's content"]
}

Rules:
- search_queries should target the SPECIFIC entities (brand + product), not generic terms.
- If the image appears to be a scam or phishing attempt, include "scam" or "phishing" in one search query.
- If you recognize a specific brand, name it explicitly in search_queries.
- Return at most 3 search_queries.`;

  try {
    const raw = await llmApexFree(env, [
      { role: 'system', content: 'You are a JSON-only OSINT entity extractor. Return valid JSON, no markdown fences.' },
      { role: 'user', content: prompt },
    ], 1024, 'quick');

    // Strip markdown fences if present
    let cleaned = (raw || '').trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
    }
    // Find first { and last }
    const first = cleaned.indexOf('{');
    const last = cleaned.lastIndexOf('}');
    if (first >= 0 && last > first) {
      cleaned = cleaned.slice(first, last + 1);
    }

    const parsed = JSON.parse(cleaned);
    console.log(`[ImgIntel] entities extracted in ${Date.now()-t0}ms — brands: ${parsed.brand_names?.length||0}, queries: ${parsed.search_queries?.length||0}`);
    return parsed;
  } catch (err) {
    console.error('[ImgIntel] entity extraction failed:', err.message);
    // Return minimal fallback so pipeline can continue
    return {
      brand_names: [],
      key_numbers: [],
      visual_elements: [],
      text_content: [],
      context: 'image content',
      topic_category: 'other',
      search_queries: [],
    };
  }
}

// Phase 3b: Run multiple Tavily searches in parallel and merge/dedupe results.
async function multiQuerySearch(queries, env, perQuery = 5) {
  if (!queries || queries.length === 0) return [];
  const t0 = Date.now();
  console.log(`[ImgIntel] running ${queries.length} parallel searches: ${JSON.stringify(queries)}`);

  const results = await Promise.all(
    queries.map(q => searchTavily(q, env, perQuery, 'basic').catch(() => []))
  );

  // Merge and dedupe by URL
  const seen = new Set();
  const merged = [];
  for (const list of results) {
    for (const r of list) {
      try {
        const u = new URL(r.url);
        const key = u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/$/, '');
        if (!seen.has(key)) {
          seen.add(key);
          merged.push(r);
        }
      } catch {
        // skip invalid URLs
      }
    }
  }
  console.log(`[ImgIntel] multi-query search returned ${merged.length} unique results in ${Date.now()-t0}ms`);
  return merged;
}

// Phase 4: Cross-reference image content with web findings.
// Determines if the image is authentic, identifies scams, verifies claims.
async function crossReferenceImage(env, imageDescription, entities, searchResults, userQuery) {
  const t0 = Date.now();

  const searchContext = searchResults.slice(0, 8).map((s, i) =>
    `[${i + 1}] ${s.title}\nURL: ${s.url}\n${s.snippet || ''}`
  ).join('\n\n');

  const prompt = `You are an OSINT analyst cross-referencing an image's content with web findings.

IMAGE DESCRIPTION:
${imageDescription}

EXTRACTED ENTITIES:
- Brands: ${entities.brand_names?.join(', ') || 'none'}
- Numbers: ${entities.key_numbers?.join(', ') || 'none'}
- Visual elements: ${entities.visual_elements?.join(', ') || 'none'}
- Text content: ${entities.text_content?.join(' | ') || 'none'}
- Apparent context: ${entities.context || 'unknown'}
- Topic category: ${entities.topic_category || 'other'}

WEB FINDINGS:
${searchContext}

${userQuery ? `User question: ${userQuery}` : ''}

Produce a cross-reference analysis (300-500 words) covering:
1. **Verification**: Does web evidence confirm or contradict the image's claims? Cite source numbers.
2. **Authenticity**: Is this a real product/ad/person, or a fabrication/scam/misinformation?
3. **Context**: What is the broader context? (e.g., "this is a known phishing campaign targeting X")
4. **Key findings**: 2-3 bullet points of the most important verified facts.
5. **Confidence**: HIGH / MEDIUM / LOW with one-sentence reason.

Be specific. Quote source numbers like [1], [3] when citing. If findings don't mention the image's content, say so explicitly.`;

  try {
    const result = await llmApexFree(env, [
      { role: 'system', content: 'You are a precise OSINT cross-reference analyst. Be factual, cite sources by number.' },
      { role: 'user', content: prompt },
    ], 2048, 'deep');
    console.log(`[ImgIntel] cross-reference done in ${Date.now()-t0}ms, ${result?.length||0} chars`);
    return result || '';
  } catch (err) {
    console.error('[ImgIntel] cross-reference failed:', err.message);
    return '';
  }
}

// Full image intelligence pipeline — used when an image is attached.
// Replaces the standard quickResearch/deepResearch for image uploads.
//
// PERFORMANCE: 3-phase pipeline (vision + search + report-with-cross-ref).
// The cross-reference step is merged INTO the final report LLM call to
// avoid an extra 5-10s round-trip. Total wall time: 20-35s.
async function imageIntelligenceResearch({
  userQuery, env, apexModel, imageDescription, fileName,
  entities, mode = 'quick'
}) {
  const t0 = Date.now();

  // Phase 2: Targeted multi-query web search (uses entities from Phase 1)
  const searchQueries = entities?.search_queries?.length
    ? entities.search_queries.slice(0, 3)
    : [userQuery || 'image analysis'];

  // Always include the user query as one of the search queries if present
  if (userQuery && userQuery.length > 5 && !searchQueries.includes(userQuery)) {
    searchQueries.push(userQuery.slice(0, 100));
  }

  const perQuery = mode === 'deep' ? 6 : 4;
  const searchResults = await multiQuerySearch(searchQueries, env, perQuery);

  if (searchResults.length === 0) {
    return { error: 'No web sources found for this image. Try a more specific query.' };
  }

  console.log(`[ImgIntel] ${mode} mode — ${searchResults.length} sources, generating report...`);

  // Phase 3: Final intelligence report (with INLINE cross-reference)
  // The LLM gets the image description, entities, and web sources, and is
  // instructed to cross-reference and verify as part of the report itself.
  const sourcesContext = searchResults.map((s, i) =>
    `[${i + 1}] ${s.title}\n${s.url}\n${s.snippet || ''}`
  ).join('\n\n');

  const isDeep = mode === 'deep';
  const systemPrompt = isDeep
    ? `You are a senior intelligence analyst producing a comprehensive OSINT report based on an image submission and corroborating web sources.

You MUST cross-reference the image's claims against the web sources and cite specific source numbers like [1], [3] throughout your report. If sources contradict the image, say so explicitly. If sources don't mention the image's content, say so.

Structure your report as:
## Executive Summary
(2-3 paragraph overview of what the image shows, what was verified, and key findings)

## Image Content Analysis
(Detailed breakdown of visual elements, text, and context — using the image description and extracted entities)

## Verification & Cross-Reference
(Cross-reference the image's claims against the web sources. Cite sources by number like [1], [3]. State what was confirmed, contradicted, or unverifiable.)

## Key Findings
- **Finding 1** — detail with source citation
- **Finding 2** — detail with source citation
- **Finding 3** — detail with source citation

## Risk Assessment
(Is this a scam/legitimate/educational? State confidence level: HIGH/MEDIUM/LOW with reasoning.)

## Methodology
(Brief note on what was searched and how findings were corroborated.)

Use markdown. Be specific. Do NOT include a "Sources" or "Follow-ups" section — those are handled separately.`
    : `You are an intelligence analyst producing a concise OSINT brief based on an image and corroborating web sources.

You MUST cross-reference the image's claims against the web sources and cite specific source numbers like [1], [3]. If sources contradict the image, say so explicitly.

Structure:
## Image Analysis
(1 paragraph: what the image shows, using the description and entities)

## Verification
(1-2 paragraphs: what was confirmed/contradicted by web sources, with [1] citations. Be explicit about what was verified vs. unverifiable.)

## Key Findings
- 3-4 bullets with source citations

## Assessment
(1 paragraph: authenticity verdict — scam/legitimate/educational — and confidence level: HIGH/MEDIUM/LOW)

Use markdown. Cite sources by number. Do NOT include "Sources" or "Follow-ups" sections.`;

  const userContent = `USER QUERY: ${userQuery || '(no specific question — analyze this image)'}

ATTACHED IMAGE: ${fileName}

IMAGE DESCRIPTION (from vision model):
${imageDescription}

EXTRACTED ENTITIES:
- Brands: ${entities.brand_names?.join(', ') || 'none'}
- Numbers: ${entities.key_numbers?.join(', ') || 'none'}
- Visual elements: ${entities.visual_elements?.join(', ') || 'none'}
- Text content: ${entities.text_content?.join(' | ') || 'none'}
- Apparent context: ${entities.context || 'unknown'}
- Topic category: ${entities.topic_category || 'other'}

WEB SOURCES (cite these by number in your report):
${sourcesContext}

Produce the intelligence report now. Cross-reference the image content against the web sources, cite by number, and assess authenticity.`;

  let rawReport;
  if (apexModel === 'apex-premium') {
    rawReport = await llmApexPremium(env, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ], isDeep ? 8192 : 4096, mode);
  } else {
    rawReport = await llmApexFree(env, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ], isDeep ? 8192 : 4096, mode);
  }

  console.log(`[ImgIntel] report generated in ${Date.now()-t0}ms total`);

  // Process report (extract followups, strip sources section)
  const { report: rawReport2, followups } = extractFollowups(rawReport);
  const report = stripSourcesSection(rawReport2);
  const titleMatch = report.match(/^##\s+(.+)$/m) || report.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].replace(/[*_]/g, '') : (userQuery || 'Image Intelligence Report');

  const sources = searchResults.map((s, i) => ({
    id: i,
    url: s.url,
    title: s.title || `Source ${i + 1}`,
    snippet: s.snippet?.slice(0, 200) || '',
    favicon: '',
    status: 'loaded',
    tier: s.tier || 'UNV',
    tierLabel: s.tierLabel || 'UNV — Unverified',
  }));

  return makeResponse({ sources, report, title, followups, mode, classification: 'image_intelligence' });
}

// ══════════════════════════════════════════════════════════════════
// MAIN RESEARCH PIPELINE — SPEED OPTIMIZED
// ══════════════════════════════════════════════════════════════════

// Standardized response shape (Fix #25)
function makeResponse({ sources, report, title, followups, mode, classification }) {
  return { sources, report, title, followups, mode, classification };
}

async function quickResearch(query, env, apexModel = 'apex-free', searchQueryOverride = null) {
  const t0 = Date.now();

  // The search query is separate from the LLM context query. When an image
  // is attached, the LLM gets the full image description + user query, but
  // the web search uses just the user's text query (or a short derived query)
  // to avoid sending a 1600+ char blob to Tavily (which returns no results).
  const searchQuery = searchQueryOverride || query;

  // Step 0: Classify the query for search routing
  const classification = classifyQuery(searchQuery);
  console.log(`[Quick] Query classified as: ${classification}`);

  // Step 1: Fast search (2 providers + classified extras, ~2-3s)
  console.log('[Quick] Searching...');
  const searchResults = await searchQuick(searchQuery, env, 10, classification);

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

async function deepResearch(query, env, apexModel = 'apex-free', searchQueryOverride = null) {
  const t0 = Date.now();

  // The search query is separate from the LLM context query. When an image
  // is attached, the LLM gets the full image description + user query, but
  // the web search uses just the user's text query (or a short derived query)
  // to avoid sending a 1600+ char blob to Tavily (which returns no results).
  const searchQuery = searchQueryOverride || query;

  // ── PHASE 0: Classify the query for search routing ──
  const classification = classifyQuery(searchQuery);
  console.log(`[Deep] Query classified as: ${classification}`);

  // ── PHASE 1: Search (3+ providers + classified extras, ~2.5-4s) ──
  console.log('[Deep] Phase 1: Searching...');
  const searchResults = await searchDeep(searchQuery, env, 15, classification);

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
  // Each part targets ~1,500 words; concatenated report lands at 2,500-3,500.
  const sections = [
    {
      name: 'part1',
      prompt: `You are KIVORA RESEARCH DEEP, a world-class research analyst. Write the FIRST HALF of a thorough research report. Target ~1,500 words. Truncation is the worst failure mode — finish every section cleanly.

CRITICAL RULES:
1. Cite every claim with [N] matching source numbers. Only cite a source you actually read.
2. Confidence language: "established" (2+ sources), "likely" (one source + reasoning), "uncertain" (speculative).
3. Reserve **bold** for genuinely critical terms (max 1-2 per paragraph). Do NOT bold entire sentences.
4. Do NOT invent statistics. If a number isn't in the sources, omit or phrase qualitatively.
5. No filler like "Based on the search results" — start with the finding.
6. Third person, neutral analytical tone — like a senior analyst's memo.
7. Use 1-2 tables in this half (1 in Context for key background data, 1 in Detailed Analysis for a CONSOLIDATED comparison). Each table MUST use proper markdown syntax with a separator row of | --- | between the header and body. Tables must carry information that bullets cannot.

FORMATTING (CRITICAL for readability — models often ignore this, so follow exactly):
- Put a ---  horizontal rule between every major section. This creates visual breathing room.
- Use bullet points with **bold lead-in** for findings:  - **Finding** — short explanation [N]
- For ranked items, use numbered list with bold + em-dash + descriptor:  1. **Item** — Best for X
- For sub-points, use  - **Label**: value  (e.g.  - **Mechanism**: ...,  - **Evidence**: ...,  - **Limitation**: ...)
- Keep paragraphs SHORT: 3-5 sentences max. Split dense paragraphs into smaller ones.
- One blank line between paragraphs and around --- dividers.
- For markdown tables, ALWAYS include the separator row of | --- | between the header row and body rows.

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
3-4 short paragraphs. Background the reader needs: history, key stakeholders, current state. Cite sources where possible. Include 1 table summarizing key background data (timeline, stakeholder matrix, or market data depending on topic).

---

## Detailed Analysis
3-5 thematic subsections. Use **bold subheading** for each theme, followed by 2-3 short paragraphs. Cover patterns, contradictions, and gaps in the evidence. End the section with 1 CONSOLIDATED comparison table that covers all themes/sub-themes together (do NOT add one table per sub-theme). Include specific examples and case studies where the sources support them.

Do NOT end with a ---  divider (the system adds one between parts). Do NOT include a Sources section. Do NOT write a Confidence Assessment (that comes in part 2).`,
    },
    {
      name: 'part2',
      prompt: `You are KIVORA RESEARCH DEEP, a world-class research analyst. Write the SECOND HALF of a thorough research report. Target ~1,500 words. Truncation is the worst failure mode — finish every section cleanly.

IMPORTANT HEADING LEVEL: Your output starts a NEW half of the report. Use ## (h2) for ALL major section headings — NOT ### (h3). The first line of your output MUST be exactly: ## Comparative Analysis

CRITICAL RULES:
1. Cite every claim with [N] matching source numbers. Only cite a source you actually read.
2. Confidence language: "established" (2+ sources), "likely" (one source + reasoning), "uncertain" (speculative).
3. Reserve **bold** for genuinely critical terms (max 1-2 per paragraph). Do NOT bold entire sentences.
4. Do NOT invent statistics. If a number isn't in the sources, omit or phrase qualitatively.
5. No filler. Third person, neutral analytical tone.
6. Use 1-3 tables in this half (1 in Comparative Analysis for the options matrix, optionally 1 in Risk & Opportunity for probability/impact, optionally 1 in Future Outlook for scenarios). Each table MUST use proper markdown syntax with a separator row of | --- | between the header and body.

FORMATTING (CRITICAL for readability — models often ignore this, so follow exactly):
- Put a ---  horizontal rule between every major section. This creates visual breathing room.
- Use bullet points with **bold lead-in** for findings:  - **Finding** — short explanation [N]
- For ranked items, use numbered list with bold + em-dash + descriptor:  1. **Item** — Best for X
- For sub-points, use  - **Label**: value  (e.g.  - **Mechanism**: ...,  - **Evidence**: ...,  - **Limitation**: ...)
- Keep paragraphs SHORT: 3-5 sentences max. Split dense paragraphs into smaller ones.
- One blank line between paragraphs and around --- dividers.
- For markdown tables, ALWAYS include the separator row of | --- | between the header row and body rows.

STRUCTURE (use these exact h2 headings — ## prefix required, NOT ###):

## Comparative Analysis
One table comparing 2-4 relevant options/frameworks/approaches (whatever the topic implies). 4-6 rows. Follow with 2-3 short paragraphs of analysis explaining the comparisons.

---

## Risk & Opportunity Assessment
- **Risk 1** — description [N]
- **Risk 2** — description [N]
- **Opportunity 1** — description [N]
- **Opportunity 2** — description [N]

Then 2-3 short paragraphs framing the risk/opportunity landscape. Include 1 table organizing risks and opportunities by probability/impact.

---

## Practical Recommendations
1. **Recommendation 1** — Specific action + expected outcome [N]
2. **Recommendation 2** — Specific action + expected outcome [N]
3. **Recommendation 3** — Specific action + expected outcome [N]
4. **Recommendation 4** — Specific action + expected outcome [N]
5. **Recommendation 5** — Specific action + expected outcome [N]

---

## Future Outlook
2-3 short paragraphs covering near-term (1-2 years), medium-term (3-5 years), and key signals to watch. Include 1 scenario table (optimistic / moderate / pessimistic).

---

## Confidence Assessment
Overall: High / Moderate / Low. Biggest uncertainty: ...

Do NOT include a Sources section — the sources list is shown separately in the UI. Keep [N] citations inline only.

FOLLOWUPS:
1. Specific, answerable follow-up question?
2. Specific, answerable follow-up question?
3. Specific, answerable follow-up question?`,
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

  // Combine all sections into one report — insert --- divider between parts
  // so the boundary between part1 and part2 reads as a normal section break.
  const rawReport = sectionResults.map(s => s.content).join('\n\n---\n\n');

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
        mistral: getMistralKey(env) ? `yes-${getMistralKey(env).length}chars` : 'no',
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
        version: '5.4.0',
        providers: {
          openrouter: !!getOpenRouterKey(env),
          gemini: !!getGeminiKey(env),
          mistral: !!getMistralKey(env),
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
        const { query, mode = 'quick', openrouter_key = '', mistral_key = '', apex_model = 'apex-free', attachedFile, attachedFiles } = body;

        // Normalize: support both `attachedFile` (single, legacy) and
        // `attachedFiles` (array, multi-upload). Merge into one array.
        const allFiles = [];
        if (Array.isArray(attachedFiles)) {
          allFiles.push(...attachedFiles.filter(f => f && f.content));
        }
        if (attachedFile && attachedFile.content && !allFiles.includes(attachedFile)) {
          allFiles.push(attachedFile);
        }

        // Allow either a query or at least one attached file.
        if ((!query || typeof query !== 'string' || query.trim().length === 0) && allFiles.length === 0) {
          return jsonRes({ error: 'Query or attached file is required' }, 400);
        }

        const safeQuery = (query || '').trim();
        if (safeQuery.length > 2000) {
          return jsonRes({ error: 'Query too long (max 2000 characters)' }, 400);
        }

        // Allow OpenRouter key to be passed per-request from Kivora
        // Per-request key always takes priority over Worker secret
        if (openrouter_key) {
          env.OPENROUTER_API_KEY = openrouter_key;
        }
        // Allow Mistral key to be passed per-request (used for vision / Pixtral)
        if (mistral_key) {
          env.MISTRAL_API_KEY = mistral_key;
        }

        // ── Process attached files ──
        // Images are described via a vision model (in parallel when multiple);
        // text files have their content inlined; binary documents are noted by
        // name+size. Multi-image: all descriptions are concatenated.
        let fileContext = '';
        let hasImage = false;
        let imageDescription = '';
        const imageFileNames = [];
        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

        if (allFiles.length > 0) {
          // Validate sizes first
          for (const f of allFiles) {
            const sz = f.size || 0;
            if (sz > MAX_FILE_SIZE) {
              return jsonRes({ error: `File too large (max ${MAX_FILE_SIZE / 1024 / 1024}MB): ${f.name || 'attachment'}` }, 400);
            }
          }

          // Process images in parallel for speed; text/binary sequentially (cheap)
          const imageFiles = allFiles.filter(f => (f.type || '').startsWith('image/'));
          const nonImageFiles = allFiles.filter(f => !(f.type || '').startsWith('image/'));

          if (imageFiles.length > 0) {
            hasImage = true;
            console.log(`[Research] ${imageFiles.length} image(s) detected — calling vision models in parallel...`);
            const t_v0 = Date.now();
            const descriptions = await Promise.all(
              imageFiles.map(f => describeImage(env, f.content, f.type || 'image/png').then(d => ({ name: f.name || 'image', desc: d })))
            );
            console.log(`[Research] Vision parallel done in ${Date.now()-t_v0}ms for ${imageFiles.length} image(s)`);
            const validDescs = descriptions.filter(d => d.desc);
            if (validDescs.length > 0) {
              imageDescription = validDescs.map(d => `=== ${d.name} ===\n${d.desc}`).join('\n\n');
              imageFileNames.push(...validDescs.map(d => d.name));
              fileContext = `[User attached ${validDescs.length} image(s): ${imageFileNames.join(', ')}]\nImage description(s):\n${imageDescription}\n\n`;
            } else {
              fileContext = `[User attached ${imageFiles.length} image(s) — vision analysis unavailable]\n\n`;
              console.error('[Research] All image descriptions failed');
            }
          }

          for (const f of nonImageFiles) {
            const fileName = f.name || 'attachment';
            const fileType = f.type || 'application/octet-stream';
            const fileSize = f.size || 0;
            if (isTextLikeFile(fileName, fileType)) {
              const textContent = f.content.startsWith('data:')
                ? decodeURIComponent(atob(f.content.split(',')[1] || ''))
                : f.content;
              const truncated = textContent.slice(0, 4000);
              fileContext += `[User attached a text file: ${fileName}]\nFile content:\n${truncated}${textContent.length > 4000 ? '\n... (truncated)' : ''}\n\n`;
              console.log(`[Research] Text file inlined: ${truncated.length} chars (${fileName})`);
            } else {
              fileContext += `[User attached a document: ${fileName} (${fileType}, ${fileSize} bytes) — content not extracted]\n\n`;
              console.log(`[Research] Binary document noted: ${fileName}`);
            }
          }
        }

        // ── Image Intelligence Pipeline ──
        // When at least one image is attached, route through the multi-pass
        // OSINT pipeline: vision → entity extraction → multi-query search →
        // final report with inline cross-reference.
        if (hasImage && imageDescription) {
          console.log('[Research] Routing to Image Intelligence pipeline...');
          const t_e0 = Date.now();
          const entities = await extractImageEntities(env, imageDescription, safeQuery);
          console.log(`[Research] Entities extracted in ${Date.now()-t_e0}ms — brands=${(entities.brand_names||[]).length}, queries=${(entities.search_queries||[]).length}, category=${entities.topic_category}`);

          const result = await imageIntelligenceResearch({
            userQuery: safeQuery,
            env,
            apexModel: apex_model,
            imageDescription,
            fileName: imageFileNames.length > 0 ? imageFileNames.join(', ') : 'image(s)',
            entities,
            mode,
          });

          if (result.error) {
            return jsonRes(result, 500);
          }
          return jsonRes(result);
        }

        // ── Standard research pipeline (text-only or text-attached file) ──
        const effectiveQuery = fileContext + (safeQuery || '(Analyze the attached file and provide insights.)');

        // Build a SEPARATE short search query for web search.
        let searchQuery = safeQuery;
        if (!searchQuery && allFiles.length > 0) {
          const firstTextFile = allFiles.find(f => isTextLikeFile(f.name || '', f.type || ''));
          if (firstTextFile) {
            // Use first 200 chars of text content as search query
            const textContent = firstTextFile.content.startsWith('data:')
              ? decodeURIComponent(atob(firstTextFile.content.split(',')[1] || ''))
              : firstTextFile.content;
            searchQuery = textContent.slice(0, 200).replace(/\s+/g, ' ').trim();
          } else {
            searchQuery = 'document analysis methodology';
          }
          console.log(`[Research] Derived search query from file: "${searchQuery.slice(0, 100)}"`);
        }
        if (!searchQuery) searchQuery = 'research analysis';

        console.log(`[Research] ${mode} mode: "${safeQuery || '(file only)'}", files: ${allFiles.length}, image: ${hasImage}, apex: ${apex_model}`);
        console.log(`[Research] Search query: "${searchQuery.slice(0, 150)}"`);
        console.log(`[Research] LLM context: ${effectiveQuery.length} chars`);

        const result = mode === 'deep'
          ? await deepResearch(effectiveQuery, env, apex_model, searchQuery)
          : await quickResearch(effectiveQuery, env, apex_model, searchQuery);

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
