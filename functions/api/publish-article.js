/**
 * Cloudflare Pages Function: Publish Article to Site
 * Commits article as Hugo markdown to GitHub repo.
 *
 * Required Cloudflare Environment Variables:
 *   GITHUB_TOKEN   - GitHub PAT with repo write access
 *   GITHUB_REPO    - owner/repo format
 */

export async function onRequestPost(context) {
  try {
    const { title, summary, content, category, image, imageCredit, imageLink, topic, tone, author: reqAuthor, tags: reqTags, series: reqSeries, series_order: reqSeriesOrder } = await context.request.json();

    if (!title || !title.trim()) return jsonResponse({ error: "Article title is required" }, 400);
    if (!content || content.trim().length < 50) return jsonResponse({ error: "Article content too short (min 50 chars)" }, 400);

    const githubToken = context.env.GITHUB_TOKEN || "";
    const githubRepo = context.env.GITHUB_REPO || "";

    if (!githubToken) return jsonResponse({ error: "GITHUB_TOKEN not set in Cloudflare env vars.", hint: "Pages > Settings > Environment variables" }, 503);
    if (!githubRepo) return jsonResponse({ error: "GITHUB_REPO not set.", hint: "Format: owner/repo" }, 503);

    const slug = slugify(title);
    const dateStr = new Date().toISOString();
    const authorPool = ["David Kiprop","Sarah Mitchell","Amara Okonkwo","Marcus Webb","James Chen","Dr. Elena Vasquez","Dr. Fatima Al-Hassan"];
    const author = (reqAuthor && reqAuthor.trim()) ? reqAuthor.trim() : authorPool[Math.floor(Math.random() * authorPool.length)];

    const catMap = {"Film & TV Review":"entertainment","Arts & Culture":"entertainment","Personal Finance":"finance","Market Analysis":"business","Business Strategy":"business","Tech & Innovation":"technology","Expert Commentary":"world","World News":"world","Technology":"technology","Business":"business","Finance":"finance","Entertainment":"entertainment","Sports":"sports","Science":"science","Health":"health","Opinion":"opinion"};
    const validSlugs = ["world","technology","business","finance","entertainment","sports","science","health","opinion"];
    const hugoCat = catMap[category] || (validSlugs.includes(category) ? category : "world");

    let tags;
    if (reqTags && reqTags.trim()) {
      tags = reqTags.split(",").map(t => t.trim()).filter(t => t.length > 0);
      if (tags.length < 2) { tags = tags.concat((topic || title).toLowerCase().split(/\s+/).filter(w => w.length > 3).slice(0, 3)); }
      var seen = {}; tags = tags.filter(t => seen[t] ? false : (seen[t] = true)); tags = tags.slice(0, 6);
    } else {
      var tw = (topic || title).toLowerCase().split(/\s+/).filter(w => w.length > 3);
      var s2 = {}; var u2 = []; tw.slice(0,4).forEach(t => { if (!s2[t]) { s2[t] = true; u2.push(t); } });
      u2.push("2026","MenshlyGlobal"); tags = u2.slice(0, 6);
    }

    let fm = "---\n";
    fm += "title: " + JSON.stringify(title) + "\n";
    fm += "date: " + JSON.stringify(dateStr) + "\n";
    fm += "slug: " + JSON.stringify(slug) + "\n";
    if (image) fm += "image: " + JSON.stringify(image) + "\n";
    fm += "categories: " + JSON.stringify([hugoCat]) + "\n";
    fm += "tags: " + JSON.stringify(tags) + "\n";
    fm += "author: " + JSON.stringify(author) + "\n";
    fm += "description: " + JSON.stringify((summary || "").substring(0, 160)) + "\n";
    if (reqSeries && reqSeries.trim()) fm += "series: " + JSON.stringify(reqSeries.trim()) + "\n";
    if (reqSeriesOrder) fm += "series_order: " + JSON.stringify(parseInt(reqSeriesOrder) || 1) + "\n";
    fm += "---\n\n";

    let bodyMd = content ? htmlToMd(content) : "";
    let fullMd = fm + (summary ? summary + "\n\n" : "") + bodyMd;

    var rp = githubRepo.split("/");
    var fp = "content/ai-newsroom/" + slug + ".md";
    var ab = "https://api.github.com";

    var chk = await fetch(ab + "/repos/" + rp[0] + "/" + rp[1] + "/contents/" + fp, {
      headers: { "Authorization": "Bearer " + githubToken, "User-Agent": "MenshlyGlobal-Bot", "Accept": "application/vnd.github.v3+json" }
    });

    var cb = { message: "Newsroom: publish article", content: btoa(unescape(encodeURIComponent(fullMd))) };
    if (chk.ok) { var ed = await chk.json(); cb.sha = ed.sha; cb.message = "Newsroom: update article"; }

    var pr = await fetch(ab + "/repos/" + rp[0] + "/" + rp[1] + "/contents/" + fp, {
      method: "PUT",
      headers: { "Authorization": "Bearer " + githubToken, "User-Agent": "MenshlyGlobal-Bot", "Accept": "application/vnd.github.v3+json", "Content-Type": "application/json" },
      body: JSON.stringify(cb)
    });

    if (!pr.ok) { var et = await pr.text(); var em = "GitHub API " + pr.status; try { em = JSON.parse(et).message || em; } catch(e){} return jsonResponse({ error: "Publish failed: " + em }, 500); }

    var res = await pr.json();
    return jsonResponse({ success: true, message: "Published! Live in 1-2 min.", slug: slug, url: "https://menshly-global.pages.dev/ai-newsroom/" + slug + "/", commitSha: (res.commit && res.commit.sha) ? res.commit.sha.substring(0,7) : "?", category: hugoCat, author: author });

  } catch (err) { return jsonResponse({ error: "Publish failed: " + (err.message || "Unknown") }, 500); }
}

function htmlToMd(html) {
  if (!html) return "";
  var md = html.replace(/\{"type"\s*:\s*"object"\}/g, "");
  md = md.replace(/<ul[^>]*>/gi, "\n").replace(/<\/ul>/gi, "\n");
  md = md.replace(/<ol[^>]*>/gi, "\n").replace(/<\/ol>/gi, "\n");
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, function(m, inner) {
    var t = inner.trim().replace(/<\/?p[^>]*>/gi, "").replace(/<\/?strong[^>]*>/gi, "**").replace(/<\/?b[^>]*>/gi, "**").replace(/<\/?em[^>]*>/gi, "*").replace(/<\/?i[^>]*>/gi, "*");
    return "- " + t + "\n";
  });
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n\n");
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n\n");
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n\n");
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, function(m, inner) { return "\n> " + inner.trim().replace(/<\/?p[^>]*>/gi, "") + "\n\n"; });
  md = md.replace(/<(strong|b)[^>]*>([\s\S]*?)<\/(strong|b)>/gi, "**$2**");
  md = md.replace(/<(em|i)[^>]*>([\s\S]*?)<\/(em|i)>/gi, "*$2*");
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)");
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, function(m, inner) { var t = inner.trim(); return t ? t + "\n\n" : ""; });
  md = md.replace(/<br\s*\/?/gi, "\n").replace(/<hr\s*\/?/gi, "\n---\n\n");
  md = md.replace(/<[^>]+>/g, "");
  md = md.replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,"\"").replace(/&#39;/g,"'");
  md = md.replace(/\n{3,}/g, "\n\n").trim();
  return md;
}

export async function onRequestOptions() {
  return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
}

function jsonResponse(data, status) { return new Response(JSON.stringify(data), { status: status || 200, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }); }

function slugify(text) { var s = text.toLowerCase().trim().replace(/['\u2019\u2018""\u201C\u201D]/g,"").replace(/[^\w\s-]/g,"").replace(/[\s_]+/g,"-").replace(/^-+|-+$/g,""); return s.substring(0,80) || "article-" + Date.now(); }
