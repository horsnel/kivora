/**
 * Cloudflare Pages Function: AI Content Generator
 * Generates reviews, analysis, guides, and opinions using AI.
 * Fetches relevant images from Pexels automatically.
 *
 * Configure via Cloudflare Pages Environment Variables:
 *   AI_API_KEY     - AI API key (e.g., Cerebras, Groq, OpenAI)
 *   AI_API_BASE    - API base URL (default: https://api.cerebras.ai/v1)
 *   AI_MODEL       - Model name (default: auto-detect)
 *   PEXELS_API_KEY - Pexels API key for auto images
 */

export async function onRequestPost(context) {
  try {
    const { topic, category, tone, length } = await context.request.json();

    if (!topic || topic.trim().length < 3) {
      return jsonResponse({ error: 'Please provide a topic (at least 3 characters)' }, 400);
    }

    const rawKey = context.env.AI_API_KEY || '';
    const apiBase = (context.env.AI_API_BASE || 'https://api.cerebras.ai/v1').replace(/\/+$/, '');
    const configuredModel = context.env.AI_MODEL || '';
    const pexelsKey = context.env.PEXELS_API_KEY || '';

    if (!rawKey) {
      return jsonResponse({
        error: 'AI API key not configured. Set AI_API_KEY in Cloudflare Pages environment variables.',
        hint: 'Go to Cloudflare Dashboard > Pages > your site > Settings > Environment variables'
      }, 503);
    }

    /* Strip invisible Unicode chars that break auth (same as Python script) */
    const apiKey = rawKey.replace(/[\u200b-\u200f\u2028-\u202e\ufeff\u00ad]/g, '').trim();

    /* === Auto-detect available models === */
    let availableModels = await getAvailableModels(apiKey, apiBase);
    let model = configuredModel;

    // If a model is configured, verify it exists
    if (model && availableModels.length > 0 && !availableModels.includes(model)) {
      console.log('Configured model not found, auto-detecting...');
      model = null;
    }

    // Pick best available model from preference list
    if (!model && availableModels.length > 0) {
      const MODEL_PREFERENCES = [
        'llama3.1-8b',
        'llama-3.3-70b',
        'qwen-3-235b-a22b-instruct-2507',
        'deepseek-r1-distill-llama-70b'
      ];
      for (const pref of MODEL_PREFERENCES) {
        if (availableModels.includes(pref)) {
          model = pref;
          break;
        }
      }
      if (!model) model = availableModels[0];
    }

    if (!model) model = 'llama3.1-8b'; // last resort default

    /* === Category Map === */
    const categoryMap = {
      'film-review': 'Film & TV Review',
      'entertainment': 'Arts & Culture',
      'personal-finance': 'Personal Finance',
      'market-analysis': 'Market Analysis',
      'business-strategy': 'Business Strategy',
      'technology': 'Tech & Innovation',
      'commentary': 'Expert Commentary'
    };

    /* === Tone/Style Map === */
    const toneMap = {
      'review': 'detailed review with clear verdict, pros/cons, and rating',
      'analysis': 'in-depth analytical breakdown with data-driven insights',
      'guide': 'practical how-to guide with actionable steps',
      'opinion': 'thought-provoking opinion editorial with strong perspective',
      'listicle': 'engaging numbered list/ranking format with short punchy entries',
      'feature': 'engaging long-form feature with storytelling'
    };

    const lengthMap = {
      'short': '300-400 words',
      'medium': '600-800 words',
      'long': '1200-1500 words'
    };

    const catLabel = categoryMap[category] || 'Analysis';
    const toneLabel = toneMap[tone] || 'informative analysis style';
    const lengthLabel = lengthMap[length] || '600-800 words';

    /* === System Prompt — plain markdown output (like the Python script) === */
    const systemPrompt = `You are a senior content creator for MenshlyGlobal, a premium international media platform. You write reviews, analysis, opinions, guides, and commentary — never breaking news.

Rules:
- Style: ${toneLabel}
- Target length: ${lengthLabel}
- Category: ${catLabel}
- Include a compelling headline (max 15 words)
- Include a 1-2 sentence summary, then use ## subheadings for the body
- Write in HTML using <h2>, <p>, <blockquote>, <ul>, <li> tags for the body
- Be specific with concrete examples, numbers, and real-world references
- End with a clear conclusion or actionable takeaway

OUTPUT FORMAT — you MUST follow this exactly:
Line 1: The article title (no # prefix)
Line 2: empty
Line 3-4: The summary (1-2 sentences)
Then: the article body using <h2>, <p>, <ul>, <li>, <blockquote> HTML tags`;

    const userPrompt = `Write a ${catLabel} piece about: "${topic}"`;

    /* === Call AI API — plain text mode only (more reliable across models) === */
    let rawContent = null;

    // Build list of models to try: chosen model first, then all available
    let modelsToTry = [model];
    if (availableModels.length > 0) {
      for (const m of availableModels) {
        if (m !== model) modelsToTry.push(m);
      }
    }

    for (const tryModel of modelsToTry) {
      try {
        const aiResponse = await fetch(apiBase + '/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + apiKey
          },
          body: JSON.stringify({
            model: tryModel,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt }
            ],
            max_tokens: 4000,
            temperature: 0.75
          })
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content;
          if (content && content.length > 100) {
            rawContent = content;
            model = tryModel;
            break;
          }
        }
        // 404 = model not found, skip to next
        if (aiResponse.status === 404) continue;
        // 401 = auth error, stop
        if (aiResponse.status === 401) {
          return jsonResponse({
            error: 'Authentication failed (401). Check AI_API_KEY in Cloudflare env vars.'
          }, 500);
        }
        // 422/400 = bad request, try next model
        continue;
      } catch (e) { continue; }
    }

    if (!rawContent) {
      return jsonResponse({
        error: 'Could not generate content with any available model.',
        hint: 'Models tried: ' + modelsToTry.slice(0, 5).join(', '),
        tried: modelsToTry
      }, 500);
    }

    /* === Parse response — handle multiple formats === */
    let article = parseAiResponse(rawContent, topic, catLabel);

    article.id = 'ai-' + Date.now();
    article.topic = topic;
    article.tone = tone;
    article.category = catLabel;
    article.generatedAt = new Date().toISOString();
    article.readTime = Math.max(2, Math.ceil((article.content || '').split(/\s+/).length / 200));

    /* === Fetch Image from Pexels === */
    if (pexelsKey) {
      try {
        const searchQuery = buildImageQuery(topic, category);
        const imgResponse = await fetch('https://api.pexels.com/v1/search?query=' + encodeURIComponent(searchQuery) + '&per_page=1&orientation=landscape', {
          headers: { 'Authorization': pexelsKey }
        });
        if (imgResponse.ok) {
          const imgData = await imgResponse.json();
          if (imgData.photos && imgData.photos.length > 0) {
            const photo = imgData.photos[0];
            article.image = photo.src.large;
            article.imageThumb = photo.src.medium;
            article.imageCredit = photo.photographer;
            article.imageLink = photo.photographer_url;
          }
        }
      } catch (imgErr) {
        // Image fetch failed — article is still valid
      }
    }

    return jsonResponse(article, 200);

  } catch (err) {
    return jsonResponse({ error: 'Server error: ' + (err.message || 'Unknown error') }, 500);
  }
}

/* === Response Parser — handles title/summary/body plain text + JSON === */
function parseAiResponse(raw, topic, catLabel) {
  // Format 1: Clean JSON (some models still return JSON)
  try {
    const parsed = JSON.parse(raw);
    if (parsed.title && parsed.content && parsed.content.length >= 100) {
      if (/<h[1-6]|<p|<div/i.test(parsed.content)) {
        return parsed;
      }
      return {
        title: parsed.title,
        summary: parsed.summary || '',
        category: parsed.category || catLabel,
        content: ensureHtml(parsed.content)
      };
    }
  } catch (e) {}

  // Format 2: JSON in code block
  const codeBlockMatch = raw.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1]);
      if (parsed.title && parsed.content && parsed.content.length >= 100) {
        return {
          title: parsed.title,
          summary: parsed.summary || '',
          category: parsed.category || catLabel,
          content: ensureHtml(parsed.content)
        };
      }
    } catch (e) {}
  }

  // Format 3: Plain text — first line = title, next lines = summary, rest = body
  const cleaned = raw.trim().replace(/^```\w*\s*/, '').replace(/\s*```$/, '');
  if (cleaned.length >= 200) {
    const lines = cleaned.split('\n');
    let title = lines[0].trim().replace(/^#{1,6}\s+/, '');

    let summary = '';
    let bodyStartLine = 1;
    const summaryLines = [];
    for (let i = 1; i < Math.min(lines.length, 8); i++) {
      const line = lines[i].trim();
      if (line.startsWith('<h') || line.startsWith('<p') || line.startsWith('<div')) {
        bodyStartLine = i;
        break;
      }
      if (line === '') {
        if (summaryLines.length > 0) { bodyStartLine = i + 1; break; }
        continue;
      }
      summaryLines.push(line);
    }
    summary = summaryLines.join(' ').substring(0, 300);
    const body = lines.slice(bodyStartLine).join('\n').trim();

    if (body.length >= 150) {
      return {
        title: title || topic,
        summary: summary || topic,
        category: catLabel,
        content: ensureHtml(body)
      };
    }
  }

  // Format 4: Last resort
  return {
    title: topic,
    summary: cleaned.substring(0, 200),
    category: catLabel,
    content: '<p>' + cleaned.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>') + '</p>'
  };
}

/* Extract title from first heading or first meaningful line */
function extractTitle(lines, fallback) {
  for (const line of lines) {
    const match = line.match(/^#{1,3}\s+(.+)/);
    if (match) return match[1].trim();
  }
  return fallback;
}

/* Ensure content has HTML tags (convert basic markdown) */
function ensureHtml(text) {
  if (!text) return '';
  // If it already has HTML tags, return as-is
  if (/<h[1-6]|<p|<div|<br/i.test(text)) return text;
  // Convert markdown to HTML
  let html = text;
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');
  html = html.replace(/^[-*] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/\n\n/g, '</p><p>');
  html = '<p>' + html + '</p>';
  html = html.replace(/<p>\s*<\/p>/g, '');
  html = html.replace(/<p>\s*(<h[23]>)/g, '$1');
  html = html.replace(/(<\/h[23]>)\s*<\/p>/g, '$1');
  return html;
}

/* === Get available models from API === */
async function getAvailableModels(apiKey, apiBase) {
  try {
    const resp = await fetch(apiBase + '/models', {
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'User-Agent': 'MenshlyGlobal/1.0'
      }
    });
    if (!resp.ok) {
      console.log('Model list failed:', resp.status);
      return [];
    }
    const data = await resp.json();
    const models = (data.data || []).map(m => m.id);
    console.log('Available models:', models.join(', '));
    return models;
  } catch (e) {
    console.log('Model detection failed:', e.message);
    return [];
  }
}

/* Build a search query for Pexels based on topic + category */
function buildImageQuery(topic, category) {
  const categoryKeywords = {
    'film-review': 'cinema movie film',
    'entertainment': 'entertainment culture music',
    'personal-finance': 'finance money business',
    'market-analysis': 'business charts data analytics',
    'business-strategy': 'business office corporate',
    'technology': 'technology digital innovation',
    'commentary': 'analysis thought leadership'
  };
  const prefix = categoryKeywords[category] || 'media';
  const topicWords = topic.split(/\s+/).slice(0, 4).join(' ');
  return prefix + ' ' + topicWords;
}

/* Handle CORS preflight */
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

/* === Helpers === */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
