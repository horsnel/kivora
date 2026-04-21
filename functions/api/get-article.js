/**
 * Cloudflare Pages Function: Get Article for Editing
 * Fetches a published article's markdown content from GitHub.
 *
 * Required Cloudflare Environment Variables:
 *   GITHUB_TOKEN   - GitHub PAT with repo read access
 *   GITHUB_REPO    - Repository in format "owner/repo"
 */

export async function onRequestPost(context) {
  try {
    const { slug, section } = await context.request.json();

    if (!slug || !slug.trim()) {
      return jsonResponse({ error: "Article slug is required" }, 400);
    }

    const githubToken = context.env.GITHUB_TOKEN || "";
    const githubRepo = context.env.GITHUB_REPO || "";

    if (!githubToken) {
      return jsonResponse({ error: "GITHUB_TOKEN not configured in Cloudflare env vars." }, 503);
    }
    if (!githubRepo) {
      return jsonResponse({ error: "GITHUB_REPO not configured." }, 503);
    }

    var repoParts = githubRepo.split("/");
    var owner = repoParts[0];
    var repo = repoParts[1];
    var sectionDir = (section === "posts") ? "posts" : "ai-newsroom";
    var filePath = "content/" + sectionDir + "/" + slug + ".md";
    var apiBase = "https://api.github.com";

    var resp = await fetch(apiBase + "/repos/" + owner + "/" + repo + "/contents/" + filePath, {
      headers: {
        "Authorization": "Bearer " + githubToken,
        "User-Agent": "Kivora-Bot",
        "Accept": "application/vnd.github.v3+json"
      }
    });

    if (!resp.ok) {
      if (resp.status === 404) {
        return jsonResponse({ error: "Article not found." }, 404);
      }
      return jsonResponse({ error: "GitHub API error: " + resp.status }, 500);
    }

    var data = await resp.json();
    var decoded = decodeURIComponent(escape(atob(data.content)));

    /* Parse front matter */
    var frontMatter = {};
    var bodyStart = 0;
    if (decoded.startsWith("---")) {
      var fmEnd = decoded.indexOf("---", 3);
      if (fmEnd > 0) {
        var fmText = decoded.substring(3, fmEnd).trim();
        bodyStart = fmEnd + 3;
        /* Simple YAML parser for our front matter */
        var lines = fmText.split("\n");
        for (var i = 0; i < lines.length; i++) {
          var line = lines[i].trim();
          if (!line || line.startsWith("#")) continue;
          var colonIdx = line.indexOf(":");
          if (colonIdx > 0) {
            var key = line.substring(0, colonIdx).trim();
            var val = line.substring(colonIdx + 1).trim();
            /* Remove quotes */
            if ((val.startsWith("\"") && val.endsWith("\"")) || (val.startsWith("\'") && val.endsWith("\'"))) {
              val = val.substring(1, val.length - 1);
            }
            /* Parse JSON arrays */
            if (val.startsWith("[")) {
              try { val = JSON.parse(val); } catch(e) {}
            }
            frontMatter[key] = val;
          }
        }
      }
    }

    var bodyContent = decoded.substring(bodyStart).trim();

    return jsonResponse({
      success: true,
      slug: slug,
      sha: data.sha,
      frontMatter: frontMatter,
      body: bodyContent,
      raw: decoded
    });

  } catch (err) {
    return jsonResponse({ error: "Failed to fetch article: " + (err.message || "Unknown") }, 500);
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
