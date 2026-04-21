/**
 * Cloudflare Pages Function: Delete Article from Site
 * Deletes a Hugo markdown file from the GitHub repo via Contents API,
 * triggering a Cloudflare Pages rebuild.
 *
 * Required Cloudflare Environment Variables:
 *   GITHUB_TOKEN   — GitHub Personal Access Token with repo write access
 *   GITHUB_REPO    — Repository in format "owner/repo"
 */

export async function onRequestPost(context) {
  try {
    const { slug, section } = await context.request.json();

    if (!slug || !slug.trim()) {
      return jsonResponse({ error: 'Article slug is required' }, 400);
    }

    const githubToken = context.env.GITHUB_TOKEN || '';
    const githubRepo = context.env.GITHUB_REPO || '';

    if (!githubToken) {
      return jsonResponse({
        error: 'GitHub token not configured. Set GITHUB_TOKEN in Cloudflare Pages environment variables.'
      }, 503);
    }

    if (!githubRepo) {
      return jsonResponse({
        error: 'GitHub repo not configured. Set GITHUB_REPO in Cloudflare Pages environment variables.'
      }, 503);
    }

    const [owner, repo] = githubRepo.split('/');
    const sectionDir = (section === 'posts') ? 'posts' : 'ai-newsroom';
    const filePath = `content/${sectionDir}/${slug}.md`;
    const apiBase = 'https://api.github.com';

    /* Check if file exists and get its SHA */
    const checkResponse = await fetch(`${apiBase}/repos/${owner}/${repo}/contents/${filePath}`, {
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'User-Agent': 'Kivora-Bot',
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!checkResponse.ok) {
      if (checkResponse.status === 404) {
        return jsonResponse({ error: 'Article not found. It may have already been deleted.' }, 404);
      }
      const errText = await checkResponse.text();
      let errMsg = `GitHub API returned ${checkResponse.status}`;
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson.message || errMsg;
      } catch (e) {}
      return jsonResponse({ error: `Failed to find article: ${errMsg}` }, 500);
    }

    const fileData = await checkResponse.json();

    /* Delete the file */
    const deleteResponse = await fetch(`${apiBase}/repos/${owner}/${repo}/contents/${filePath}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${githubToken}`,
        'User-Agent': 'Kivora-Bot',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: `Newsroom: delete article "${slug}"`,
        sha: fileData.sha
      })
    });

    if (!deleteResponse.ok) {
      const errText = await deleteResponse.text();
      let errMsg = `GitHub API returned ${deleteResponse.status}`;
      try {
        const errJson = JSON.parse(errText);
        errMsg = errJson.message || errMsg;
      } catch (e) {}
      return jsonResponse({ error: `Failed to delete: ${errMsg}` }, 500);
    }

    const result = await deleteResponse.json();

    return jsonResponse({
      success: true,
      message: 'Article deleted successfully. It will be removed from the site within 1-2 minutes.',
      slug: slug,
      commitSha: result.commit?.sha?.substring(0, 7) || 'unknown'
    });

  } catch (err) {
    return jsonResponse({ error: 'Delete failed: ' + (err.message || 'Unknown error') }, 500);
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
