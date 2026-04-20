/**
 * Cloudflare Pages Function: Update Article
 * Updates an existing article in the GitHub repo.
 *
 * Required Cloudflare Environment Variables:
 *   GITHUB_TOKEN   - GitHub PAT with repo write access
 *   GITHUB_REPO    - Repository in format "owner/repo"
 */

export async function onRequestPost(context) {
  try {
    const { slug, sha, frontMatter: fm, body, section } = await context.request.json();

    if (!slug || !slug.trim()) {
      return jsonResponse({ error: "Article slug is required" }, 400);
    }
    if (!body || body.trim().length < 50) {
      return jsonResponse({ error: "Article content is too short (minimum 50 characters)" }, 400);
    }

    const githubToken = context.env.GITHUB_TOKEN || "";
    const githubRepo = context.env.GITHUB_REPO || "";

    if (!githubToken) return jsonResponse({ error: "GITHUB_TOKEN not configured." }, 503);
    if (!githubRepo) return jsonResponse({ error: "GITHUB_REPO not configured." }, 503);

    /* Build markdown file from front matter + body */
    var fmLines = ["---"];
    var fields = ["title", "date", "slug", "image", "author", "description", "series", "series_order"];
    var arrayFields = ["categories", "tags"];
    for (var i = 0; i < fields.length; i++) {
      var key = fields[i];
      if (fm && fm[key] !== undefined && fm[key] !== "") {
        fmLines.push(key + ": " + JSON.stringify(fm[key]));
      }
    }
    for (var j = 0; j < arrayFields.length; j++) {
      var akey = arrayFields[j];
      if (fm && fm[akey]) {
        fmLines.push(akey + ": " + JSON.stringify(fm[akey]));
      }
    }
    fmLines.push("---");
    fmLines.push("");
    var fullContent = fmLines.join("\n") + body;

    var repoParts = githubRepo.split("/");
    var owner = repoParts[0];
    var repo = repoParts[1];
    var sectionDir = (section === "posts") ? "posts" : "ai-newsroom";
    var filePath = "content/" + sectionDir + "/" + slug + ".md";
    var apiBase = "https://api.github.com";

    /* If no SHA provided, fetch it */
    var fileSha = sha;
    if (!fileSha) {
      var checkResp = await fetch(apiBase + "/repos/" + owner + "/" + repo + "/contents/" + filePath, {
        headers: {
          "Authorization": "Bearer " + githubToken,
          "User-Agent": "MenshlyGlobal-Bot",
          "Accept": "application/vnd.github.v3+json"
        }
      });
      if (checkResp.ok) {
        var checkData = await checkResp.json();
        fileSha = checkData.sha;
      } else {
        return jsonResponse({ error: "Article not found on GitHub. Cannot update." }, 404);
      }
    }

    var putResp = await fetch(apiBase + "/repos/" + owner + "/" + repo + "/contents/" + filePath, {
      method: "PUT",
      headers: {
        "Authorization": "Bearer " + githubToken,
        "User-Agent": "MenshlyGlobal-Bot",
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: "Newsroom: edit article \"" + (fm && fm.title || slug).substring(0, 60) + "\"",
        content: btoa(unescape(encodeURIComponent(fullContent))),
        sha: fileSha
      })
    });

    if (!putResp.ok) {
      var errText = await putResp.text();
      var errMsg = "GitHub API " + putResp.status;
      try { errMsg = JSON.parse(errText).message || errMsg; } catch(e) {}
      return jsonResponse({ error: "Update failed: " + errMsg }, 500);
    }

    var result = await putResp.json();
    return jsonResponse({
      success: true,
      message: "Article updated! Changes will appear on the site within 1-2 minutes.",
      slug: slug,
      commitSha: (result.commit && result.commit.sha) ? result.commit.sha.substring(0, 7) : "?"
    });

  } catch (err) {
    return jsonResponse({ error: "Update failed: " + (err.message || "Unknown") }, 500);
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
