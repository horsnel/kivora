/**
 * Cloudflare Pages Function: AI Headline Rewriter
 * Generates 5 alternative headlines for a given title.
 * Uses AI_API_KEY env var (same pattern as generate-article.js).
 */

export async function onRequestPost(context) {
  try {
    const { title } = await context.request.json();

    if (!title || title.trim().length < 3) {
      return jsonResponse({ error: "Please provide a title (at least 3 characters)" }, 400);
    }

    const rawKey = context.env.AI_API_KEY || "";
    const apiBase = (context.env.AI_API_BASE || "https://api.cerebras.ai/v1").replace(/\/+$/, "");
    const configuredModel = context.env.AI_MODEL || "";

    if (!rawKey) {
      return jsonResponse({
        error: "AI API key not configured. Set AI_API_KEY in Cloudflare Pages environment variables."
      }, 503);
    }

    const apiKey = rawKey.replace(/[\u200b-\u200f\u2028-\u202e\ufeff\u00ad]/g, "").trim();

    let availableModels = await getAvailableModels(apiKey, apiBase);
    let model = configuredModel;

    if (model && availableModels.length > 0 && !availableModels.includes(model)) {
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
        if (availableModels.includes(pref)) { model = pref; break; }
      }
      if (!model) model = availableModels[0];
    }
    if (!model) model = "llama3.1-8b";

    const systemPrompt = "You are a senior newspaper editor at MenshlyGlobal. Rewrite the given headline into 5 fresh, compelling alternative headlines. Output ONLY 5 headlines, one per line, with no numbering, no bullet points, no extra text. Each headline should be a different angle or style (e.g. provocative, factual, question, dramatic, concise).";

    const userPrompt = "Rewrite this headline into 5 alternatives:\n" + title.trim();

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
            max_tokens: 500,
            temperature: 0.8
          })
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices && aiData.choices[0] && aiData.choices[0].message && aiData.choices[0].message.content;
          if (content && content.length > 20) {
            rawContent = content;
            model = tryModel;
            break;
          }
        }
        if (aiResponse.status === 401) {
          return jsonResponse({ error: "Authentication failed (401). Check AI_API_KEY." }, 500);
        }
        continue;
      } catch (e) {
        continue;
      }
    }

    if (!rawContent) {
      return jsonResponse({ error: "Could not generate headlines with any available model." }, 500);
    }

    // Parse headlines: one per line, strip numbering/bullets
    const headlines = rawContent
      .trim()
      .split("\n")
      .map(line => line.replace(/^[\d]+[.)]\s*/, "").replace(/^[-*]\s*/, "").trim())
      .filter(line => line.length > 5)
      .slice(0, 5);

    if (headlines.length === 0) {
      return jsonResponse({ error: "Failed to parse headlines from AI response." }, 500);
    }

    return jsonResponse({ headlines: headlines }, 200);

  } catch (err) {
    return jsonResponse({ error: "Server error: " + (err.message || "Unknown error") }, 500);
  }
}

async function getAvailableModels(apiKey, apiBase) {
  try {
    const resp = await fetch(apiBase + "/models", {
      headers: { "Authorization": "Bearer " + apiKey, "User-Agent": "MenshlyGlobal/1.0" }
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    return (data.data || []).map(function(m) { return m.id; });
  } catch (e) { return []; }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}

function jsonResponse(data, status) {
  if (status === undefined) status = 200;
  return new Response(JSON.stringify(data), {
    status: status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
  });
}
