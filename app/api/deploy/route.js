import { rateLimit, getClientIP } from '@/lib/ratelimit'
export const runtime = 'edge' 

import { getEnvVar, getCloudflareAccountId } from '@/lib/cfEnv'

// ── Deploy Site to Cloudflare Pages ──
// Accepts a project name + files, deploys to CF Pages, returns live URL
// CF_ACCOUNT_ID is auto-detected from the API token if not set explicitly

export async function POST(req) {
  const ip = getClientIP(req)
  if (!rateLimit(ip).ok) {
    return Response.json({ error: 'Too many requests. Try again shortly.' }, { status: 429 })
  }

  try {
    const CF_API_TOKEN = await getEnvVar('CF_API_TOKEN')
    const CF_ACCOUNT_ID = await getCloudflareAccountId()

    if (!CF_API_TOKEN) {
      return Response.json({ error: 'Deployment not configured — CF_API_TOKEN missing.' }, { status: 503 })
    }
    if (!CF_ACCOUNT_ID) {
      return Response.json({ error: 'Could not determine Cloudflare Account ID. Set CF_ACCOUNT_ID env var or ensure your API token has Account Read permission.' }, { status: 503 })
    }

    const { project_name, files, framework } = await req.json()

    if (!project_name || !files?.length) {
      return Response.json({ error: 'project_name and files are required.' }, { status: 400 })
    }

    if (!files.some(f => f.path === 'index.html' || f.path.endsWith('/index.html'))) {
      return Response.json({ error: 'Must include an index.html file.' }, { status: 400 })
    }

    const projectName = project_name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')

    // Create project (ignore error if exists)
    await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/pages/projects`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${CF_API_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName,
          production_branch: 'main',
        }),
      }
    )

    // Deploy files
    const formData = new FormData()
    for (const file of files) {
      formData.append('file', new Blob([file.content], { type: 'application/octet-stream' }), file.path)
    }

    const deployRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/pages/projects/${projectName}/deployments`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${CF_API_TOKEN}` },
        body: formData,
        signal: AbortSignal.timeout(30000),
      }
    )

    if (!deployRes.ok) {
      const errText = await deployRes.text()
      return Response.json({ error: `Deploy failed: ${errText.slice(0, 300)}` }, { status: 502 })
    }

    const deployData = await deployRes.json()

    if (!deployData.success) {
      return Response.json({ error: deployData.errors?.[0]?.message || 'Deploy failed' }, { status: 502 })
    }

    const url = deployData.result?.url || `https://${projectName}.pages.dev`

    return Response.json({
      success: true,
      url,
      project_name: projectName,
      files_deployed: files.length,
    })
  } catch (err) {
    console.error('[deploy]', err)
    return Response.json({ error: 'Deployment failed.' }, { status: 500 })
  }
}
