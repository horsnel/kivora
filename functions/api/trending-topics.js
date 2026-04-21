/**
 * Cloudflare Pages Function: AI Trending Topics
 * Generates 10 trending topic suggestions using AI.
 * 
 * Configure via Cloudflare Pages Environment Variables:
 *   AI_API_KEY  - AI API key (e.g., Cerebras, Groq, OpenAI)
 *   AI_API_BASE - API base URL (default: https://api.cerebras.ai/v1)
 *   AI_MODEL    - Model name (default: auto-detect)
 */

export async function onRequestPost(context) {
  try {
    const body = await context.request.json().catch(() => ({}));
    const optionalCategory = body.category || "";

    const rawKey = context.env.AI_API_KEY || "";
    const apiBase = (context.env.AI_API_BASE || "https://api.cerebras.ai/v1").replace(/\/+$/, "");
    const configuredModel = context.env.AI_MODEL || "";

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

    /* === Prompts === */
    const systemPrompt = "You are a news editor for a global media outlet. Suggest 10 timely, engaging news topics for articles in 2026. Cover diverse categories: business, technology, finance, entertainment, world news, health, science. For each topic provide the category in parentheses. Output exactly one topic per line in this format: Topic text (category)";

    let userPrompt = "Suggest 10 trending news topics";
    if (optionalCategory) {
      userPrompt = "Suggest 10 trending news topics in the category: " + optionalCategory;
    }

    /* === Call AI API === */
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
            max_tokens: 1500,
            temperature: 0.9
          })
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices && aiData.choices[0] && aiData.choices[0].message && aiData.choices[0].message.content;
          if (content && content.length > 50) {
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
        error: "Could not generate topics with any available model.",
        hint: "Models tried: " + modelsToTry.slice(0, 5).join(", "),
        tried: modelsToTry
      }, 500);
    }

    /* === Parse response - one topic per line with (category) === */
    const topics = [];
    const lines = rawContent.trim().split(/\n/);
    for (const line of lines) {
      const trimmed = line.trim().replace(/^[-*\d.)\s]+/, "");
      if (!trimmed) continue;
      const match = trimmed.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
      if (match) {
        topics.push({
          topic: match[1].trim(),
          category: match[2].trim()
        });
      } else if (trimmed.length > 10) {
        topics.push({
          topic: trimmed,
          category: "General"
        });
      }
      if (topics.length >= 10) break;
    }

    return jsonResponse({ topics: topics }, 200);

  } catch (err) {
    return jsonResponse({ error: "Server error: " + (err.message || "Unknown error") }, 500);
  }
}

/* === Get available models from API === */
async function getAvailableModels(apiKey, apiBase) {
  try {
    const resp = await fetch(apiBase + "/models", {
      headers: {
        "Authorization": "Bearer " + apiKey,
        "User-Agent": "Kivora/1.0"
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
