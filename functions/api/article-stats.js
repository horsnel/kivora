/**
 * Article Stats API — Cloudflare Pages Function
 * Tracks view counts using GitHub-based stats.json persistence
 *
 * GET  /api/article-stats         → returns all stats
 * POST /api/article-stats         → increment or get stats
 *   action: "increment" + slug    → increment view count for article
 *   action: "get"     + slug      → get view count for specific article
 *   action: "trending"            → get top 10 most-viewed articles
 */
export async function onRequestGet(context) {
  try {
    const stats = await loadStats(context);
    return jsonResponse({ success: true, stats });
  } catch (err) {
    return jsonResponse({ success: true, stats: {} });
  }
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const { action, slug } = body;

    if (!action) {
      return jsonResponse({ success: false, error: 'action is required' }, 400);
    }

    if (action === 'trending') {
      const stats = await loadStats(context);
      const sorted = Object.entries(stats)
        .sort((a, b) => (b[1] || 0) - (a[1] || 0))
        .slice(0, 10)
        .map(([s, c]) => ({ slug: s, views: c }));
      return jsonResponse({ success: true, trending: sorted });
    }

    if (!slug) {
      return jsonResponse({ success: false, error: 'slug is required' }, 400);
    }

    if (action === 'increment') {
      const stats = await loadStats(context);
      stats[slug] = (stats[slug] || 0) + 1;
      await saveStats(context, stats);
      return jsonResponse({ success: true, slug, views: stats[slug] });
    }

    if (action === 'get') {
      const stats = await loadStats(context);
      return jsonResponse({ success: true, slug, views: stats[slug] || 0 });
    }

    return jsonResponse({ success: false, error: 'unknown action' }, 400);
  } catch (err) {
    return jsonResponse({ success: false, error: 'Invalid request' }, 400);
  }
}

async function loadStats(context) {
  const { GITHUB_TOKEN, GITHUB_REPO } = context.env;
  if (!GITHUB_TOKEN || !GITHUB_REPO) {
    // Fallback: return empty stats (no persistence without GitHub)
    return {};
  }
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/content/data/stats.json`,
      {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'MenshlyGlobal-Stats'
        }
      }
    );
    if (!res.ok) return {};
    const data = await res.json();
    const content = atob(data.content);
    return JSON.parse(content);
  } catch {
    return {};
  }
}

async function saveStats(context, stats) {
  const { GITHUB_TOKEN, GITHUB_REPO } = context.env;
  if (!GITHUB_TOKEN || !GITHUB_REPO) return;

  const content = btoa(JSON.stringify(stats, null, 2));

  // Get current file SHA
  let sha = null;
  try {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/content/data/stats.json`,
      {
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'MenshlyGlobal-Stats'
        }
      }
    );
    if (res.ok) {
      const data = await res.json();
      sha = data.sha;
    }
  } catch {}

  await fetch(
    `https://api.github.com/repos/${GITHUB_REPO}/contents/content/data/stats.json`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'MenshlyGlobal-Stats'
      },
      body: JSON.stringify({
        message: 'stats: update view counts [' + new Date().toISOString().slice(0, 10) + ']',
        content,
        sha
      })
    }
  );
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
