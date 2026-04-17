/**
 * Cloudflare Pages Function: AI Article Generator
 * Generates news articles using AI via OpenAI-compatible API.
 * Configure via Cloudflare Pages Environment Variables:
 *   AI_API_KEY    - Your API key (e.g., OpenAI, Groq, OpenRouter)
 *   AI_API_BASE   - API base URL (default: https://api.openai.com/v1)
 *   AI_MODEL      - Model name (default: gpt-4o-mini)
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
    const apiBase = (context.env.AI_API_BASE || 'https://api.openai.com/v1').replace(/\/+$/, '');
    const model = context.env.AI_MODEL || 'gpt-4o-mini';

    if (!apiKey) {
      return new Response(JSON.stringify({
        error: 'AI API key not configured. Set AI_API_KEY in Cloudflare Pages environment variables.',
        hint: 'Go to Cloudflare Dashboard > Pages > your site > Settings > Environment variables'
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const categoryMap = {
      'business': 'Business & Finance',
      'technology': 'Technology & Innovation',
      'world': 'Global Affairs & Politics',
      'health': 'Health & Wellness',
      'science': 'Science & Research',
      'opinion': 'Expert Opinion & Analysis'
    };
    const toneMap = {
      'breaking': 'urgent, punchy breaking news style',
      'analysis': 'in-depth analytical piece',
      'feature': 'engaging long-form feature',
      'opinion': 'thought-provoking opinion editorial'
    };
    const lengthMap = {
      'short': '300-400 words',
      'medium': '600-800 words',
      'long': '1200-1500 words'
    };

    const catLabel = categoryMap[category] || 'General News';
    const toneLabel = toneMap[tone] || 'informative news style';
    const lengthLabel = lengthMap[length] || '600-800 words';

    const systemPrompt = `You are an elite journalist for MenshlyGlobal, a premium international news organization known for sharp, authoritative reporting. Your writing is factually grounded, engaging, and carries the gravitas of top-tier outlets like Reuters, Bloomberg, or The Economist.

IMPORTANT RULES:
- Write in ${toneLabel}
- Target length: ${lengthLabel}
- Include a compelling, SEO-friendly headline (max 15 words)
- Include a 1-2 sentence summary/standfirst
- Use subheadings for longer articles
- Include realistic-sounding expert quotes (attribute to plausible sources)
- Reference real-world context where possible
- End with a forward-looking concluding paragraph
- Never use generic filler — every sentence must add value
- Format: Return JSON with keys: "title" (string), "summary" (string), "category" (string), "content" (string with HTML <h2>, <p>, <blockquote> tags)`;

    const userPrompt = `Write a ${catLabel} article about: "${topic}"`;

    const response = await fetch(apiBase + '/chat/completions', {
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
        max_tokens: 2048,
        temperature: 0.7,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      let errMsg = 'AI API returned status ' + response.status;
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson.error?.message || errMsg;
      } catch (e) {}
      return new Response(JSON.stringify({
        error: errMsg
      }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      return new Response(JSON.stringify({
        error: 'AI returned empty response. Try a different topic.'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    let article;
    try {
      article = JSON.parse(content);
    } catch (e) {
      article = {
        title: topic,
        summary: content.substring(0, 200),
        category: catLabel,
        content: '<p>' + content.replace(/\n\n/g, '</p><p>') + '</p>'
      };
    }

    article.id = 'ai-' + Date.now();
    article.topic = topic;
    article.tone = tone;
    article.generatedAt = new Date().toISOString();
    article.readTime = Math.max(2, Math.ceil((article.content || '').split(/\s+/).length / 200));

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
