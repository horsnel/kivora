/**
 * Cloudflare Pages Function: Breaking News Manager
 * Manages breaking news via GitHub API (read/write content/data/breaking.json).
 *
 * POST actions:
 *   "set"  - Write breaking news (headline + link) to breaking.json
 *   "clear" - Write empty breaking.json
 *   "get"  - Read breaking.json from GitHub
 */

export async function onRequestPost(context) {
  try {
    const { action, headline, link } = await context.request.json();

    const token = context.env.GITHUB_TOKEN || "";
    const repo = context.env.GITHUB_REPO || "";

    if (!token || !repo) {
      return jsonResponse({ error: "GITHUB_TOKEN and GITHUB_REPO must be configured." }, 503);
    }

    const apiBase = "https://api.github.com/repos/" + repo;
    const path = "content/data/breaking.json";
    const headers = {
      "Authorization": "Bearer " + token,
      "User-Agent": "Kivora/1.0",
      "Content-Type": "application/json"
    };

    if (action === "get") {
      // Read breaking.json from GitHub
      const resp = await fetch(apiBase + "/contents/" + path, { headers: headers });
      if (!resp.ok) {
        // File may not exist yet
        if (resp.status === 404) {
          return jsonResponse({ headline: "", link: "", active: false });
        }
        return jsonResponse({ error: "Failed to read breaking news from GitHub: " + resp.status }, 500);
      }
      const data = await resp.json();
      const content = decodeBase64(data.content);
      try {
        const parsed = JSON.parse(content);
        return jsonResponse({
          headline: parsed.headline || "",
          link: parsed.link || "",
          active: !!parsed.headline,
          sha: data.sha
        });
      } catch (e) {
        return jsonResponse({ headline: "", link: "", active: false, sha: data.sha });
      }

    } else if (action === "set") {
      if (!headline || !headline.trim()) {
        return jsonResponse({ error: "Headline is required." }, 400);
      }

      const payload = {
        headline: headline.trim(),
        link: (link || "").trim(),
        updated: new Date().toISOString()
      };
      const fileContent = JSON.stringify(payload, null, 2);

      // Check if file exists to get SHA
      let sha = null;
      try {
        const existing = await fetch(apiBase + "/contents/" + path, { headers: headers });
        if (existing.ok) {
          const existingData = await existing.json();
          sha = existingData.sha;
        }
      } catch (e) {}

      const body = {
        message: "Update breaking news: " + headline.trim().substring(0, 60),
        content: encodeBase64(fileContent),
        branch: "main"
      };
      if (sha) body.sha = sha;

      const resp = await fetch(apiBase + "/contents/" + path, {
        method: "PUT",
        headers: headers,
        body: JSON.stringify(body)
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(function() { return {}; });
        return jsonResponse({ error: "Failed to save breaking news: " + (errData.message || resp.status) }, 500);
      }

      return jsonResponse({ success: true, headline: headline.trim() });

    } else if (action === "clear") {
      const payload = { headline: "", link: "", updated: new Date().toISOString() };
      const fileContent = JSON.stringify(payload, null, 2);

      let sha = null;
      try {
        const existing = await fetch(apiBase + "/contents/" + path, { headers: headers });
        if (existing.ok) {
          const existingData = await existing.json();
          sha = existingData.sha;
        }
      } catch (e) {}

      if (!sha) {
        return jsonResponse({ success: true, message: "No breaking news to clear." });
      }

      const body = {
        message: "Clear breaking news",
        content: encodeBase64(fileContent),
        sha: sha,
        branch: "main"
      };

      const resp = await fetch(apiBase + "/contents/" + path, {
        method: "PUT",
        headers: headers,
        body: JSON.stringify(body)
      });

      if (!resp.ok) {
        const errData = await resp.json().catch(function() { return {}; });
        return jsonResponse({ error: "Failed to clear breaking news: " + (errData.message || resp.status) }, 500);
      }

      return jsonResponse({ success: true, message: "Breaking news cleared." });

    } else {
      return jsonResponse({ error: "Invalid action. Use 'set', 'clear', or 'get'." }, 400);
    }

  } catch (err) {
    return jsonResponse({ error: "Server error: " + (err.message || "Unknown error") }, 500);
  }
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

function encodeBase64(str) {
  return Buffer.from(str, "utf-8").toString("base64");
}

function decodeBase64(str) {
  return Buffer.from(str, "base64").toString("utf-8");
}
