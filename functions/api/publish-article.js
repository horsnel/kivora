/**
 * Cloudflare Pages Function: Publish Article to Site
 * Takes generated article data and commits it as a Hugo markdown file
 * to the GitHub repo, triggering a Cloudflare Pages rebuild.
 *
 * Required Cloudflare Environment Variables:
 *   GITHUB_TOKEN   — GitHub Personal Access Token with repo write access
 *   GITHUB_REPO    — Repository in format "owner/repo" (e.g., "horsnel/menshly-global-repo")
 */

export async function onRequestPost(context) {
  try {
    const { title, summary, content, category, image, imageCredit, imageLink, topic, tone } = await context.request.json();

    if (!title || !title.trim()) {
      return jsonResponse({ error: 'Article title is required' }, 400);
    }

    if (!content || content.trim().length < 50) {
      return jsonResponse({ error: 'Article content is too short (minimum 50 characters)' }, 400);
    }

    const githubToken = context.env.GITHUB_TOKEN || '';
    const githubRepo = context.env.GITHUB_REPO || '';

    if (!githubToken) {
      return jsonResponse({
        error: 'GitHub token not configured. Set GITHUB_TOKEN in Cloudflare Pages environment variables.',
        hint: 'Cloudflare Dashboard > Pages > Settings > Environment variables'
      }, 503);
    }

    if (!githubRepo) {
      return jsonResponse({
        error: 'GitHub repo not configured. Set GITHUB_REPO in Cloudflare Pages environment variables.',
        hint: 'Format: "owner/repo" (e.g., "horsnel/menshly-global-repo")'
      }, 503);
    }

    /* === Build Hugo markdown === */
    const slug = slugify(title);
    const now = new Date();
    const dateStr = now.toISOString();
    const authors = ['David Kiprop', 'Sarah Mitchell', 'Amara Okonkwo', 'Marcus Webb', 'James Chen', 'Dr. Elena Vasquez', 'Dr. Fatima Al-Hassan'];
    const author = authors[Math.floor(Math.random() * authors.length)];

    /* Map category to Hugo section */
    const catMap = {
      'Film & TV Review': 'entertainment',
      'Arts & Culture': 'entertainment',
      'Personal Finance': 'finance',
      'Market Analysis': 'business',
      'Business Strategy': 'business',
      'Tech & Innovation': 'technology',
      'Expert Commentary': 'world'
    };
    const hugoCategory = catMap[category] || 'world';

    /* Build tags from topic words */
    const tagWords = (topic || title).toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const tags = [...new Set([...tagWords.slice(0, 4), '2026', 'MenshlyGlobal'])].slice(0, 6);

    /* Build front matter */
    let frontMatter = '---\n';
    frontMatter += `title: "${title.replace(/"/g, "'")}"\n`;
    frontMatter += `date: "${dateStr}"\n`;
    frontMatter += `slug: "${slug}"\n`;
    if (image) frontMatter += `image: "${image}"\n`;
    frontMatter += `categories: ["${hugoCategory}"]\n`;
    frontMatter += `tags: ${JSON.stringify(tags)}\n`;
    frontMatter += `author: "${author}"\n`;
    frontMatter += `description: "${(summary || '').replace(/"/g, "'").substring(0, 160)}"\n`;
    frontMatter += '---\n\n';

    /* Convert HTML content to markdown-friendly format */
    let bodyContent = '';
    if (content) {
      /* Convert HTML to simpler markdown */
      bodyContent = content
        .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n## $1\n')
        .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n### $1\n')
        .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
        .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
        .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
        .replace(/<blockquote[^>]*>(.*?)<\/blockquote>/gi, '> $1\n')
        .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
        .replace(/<ul[^>]*>|<\/ul>/gi, '\n')
        .replace(/<ol[^>]*>|<\/ol>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    }

    /* Add summary at top if available */
    let fullMarkdown = frontMatter;
    if (summary) {
      fullMarkdown += summary + '\n\n';
    }
    fullMarkdown += bodyContent;

    /* === Commit to GitHub === */
    const [owner, repo] = githubRepo.split('/');
    const filePath = `content/ai-newsroom/${slug}.md`;
    const apiBase = 'https://api.github.com';

    /* Check if file already exists */
    const checkResponse = await fetch(`${apiBase}/repos/${owner}/${repo}/contents/${filePath}`, {
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'User-Agent': 'MenshlyGlobal-Bot',
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    let method = 'PUT';
    let commitBody = {
      message: `Newsroom: publish "${title.substring(0, 60)}"`,
      content: btoa(unescape(encodeURIComponent(fullMarkdown)))
    };

    if (checkResponse.ok) {
      const existingData = await checkResponse.json();
      commitBody.sha = existingData.sha;
      commitBody.message = `Newsroom: update "${title.substring(0, 60)}"`;
    }

    const putResponse = await fetch(`${apiBase}/repos/${owner}/${repo}/contents/${filePath}`, {
      method: method,
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'User-Agent': 'MenshlyGlobal-Bot',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(commitBody)
    });

    if (!putResponse.ok) {
      const errText = await putResponse.text();
      let errMsg = `GitHub API returned ${putResponse.status}`;
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson.message || errMsg;
      } catch (e) {}
      return jsonResponse({ error: `Failed to publish: ${errMsg}` }, 500);
    }

    const result = await putResponse.json();
    const siteUrl = `https://menshly-global.pages.dev/ai-newsroom/${slug}/`;

    return jsonResponse({
      success: true,
      message: 'Article published successfully! It will appear on the site within 1-2 minutes after Cloudflare rebuilds.',
      slug: slug,
      url: siteUrl,
      commitSha: result.commit?.sha?.substring(0, 7) || 'unknown',
      category: hugoCategory,
      author: author
    });

  } catch (err) {
    return jsonResponse({
      error: 'Publish failed: ' + (err.message || 'Unknown error')
    }, 500);
  }
}

/* CORS preflight */
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

/* === Helpers === */
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

function slugify(text) {
  let s = text.toLowerCase().trim();
  /* Remove apostrophes and quotes first */
  s = s.replace(/[''""']/g, '');
  /* Replace non-alphanumeric with hyphens */
  s = s.replace(/[^\w\s-]/g, '');
  /* Collapse whitespace */
  s = s.replace(/[\s_]+/g, '-');
  /* Remove leading/trailing hyphens */
  s = s.replace(/^-+|-+$/g, '');
  /* Limit length */
  return s.substring(0, 80) || 'article-' + Date.now();
}
