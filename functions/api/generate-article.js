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
      return jsonResponse({ error: "Please provide a topic (at least 3 characters)" }, 400);
    }

    const rawKey = context.env.AI_API_KEY || "";
    const apiBase = (context.env.AI_API_BASE || "https://api.cerebras.ai/v1").replace(/\/+$/, "");
    const configuredModel = context.env.AI_MODEL || "";
    const pexelsKey = context.env.PEXELS_API_KEY || "";

    if (!rawKey) {
      return jsonResponse({
        error: "AI API key not configured. Set AI_API_KEY in Cloudflare Pages environment variables.",
        hint: "Go to Cloudflare Dashboard > Pages > your site > Settings > Environment variables"
      }, 503);
    }

    /* Strip invisible Unicode chars that break auth */
    const apiKey = rawKey.replace(/[\u200b-\u200f\u2028-\u202e\ufeff\u00ad]/g, "").trim();

    /* === Auto-detect available models === */
    let availableModels = await getAvailableModels(apiKey, apiBase);
    let model = configuredModel;

    if (model && availableModels.length > 0 && !availableModels.includes(model)) {
      console.log("Configured model not found, auto-detecting...");
      model = "";
    }

    if (!model && availableModels.length > 0) {
      const MODEL_PREFERENCES = [
        "llama-3.3-70b",
        "qwen-3-235b-a22b-instruct-2507",
        "deepseek-r1-distill-llama-70b",
        "llama3.1-8b"
      ];
      for (const pref of MODEL_PREFERENCES) {
        if (availableModels.includes(pref)) {
          model = pref;
          break;
        }
      }
      if (!model) model = availableModels[0];
    }

    if (!model) model = "llama3.1-8b";

    /* === Category Map === */
    const categoryMap = {
      "film-review": "Film & TV Review",
      "entertainment": "Arts & Culture",
      "personal-finance": "Personal Finance",
      "market-analysis": "Market Analysis",
      "business-strategy": "Business Strategy",
      "technology": "Tech & Innovation",
      "commentary": "Expert Commentary"
    };

    /* === Tone/Style Map === */
    const toneMap = {
      "review": "detailed review with clear verdict, pros/cons, and rating",
      "analysis": "in-depth analytical breakdown with data-driven insights",
      "guide": "practical how-to guide with actionable steps",
      "opinion": "thought-provoking opinion editorial with strong perspective",
      "listicle": "engaging numbered list/ranking format with short punchy entries",
      "feature": "engaging long-form feature with storytelling"
    };

    const lengthMap = {
      "short": "300-400 words",
      "medium": "600-800 words",
      "long": "1200-1500 words"
    };

    const catLabel = categoryMap[category] || "Analysis";
    const toneLabel = toneMap[tone] || "informative analysis style";
    const lengthLabel = lengthMap[length] || "600-800 words";

    /* === System Prompt - ask for structured plain text === */
    const systemPrompt = `You are a senior content creator for MenshlyGlobal, a premium international media platform. You write reviews, analysis, opinions, guides, and commentary.

Rules:
- Style: ${toneLabel}
- Target length: ${lengthLabel}
- Category: ${catLabel}
- Be specific with concrete examples, numbers, and real-world references
- End with a clear conclusion or actionable takeaway
- Use proper markdown formatting: ## for subheadings, - or * for bullet points, **bold** for emphasis

CRITICAL OUTPUT FORMAT - follow this exactly:
Line 1: TITLE: The article title here (plain text, no # prefix)
Line 2: SUMMARY: One or two sentences summarizing the article
Line 3: (empty line)
Line 4+: The article body in proper markdown format

Do NOT output JSON. Do NOT output any code blocks or schema descriptions. Output ONLY the article as described above.`;

    const userPrompt = `Write a ${catLabel} piece about: "${topic}"`;

    /* === Call AI API - plain text mode === */
    let rawContent = null;
    let modelsToTry = [model];
    if (availableModels.length > 0) {
      for (const m of availableModels) {
        if (m !== model) modelsToTry.push(m);
      }
    }

    for (const tryModel of modelsToTry) {
      try {
        const aiResponse = await fetch(apiBase + "/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer " + apiKey
          },
          body: JSON.stringify({
            model: tryModel,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ],
            max_tokens: 4000,
            temperature: 0.75
          })
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices && aiData.choices[0] && aiData.choices[0].message && aiData.choices[0].message.content;
          if (content && content.length > 100) {
            rawContent = content;
            model = tryModel;
            break;
          }
        }
        if (aiResponse.status === 401) {
          return jsonResponse({
            error: "Authentication failed (401). Check AI_API_KEY in Cloudflare env vars."
          }, 500);
        }
        continue;
      } catch (e) {
        continue;
      }
    }

    if (!rawContent) {
      return jsonResponse({
        error: "Could not generate content with any available model.",
        hint: "Models tried: " + modelsToTry.slice(0, 5).join(", "),
        tried: modelsToTry
      }, 500);
    }

    /* === Parse response === */
    let article = parseAiResponse(rawContent, topic, catLabel);

    article.id = "ai-" + Date.now();
    article.topic = topic;
    article.tone = tone;
    article.category = catLabel;
    article.generatedAt = new Date().toISOString();
    article.readTime = Math.max(2, Math.ceil((article.content || "").split(/\s+/).length / 200));

    /* === Fetch Image - try Pexels first, then fallback === */
    article.imageStatus = "none";
    var imageFetched = false;
    var imgRand = Math.floor(Math.random() * 10000);

    if (pexelsKey) {
      try {
        /* Try category-specific search first with random pagination */
        var searchQueries = buildImageQueries(topic, category);
        for (var qi = 0; qi < searchQueries.length && !imageFetched; qi++) {
          var sq = searchQueries[qi];
          var randomPage = Math.floor(Math.random() * 5) + 1;
          var imgResp = await fetch(
            "https://api.pexels.com/v1/search?query=" + encodeURIComponent(sq) + "&per_page=3&page=" + randomPage + "&orientation=landscape",
            { headers: { "Authorization": pexelsKey } }
          );
          if (imgResp.ok) {
            var imgData = await imgResp.json();
            if (imgData.photos && imgData.photos.length > 0) {
              var pick = imgData.photos[Math.floor(Math.random() * imgData.photos.length)];
              article.image = pick.src.large;
              article.imageThumb = pick.src.medium;
              article.imageCredit = pick.photographer;
              article.imageLink = pick.photographer_url;
              article.imageStatus = "pexels";
              imageFetched = true;
            }
          }
        }
        if (!imageFetched) article.imageStatus = "pexels-no-results";
      } catch (imgErr) {
        article.imageStatus = "pexels-error:" + (imgErr.message || "unknown");
      }
    } else {
      article.imageStatus = "no-pexels-key";
    }

    /* Fallback: use Lorem Picsum for a consistent photo */
    if (!imageFetched) {
      var imgSeed = imgSlugify(topic) + "-" + imgRand;
      article.image = "https://picsum.photos/seed/" + imgSeed + "/1200/630";
      article.imageThumb = "https://picsum.photos/seed/" + imgSeed + "/600/400";
      article.imageCredit = "Picsum";
      article.imageLink = "https://picsum.photos";
      if (article.imageStatus === "none") article.imageStatus = "fallback-picsum";
    }

    return jsonResponse(article, 200);

  } catch (err) {
    return jsonResponse({ error: "Server error: " + (err.message || "Unknown error") }, 500);
  }
}

/* === Response Parser === */
function parseAiResponse(raw, topic, catLabel) {
  /* Clean up: remove code fences, schema artifacts */
  let cleaned = raw.trim();

  /* Remove any backtick wrapping */
  cleaned = cleaned.replace(/^```\w*\s*\n?/, "").replace(/\n?```\s*$/, "");

  /* Remove JSON schema artifacts that some models output */
  cleaned = cleaned.replace(/\{"type"\s*:\s*"object"\}/g, "");
  cleaned = cleaned.replace(/```json\s*\{[^}]*\}\s*```/g, "");
  cleaned = cleaned.replace(/^\s*\{[^}]*"type"[^}]*\}\s*$/gm, "");
  cleaned = cleaned.trim();

  /* Try to extract TITLE: and SUMMARY: prefixes */
  let title = "";
  let summary = "";
  let body = "";

  const titleMatch = cleaned.match(/^TITLE:\s*(.+)$/im);
  const summaryMatch = cleaned.match(/^SUMMARY:\s*(.+)$/im);

  if (titleMatch) {
    title = titleMatch[1].trim().replace(/^#+\s+/, "");
    const titleEnd = cleaned.indexOf(titleMatch[0]) + titleMatch[0].length;
    let searchStart = titleEnd;

    if (summaryMatch) {
      summary = summaryMatch[1].trim();
      const summaryEnd = cleaned.indexOf(summaryMatch[0]) + summaryMatch[0].length;
      searchStart = summaryEnd;
    }

    body = cleaned.substring(searchStart).trim();
    body = body.replace(/^\n+/, "");
  } else {
    /* No TITLE: prefix - try first line as title */
    const lines = cleaned.split("\n");
    title = lines[0].trim().replace(/^#+\s+/, "");
    let summaryLines = [];
    let bodyStart = 1;

    for (let i = 1; i < Math.min(lines.length, 8); i++) {
      const line = lines[i].trim();
      if (line === "") {
        if (summaryLines.length > 0) { bodyStart = i + 1; break; }
        continue;
      }
      if (line.startsWith("## ") || line.startsWith("### ") || line.startsWith("<h")) {
        bodyStart = i;
        break;
      }
      summaryLines.push(line);
    }
    summary = summaryLines.join(" ").substring(0, 300);
    body = lines.slice(bodyStart).join("\n").trim();
  }

  /* Ensure body is substantial */
  if (body.length < 100 && cleaned.length > 200) {
    body = cleaned.substring(Math.min(title.length + summary.length + 20, 100));
  }

  return {
    title: title || topic,
    summary: summary || topic,
    category: catLabel,
    content: markdownToHtml(body)
  };
}

/* === Convert Markdown to clean HTML === */
function markdownToHtml(text) {
  if (!text) return "<p>No content generated.</p>";

  let html = text;

  /* Remove any remaining artifacts */
  html = html.replace(/\{"type"\s*:\s*"object"\}/g, "");
  html = html.replace(/^\s*\{[^}]*"type"[^}]*\}\s*$/gm, "");

  /* Headers */
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h2>$1</h2>");

  /* Bold */
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  /* Italic - avoid matching bold */
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, "<em>$1</em>");

  /* Blockquotes */
  html = html.replace(/^>\s*(.+)$/gm, "<blockquote>$1</blockquote>");

  /* Unordered list items - handle indented bullets */
  html = html.replace(/^\s*[-*]\s+(.+)$/gm, "<li>$1</li>");

  /* Ordered list items */
  html = html.replace(/^\d+\.\s+(.+)$/gm, "<li>$1</li>");

  /* Wrap consecutive li items in ul */
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, "<ul>$1</ul>");

  /* Horizontal rules */
  html = html.replace(/^---+$/gm, "<hr>");

  /* Links */
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  /* Build paragraphs from remaining text */
  const lines = html.split("\n");
  let result = [];
  let inParagraph = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inParagraph) { result.push("</p>"); inParagraph = false; }
      continue;
    }
    if (/^<(h[1-6]|ul|\/ul|ol|\/ol|li|\/li|blockquote|hr|div|pre|table)/.test(trimmed)) {
      if (inParagraph) { result.push("</p>"); inParagraph = false; }
      result.push(trimmed);
    } else {
      if (!inParagraph) { result.push("<p>"); inParagraph = true; }
      else { result.push("<br>"); }
      result.push(trimmed);
    }
  }
  if (inParagraph) result.push("</p>");

  html = result.join("\n");

  /* Clean up empty/wrong paragraph wrappers */
  html = html.replace(/<p>\s*<\/p>/g, "");
  html = html.replace(/<p>\s*(<h[23]>)/g, "$1");
  html = html.replace(/(<\/h[23]>)\s*<\/p>/g, "$1");
  html = html.replace(/<p>\s*(<ul>)/g, "$1");
  html = html.replace(/(<\/ul>)\s*<\/p>/g, "$1");
  html = html.replace(/<p>\s*(<hr>)/g, "$1");
  html = html.replace(/(<hr>)\s*<\/p>/g, "$1");

  return html;
}

/* === Get available models from API === */
async function getAvailableModels(apiKey, apiBase) {
  try {
    const resp = await fetch(apiBase + "/models", {
      headers: {
        "Authorization": "Bearer " + apiKey,
        "User-Agent": "MenshlyGlobal/1.0"
      }
    });
    if (!resp.ok) {
      console.log("Model list failed:", resp.status);
      return [];
    }
    const data = await resp.json();
    const models = (data.data || []).map(function(m) { return m.id; });
    console.log("Available models:", models.join(", "));
    return models;
  } catch (e) {
    console.log("Model detection failed:", e.message);
    return [];
  }
}

/* Build multiple image search queries (broad to specific) for Pexels */
function buildImageQueries(topic, category) {
  var categoryKeywords = {
    "film-review": ["cinema movie", "film director", "movie theater"],
    "entertainment": ["entertainment culture", "music concert", "art gallery"],
    "personal-finance": ["finance money", "investment portfolio", "savings budget"],
    "market-analysis": ["business analytics", "stock market charts", "data analysis"],
    "business-strategy": ["business office", "corporate meeting", "entrepreneur"],
    "technology": ["technology digital", "computer innovation", "futuristic tech"],
    "commentary": ["journalism news", "thought leader", "analysis report"]
  };
  var queries = categoryKeywords[category] || ["media news", "business professional"];
  /* Add topic-specific query at the end */
  var topicWords = topic.split(/\s+/).filter(function(w) { return w.length > 3; }).slice(0, 5).join(" ");
  if (topicWords) queries.push(topicWords);
  return queries;
}

/* Simple slugify for image seeds */
function imgSlugify(text) {
  var s = (text || "article").toLowerCase().trim().replace(/[^a-z0-9\s-]/g, "").replace(/[\s_]+/g, "-").replace(/^-+|-+$/g, "");
  return s.substring(0, 60) || "article";
}

/* Handle CORS preflight */
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}

/* === Helpers === */
function jsonResponse(data, status) {
  if (status === undefined) status = 200;
  return new Response(JSON.stringify(data), {
    status: status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  });
}
