/**
 * Cloudflare Pages Function: AI Content Generator
 * Generates reviews, analysis, guides, and opinions using AI.
 * Fetches relevant images from Pexels automatically.
 *
 * Configure via Cloudflare Pages Environment Variables:
 *   AI_API_KEY     - AI API key (e.g., Cerebras, Groq, OpenAI)
 *   AI_API_BASE    - API base URL (default: https://api.cerebras.ai/v1)
 *   AI_MODEL       - Model name (default: llama-3.3-70b)
 *   PEXELS_API_KEY - Pexels API key for auto images
 */

export async function onRequestPost(context) {
  try {
    const { topic, category, tone, length } = await context.request.json();

    if (!topic || topic.trim().length < 3) {
      return new Response(JSON.stringify({
        error: 'Please provide a topic (at least 3 characters)'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const apiKey = context.env.AI_API_KEY || '';
    const apiBase = (context.env.AI_API_BASE || 'https://api.cerebras.ai/v1').replace(/\/+$/, '');
    const model = context.env.AI_MODEL || 'llama-3.3-70b';
    const pexelsKey = context.env.PEXELS_API_KEY || '';

    if (!apiKey) {
      return new Response(JSON.stringify({
        error: 'AI API key not configured. Set AI_API_KEY in Cloudflare Pages environment variables.',
        hint: 'Go to Cloudflare Dashboard > Pages > your site > Settings > Environment variables'
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

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

    /* === System Prompt — NO NEWS, ONLY REVIEWS/ANALYSIS === */
    const systemPrompt = `You are a content creator for MenshlyGlobal, a premium international media platform. You write ONLY the following types of content: reviews, analysis, opinions, guides, and commentary. You NEVER write breaking news, factual news reporting, or time-sensitive news articles.

CRITICAL RULES:
- Write in ${toneLabel} style
- Target length: ${lengthLabel}
- Category: ${catLabel}
- This is an OPINION/REVIEW piece, not a news article
- Include a compelling, SEO-friendly headline (max 15 words)
- Include a 1-2 sentence summary/standfirst
- Use subheadings (<h2> tags) for structure
- For movie reviews: include a rating out of 10, pros/cons, and final verdict
- For money ideas: include estimated startup costs, difficulty level, and income potential
- For business stats: include relevant data points, percentages, and trends
- For guides: include numbered steps, tips, and common mistakes to avoid
- Be specific — use concrete examples, numbers, and real-world references
- Never claim to report facts that need verification — this is analysis/opinion only
- End with a clear conclusion or actionable takeaway
- Format: Return JSON with keys: "title" (string), "summary" (string), "category" (string), "content" (string with HTML <h2>, <p>, <blockquote>, <ul>, <li> tags)`;

    const userPrompt = `Write a ${catLabel} piece about: "${topic}"`;

    /* === Call AI API === */
    const aiResponse = await fetch(apiBase + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 3000,
        temperature: 0.75,
        response_format: { type: 'json_object' }
      })
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      let errMsg = 'AI API returned status ' + aiResponse.status;
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson.error?.message || errMsg;
      } catch (e) {}
      return new Response(JSON.stringify({ error: errMsg }), {
        status: aiResponse.status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content;

    if (!rawContent) {
      return new Response(JSON.stringify({
        error: 'AI returned empty response. Try a different topic.'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    let article;
    try {
      article = JSON.parse(rawContent);
    } catch (e) {
      article = {
        title: topic,
        summary: rawContent.substring(0, 200),
        category: catLabel,
        content: '<p>' + rawContent.replace(/\n\n/g, '</p><p>') + '</p>'
      };
    }

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
        // Image fetch failed — article is still valid without it
      }
    }

    return new Response(JSON.stringify(article), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });

  } catch (err) {
    return new Response(JSON.stringify({
      error: 'Server error: ' + (err.message || 'Unknown error')
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
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
  // Take first 3-4 words from topic for the search
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
