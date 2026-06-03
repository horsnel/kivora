// ══════════════════════════════════════════════════════════════════
// KIVORA RESEARCH WORKER — Cloudflare Worker
// Full research pipeline: multi-source search → deep read → LLM synthesis
// Produces LONG, DETAILED reports with multiple tables and sections
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
function getBraveKey(env) {
  return env.BRAVE_SEARCH_API_KEY || '';
}

// ══════════════════════════════════════════════════════════════════
// SEARCH PROVIDERS
// ══════════════════════════════════════════════════════════════════

async function searchTavily(query, env, maxResults = 10) {
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getTavilyKey(env)}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query,
        search_depth: 'advanced',
        include_answer: true,
        max_results: maxResults,
        include_raw_content: false,
      }),
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

async function searchBrave(query, env, count = 10) {
  const key = getBraveKey(env);
  if (!key) return [];
  try {
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`, {
      headers: { 'X-Subscription-Token': key, 'Accept': 'application/json' },
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

async function searchDuckDuckGo(query) {
  try {
    const res = await fetch(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`,
      { headers: { 'Accept': 'application/json' } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const results = [];
    if (data.Abstract) {
      results.push({ title: data.Heading || query, url: data.AbstractURL || '', snippet: data.Abstract, score: 0 });
    }
    if (data.RelatedTopics) {
      for (const topic of data.RelatedTopics.slice(0, 8)) {
        if (topic.Text && topic.FirstURL) {
          results.push({ title: topic.Text.slice(0, 80), url: topic.FirstURL, snippet: topic.Text, score: 0 });
        }
      }
    }
    return results;
  } catch {
    return [];
  }
}

async function searchWikipedia(query) {
  try {
    const searchRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`,
      { headers: { 'Accept': 'application/json' } }
    );
    if (!searchRes.ok) return [];
    const searchData = await searchRes.json();
    const results = [];
    for (const item of (searchData.query?.search || []).slice(0, 3)) {
      try {
        const summaryRes = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(item.title)}`);
        if (summaryRes.ok) {
          const summary = await summaryRes.json();
          results.push({
            title: summary.title || item.title,
            url: summary.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(item.title)}`,
            snippet: summary.extract || item.snippet?.replace(/<[^>]*>/g, ''),
            score: 0,
          });
        }
      } catch {}
    }
    return results;
  } catch {
    return [];
  }
}

// ── Parallel multi-source search ──
async function searchAll(query, env, maxSources = 20) {
  const [tavilyResults, braveResults, ddgResults, wikiResults] = await Promise.all([
    searchTavily(query, env, 10),
    searchBrave(query, env, 10),
    searchDuckDuckGo(query),
    searchWikipedia(query),
  ]);

  // Merge and deduplicate by URL
  const seen = new Set();
  const all = [];
  for (const r of [...tavilyResults, ...braveResults, ...ddgResults, ...wikiResults]) {
    const key = r.url.toLowerCase().replace(/\/+$/, '');
    if (key && !seen.has(key)) {
      seen.add(key);
      all.push(r);
    }
  }

  return all.slice(0, maxSources);
}

// ══════════════════════════════════════════════════════════════════
// URL READER (Jina Reader — free, no key needed)
// ══════════════════════════════════════════════════════════════════

async function readUrl(url) {
  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { 'Accept': 'text/markdown', 'X-Return-Format': 'markdown' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const text = await res.text();
    return text.slice(0, 20000); // Allow longer content for deep research
  } catch {
    return null;
  }
}

async function readUrls(urls, maxParallel = 5) {
  const results = [];
  // Process in batches to avoid overwhelming Jina
  for (let i = 0; i < urls.length; i += maxParallel) {
    const batch = urls.slice(i, i + maxParallel);
    const batchResults = await Promise.all(batch.map(url => readUrl(url)));
    for (let j = 0; j < batchResults.length; j++) {
      if (batchResults[j]) {
        results.push({ url: batch[j], content: batchResults[j] });
      }
    }
  }
  return results;
}

// ══════════════════════════════════════════════════════════════════
// LLM CALLS
// ══════════════════════════════════════════════════════════════════

// Primary: OpenRouter (supports many models)
async function openrouterChat(env, messages, model = 'google/gemini-2.5-flash', maxTokens = 8192) {
  const apiKey = getOpenRouterKey(env);
  if (!apiKey) return null;

  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://kivora.pages.dev',
        'X-Title': 'Kivora Research',
      },
      body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: maxTokens }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error('[OpenRouter] error:', res.status, text.slice(0, 200));
      return null;
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
  } catch (err) {
    console.error('[OpenRouter] exception:', err.message);
    return null;
  }
}

// Fallback: Workers AI (free, built-in binding)
async function workersAiChat(env, messages, model = '@cf/meta/llama-3.3-70b-instruct-fp8-fast', maxTokens = 4096) {
  if (!env.AI) return null;
  try {
    const response = await env.AI.run(model, {
      messages,
      max_tokens: maxTokens,
    });
    return response?.response || null;
  } catch (err) {
    console.error('[WorkersAI] exception:', err.message);
    return null;
  }
}

// Unified LLM call with intelligent provider selection
async function llmChat(env, messages, model = 'google/gemini-2.5-flash', maxTokens = 8192) {
  const openRouterKey = getOpenRouterKey(env);

  // If OpenRouter key is available, try it first (more model choices)
  if (openRouterKey) {
    const result = await openrouterChat(env, messages, model, maxTokens);
    if (result) return result;
    console.log('[LLM] OpenRouter failed, falling back to Workers AI');
  }

  // Workers AI — always available as primary or fallback
  // Use the best available model
  const workersAiModels = [
    '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
    '@cf/qwen/qwen3-30b-a3b-fp8',
    '@cf/mistralai/mistral-small-3.1-24b-instruct',
    '@cf/meta/llama-3.1-8b-instruct-fp8',
  ];

  for (const m of workersAiModels) {
    const result = await workersAiChat(env, messages, m, Math.min(maxTokens, 4096));
    if (result) return result;
    console.log(`[WorkersAI] ${m} failed, trying next model...`);
  }

  throw new Error('All LLM providers failed');
}

// ══════════════════════════════════════════════════════════════════
// PROMPTS — THE KEY TO LONG, DETAILED OUTPUT
// ══════════════════════════════════════════════════════════════════

const QUICK_SYSTEM_PROMPT = `You are KIVORA RESEARCH, an elite research synthesis engine that produces comprehensive, evidence-backed reports. Your reports are known for their depth, precision, and actionable insights.

CRITICAL RULES:
1. EVERY factual claim MUST cite a source using [N] notation matching the source numbers provided.
2. Use calibrated confidence language: "Established" (2+ independent sources), "Likely" (strong evidence), "Possible" (some evidence), "Uncertain" (weak/conflicting).
3. Your output MUST be at least 2000 words. This is NON-NEGOTIABLE.
4. You MUST include at least 1-3 markdown tables in your report.
5. Do NOT write filler. Every sentence must carry information.
6. Do NOT say "Based on the search results" or "According to the sources". Start directly with information.

REQUIRED OUTPUT STRUCTURE (markdown):

## Executive Summary
3-5 sentence overview of the most important findings. Include the "so what" — why this matters.

## Key Findings
Present 5-7 findings in a markdown table:
| # | Finding | Evidence Strength | Key Source | Implication |
|---|---------|------------------|------------|-------------|
| 1 | ... | Strong/Moderate/Weak | [N] | ... |

Then write 2-3 paragraphs elaborating on the most important findings, cross-referencing sources.

## Detailed Analysis
Write 3-5 substantial paragraphs providing deep analysis. Cover:
- The main themes and patterns across sources
- Contradictions or disagreements between sources
- Important context that shapes the findings
- Methodological considerations or limitations in the evidence
Each paragraph should be 5-8 sentences long and cite specific sources.

## Comparison Table
Create a comparison table relevant to the topic. For example, if comparing technologies, approaches, frameworks, or perspectives:
| Category | Option A | Option B | Option C |
|----------|----------|----------|----------|
| ... | ... | ... | ... |

Include at least 4 rows in the table.

## Practical Implications
Write 2-3 paragraphs about what these findings mean in practice. Include:
- Who should care about this and why
- What actions or decisions these findings support
- What to watch for or be cautious about

## Confidence Assessment
Rate overall confidence: [High / Moderate / Low]
Justify in 2-3 sentences with specific evidence references.

## Sources
Numbered list with URLs.

After the Sources section, suggest 3-5 follow-up research questions:
FOLLOWUPS:
1. Question one?
2. Question two?
3. Question three?

Write at LEAST 2000 words. Be thorough, precise, and intellectually honest.`;

const DEEP_SYSTEM_PROMPT = `You are KIVORA RESEARCH DEEP, a world-class research analyst that produces publication-quality, comprehensive research reports. Your output is comparable to McKinsey briefings or Stanford literature reviews — dense with evidence, rich with analysis, and structured for decision-making.

CRITICAL RULES:
1. EVERY factual claim MUST cite a source using [N] notation matching the source numbers provided.
2. Use calibrated confidence language: "Established" (2+ independent sources), "Likely" (strong evidence), "Possible" (some evidence), "Uncertain" (weak/conflicting), "Speculative" (inference without direct evidence).
3. Your output MUST be at least 5000 words. This is NON-NEGOTIABLE. Write a truly comprehensive report.
4. You MUST include at least 3-5 markdown tables throughout the report.
5. Include code examples, frameworks, or models where relevant.
6. Do NOT write filler. Every sentence must carry information.
7. Do NOT say "Based on the search results" or "According to the sources". Start directly with information.
8. Think like a senior analyst: identify patterns, synthesize across sources, challenge assumptions, provide strategic insight.

REQUIRED OUTPUT STRUCTURE (markdown):

## Executive Summary
5-8 sentence overview covering: (1) what the research found, (2) why it matters, (3) what the reader should do about it. Include a confidence rating.

## Key Findings
Present 8-12 findings in a markdown table:
| # | Finding | Evidence Strength | Confidence | Key Sources | Implication |
|---|---------|------------------|------------|-------------|-------------|
| 1 | ... | Strong/Moderate/Weak | Established/Likely/... | [N], [N] | ... |

Then write 3-4 paragraphs elaborating on the most critical findings with cross-source analysis.

## Foundational Context
Write 4-6 paragraphs establishing the foundational context for this topic. Cover:
- Historical background and evolution of the topic
- Current state of the art / current landscape
- Key stakeholders and their positions
- Market / field size and growth trajectory where applicable
- Regulatory, social, or economic factors shaping the landscape
Each paragraph should be 5-8 sentences with source citations.

## Detailed Analysis
Write 6-10 paragraphs providing deep, structured analysis. Organize by major themes or dimensions:
- **Theme 1**: 2-3 paragraphs with evidence and analysis
- **Theme 2**: 2-3 paragraphs with evidence and analysis
- **Theme 3**: 2-3 paragraphs with evidence and analysis
Identify and explain:
- Patterns across sources
- Contradictions and how to resolve them
- Gaps in the evidence
- Methodological limitations
- Emerging trends not yet fully supported by evidence

## Comparative Analysis
Create 2-3 detailed comparison tables relevant to the topic:

### Table 1: [Relevant comparison title]
| Dimension | Option A | Option B | Option C | Option D |
|-----------|----------|----------|----------|----------|
| ... | ... | ... | ... | ... |

### Table 2: [Another relevant comparison]
| Factor | Approach 1 | Approach 2 | Approach 3 |
|--------|------------|------------|------------|
| ... | ... | ... | ... |

Each table should have at least 5 rows. Add brief analysis paragraphs after each table.

## Frameworks & Models
If applicable, present a framework, mental model, or decision tree that helps the reader think about this topic systematically. Include:
- A visual structure (using markdown tables or bullet hierarchies)
- Explanation of each component
- How to apply it
- Code examples if the topic is technical

## Active Debates & Conflicting Evidence
Identify 2-4 active debates or areas of conflicting evidence:
| Debate | Position A | Position B | Evidence For A | Evidence For B | Resolution |
|--------|-----------|-----------|----------------|----------------|------------|
| ... | ... | ... | [N] | [N] | ... |

Write a paragraph for each debate analyzing the evidence on both sides.

## Risk & Opportunity Assessment
| Category | Risk/Opportunity | Likelihood | Impact | Mitigation/Leverage |
|----------|-----------------|------------|--------|---------------------|
| Risk | ... | High/Med/Low | High/Med/Low | ... |
| Opportunity | ... | High/Med/Low | High/Med/Low | ... |

Include at least 6 rows (3 risks + 3 opportunities). Write 2-3 paragraphs of analysis.

## Practical Recommendations
Provide 5-7 specific, actionable recommendations with:
- What to do
- Why (evidence-based justification)
- How to implement
- What to watch for

## Future Outlook
Write 3-4 paragraphs on:
- Where this field/topic is heading
- Emerging signals to watch
- Potential disruptions
- Timeline expectations

## Confidence Assessment
Provide a nuanced confidence assessment:
- Overall confidence: [High / Moderate / Low]
- Confidence by section with brief justification
- Key uncertainties that could change conclusions
- What additional research would improve confidence

## Sources
Numbered list with URLs and brief quality note for each.

After the Sources section, suggest 5-7 follow-up research questions:
FOLLOWUPS:
1. Question one?
2. Question two?
3. Question three?
4. Question four?
5. Question five?

Write at LEAST 5000 words. Be exhaustive, rigorous, and insightful. This is a DEEP research report — treat it as such.`;

const GAP_ANALYSIS_PROMPT = `You are a research gap analyst. Given the research query and the sources found so far, identify 2-3 specific knowledge gaps — things that are NOT well-covered by the current sources but would be important for a comprehensive report.

Return your response as a JSON array of objects:
[{"gap": "description of the knowledge gap", "search_query": "specific search query to fill this gap"}]

Return ONLY valid JSON, no other text.`;

// ══════════════════════════════════════════════════════════════════
// MARKDOWN → HTML CONVERTER (with full table support)
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
    html += '<div class="overflow-x-auto my-4"><table class="w-full text-sm border-collapse">';
    for (let i = 0; i < tableRows.length; i++) {
      const cells = tableRows[i];
      const tag = i === 0 ? 'th' : 'td';
      const bgClass = i === 0 ? 'bg-[#1a1a1a] text-white font-semibold' : (i % 2 === 0 ? 'bg-[#0f0f0f]' : '');
      html += '<tr>';
      for (const cell of cells) {
        const width = `${Math.floor(100 / cells.length)}%`;
        html += `<${tag} class="border border-[#262626] px-3 py-2 ${bgClass}" style="width:${width}">${renderInline(cell.trim())}</${tag}>`;
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

    // Table detection
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      flushList();
      // Check if this is a separator row (|---|---|)
      if (/^\|[\s\-:]+\|/.test(line.trim())) {
        // Skip separator rows — we already captured headers
        continue;
      }
      const cells = line.split('|').slice(1, -1); // Remove empty first/last from split
      tableRows.push(cells);
      inTable = true;
      continue;
    } else if (inTable) {
      flushTable();
    }

    // Headers
    if (line.startsWith('### ')) { flushList(); html += `<h3 class="text-base font-semibold text-white mt-5 mb-2">${renderInline(line.slice(4))}</h3>`; continue; }
    if (line.startsWith('## ')) { flushList(); html += `<h2 class="text-lg font-semibold text-white mt-6 mb-2.5">${renderInline(line.slice(3))}</h2>`; continue; }
    if (line.startsWith('# ')) { flushList(); html += `<h1 class="text-xl font-bold text-white mt-4 mb-3">${renderInline(line.slice(2))}</h1>`; continue; }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) { flushList(); html += '<hr class="border-[#1a1a1a] my-4" />'; continue; }

    // Unordered list
    if (/^[-*]\s/.test(line)) {
      if (inList && listType !== 'ul') flushList();
      inList = true;
      listType = 'ul';
      listItems.push(line.replace(/^[-*]\s/, ''));
      continue;
    }

    // Ordered list
    if (/^\d+\.\s/.test(line)) {
      if (inList && listType !== 'ol') flushList();
      inList = true;
      listType = 'ol';
      listItems.push(line.replace(/^\d+\.\s/, ''));
      continue;
    }

    // Empty line
    if (!line.trim()) { flushList(); continue; }

    // Regular paragraph
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
  const match = text.match(/FOLLOWUPS:\s*\n([\s\S]*?)$/i);
  if (match) {
    const followupText = match[1];
    const followups = followupText
      .split('\n')
      .map(line => line.replace(/^\d+\.\s*/, '').trim())
      .filter(q => q.length > 0 && q.endsWith('?'));
    const report = text.replace(/FOLLOWUPS:\s*\n[\s\S]*$/i, '').trim();
    return { report, followups };
  }
  return { report: text, followups: [] };
}

// ══════════════════════════════════════════════════════════════════
// MAIN RESEARCH PIPELINE
// ══════════════════════════════════════════════════════════════════

async function quickResearch(query, env) {
  // Step 1: Search multiple sources
  const searchResults = await searchAll(query, env, 15);

  if (searchResults.length === 0) {
    return { error: 'No sources found. Please try a different query.' };
  }

  // Step 2: Format sources for the LLM
  const sourcesContext = searchResults.map((s, i) =>
    `[${i + 1}] ${s.title}\nURL: ${s.url}\n${s.snippet}`
  ).join('\n\n');

  // Step 3: Generate report
  const userContent = `Research query: "${query}"\n\nSearch results:\n${sourcesContext}`;

  const rawReport = await llmChat(env, [
    { role: 'system', content: QUICK_SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ], 'google/gemini-2.5-flash', 8192);

  // Step 4: Process report
  const { report, followups } = extractFollowups(rawReport);
  const content = markdownToHtml(report);

  // Generate title
  const titleMatch = report.match(/^#\s+(.+)$/m) || report.match(/^##\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].replace(/[*_]/g, '') : query;

  // Format sources for the frontend
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

async function deepResearch(query, env) {
  // ── PHASE 1: Initial broad search ──
  console.log('[Deep] Phase 1: Initial search');
  const searchResults = await searchAll(query, env, 20);

  if (searchResults.length === 0) {
    return { error: 'No sources found. Please try a different query.' };
  }

  // ── PHASE 2: Deep read top sources ──
  console.log('[Deep] Phase 2: Reading top sources');
  const topUrls = searchResults
    .filter(s => s.url && s.url.startsWith('http'))
    .slice(0, 8)
    .map(s => s.url);

  const deepContents = await readUrls(topUrls, 4);

  // Mark deep-read sources
  const sources = searchResults.map((s, i) => ({
    id: i,
    url: s.url,
    title: s.title || `Source ${i + 1}`,
    snippet: s.snippet?.slice(0, 200) || '',
    favicon: '',
    status: deepContents.some(dc => dc.url === s.url) ? 'deep' : 'loaded',
  }));

  // ── PHASE 3: Gap analysis ──
  console.log('[Deep] Phase 3: Gap analysis');
  const sourcesContext = searchResults.map((s, i) =>
    `[${i + 1}] ${s.title}\nURL: ${s.url}\n${s.snippet}`
  ).join('\n\n');

  const deepContext = deepContents.map(dc =>
    `--- FULL CONTENT FROM ${dc.url} ---\n${dc.content.slice(0, 8000)}`
  ).join('\n\n');

  let gapResults = [];
  try {
    const gapResponse = await llmChat(env, [
      { role: 'system', content: GAP_ANALYSIS_PROMPT },
      { role: 'user', content: `Research query: "${query}"\n\nCurrent sources:\n${sourcesContext}` },
    ], 'google/gemini-2.5-flash-lite', 1024);

    if (gapResponse) {
      const jsonMatch = gapResponse.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        gapResults = JSON.parse(jsonMatch[0]);
      }
    }
  } catch (err) {
    console.error('[Deep] Gap analysis failed:', err.message);
  }

  // ── PHASE 4: Search for gaps ──
  console.log('[Deep] Phase 4: Searching gaps', gapResults.length);
  let gapSources = [];
  let gapContents = [];

  if (gapResults.length > 0) {
    const gapSearches = await Promise.all(
      gapResults.slice(0, 3).map(gap => searchAll(gap.search_query, env, 5))
    );

    for (let i = 0; i < gapSearches.length; i++) {
      for (const r of gapSearches[i]) {
        const existingIdx = sources.findIndex(s => s.url === r.url);
        if (existingIdx === -1) {
          const newIdx = sources.length;
          sources.push({
            id: newIdx,
            url: r.url,
            title: r.title || `Gap Source ${newIdx + 1}`,
            snippet: r.snippet?.slice(0, 200) || '',
            favicon: '',
            status: 'loaded',
          });
          gapSources.push({ ...r, index: newIdx });
        }
      }
    }

    // Read top gap sources
    const gapUrls = gapSources.filter(s => s.url?.startsWith('http')).slice(0, 4).map(s => s.url);
    gapContents = await readUrls(gapUrls, 3);
  }

  // ── PHASE 5: Build comprehensive context and generate report ──
  console.log('[Deep] Phase 5: Generating deep report');

  const allSourcesContext = sources.map((s, i) =>
    `[${i + 1}] ${s.title}\nURL: ${s.url}\n${s.snippet}`
  ).join('\n\n');

  const allDeepContent = [
    ...deepContents.map(dc => `--- FULL CONTENT FROM ${dc.url} ---\n${dc.content.slice(0, 8000)}`),
    ...gapContents.map(dc => `--- ADDITIONAL CONTENT FROM ${dc.url} ---\n${dc.content.slice(0, 6000)}`),
  ].join('\n\n');

  const gapDescription = gapResults.length > 0
    ? `\n\nKNOWLEDGE GAPS IDENTIFIED (address these in your report):\n${gapResults.map((g, i) => `${i + 1}. ${g.gap}`).join('\n')}`
    : '';

  const userContent = `Research query: "${query}"${gapDescription}\n\nSEARCH RESULTS:\n${allSourcesContext}\n\nDEEP SOURCE CONTENT:\n${allDeepContent}`;

  const rawReport = await llmChat(env, [
    { role: 'system', content: DEEP_SYSTEM_PROMPT },
    { role: 'user', content: userContent },
  ], 'google/gemini-2.5-pro', 16384);

  // Step 6: Process report
  const { report, followups } = extractFollowups(rawReport);
  const content = markdownToHtml(report);

  const titleMatch = report.match(/^#\s+(.+)$/m) || report.match(/^##\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].replace(/[*_]/g, '') : query;

  return { sources, report, content, title, followups, mode: 'deep' };
}

// ══════════════════════════════════════════════════════════════════
// WORKER ENTRY POINT
// ══════════════════════════════════════════════════════════════════

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/health') {
      return jsonRes({
        status: 'ok',
        service: 'kivora-research',
        version: '1.0.0',
        providers: {
          openrouter: !!getOpenRouterKey(env),
          workers_ai: !!env.AI,
          tavily: !!getTavilyKey(env),
          brave: !!getBraveKey(env),
        },
      });
    }

    // Main research endpoint
    if (url.pathname === '/research' && request.method === 'POST') {
      try {
        const { query, mode = 'quick' } = await request.json();

        if (!query || typeof query !== 'string') {
          return jsonRes({ error: 'Query is required' }, 400);
        }

        if (query.length > 2000) {
          return jsonRes({ error: 'Query too long (max 2000 characters)' }, 400);
        }

        console.log(`[Research] ${mode} mode: "${query}"`);

        const result = mode === 'deep'
          ? await deepResearch(query, env)
          : await quickResearch(query, env);

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
