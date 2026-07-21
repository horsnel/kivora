// ── Kivora Sandbox Proxy Route ──
// Proxies requests to the Cloudflare Sandbox Worker
// Falls back gracefully if sandbox is not configured

export const runtime = 'edge' 

import { rateLimit, getClientIP } from '@/lib/ratelimit'
import { isSandboxAvailable, getSandboxUrl, getSandboxHeaders } from '@/lib/sandboxConfig'

export async function POST(req) {
  const ip = getClientIP(req)
  if (!rateLimit(ip).ok) {
    return Response.json({ error: "You're sending requests too quickly. Slow down and try again shortly." }, { status: 429 })
  }

  if (!isSandboxAvailable()) {
    return Response.json({
      error: 'Sandbox not configured. Using Judge0 fallback.',
      sandbox_available: false
    }, { status: 503 })
  }

  try {
    const body = await req.json()
    const { action, sandbox_id, command, code, language, path, content, url: repoUrl, branch, depth, target_dir } = body

    if (!sandbox_id) {
      return Response.json({ error: 'sandbox_id is required' }, { status: 400 })
    }

    const sandboxUrl = getSandboxUrl()
    const headers = getSandboxHeaders()

    // ── Route actions to sandbox worker ──
    let targetUrl, fetchOptions

    switch (action) {
      case 'exec':
        if (!command) return Response.json({ error: 'command is required' }, { status: 400 })
        targetUrl = `${sandboxUrl}/exec?sandbox_id=${encodeURIComponent(sandbox_id)}`
        fetchOptions = {
          method: 'POST',
          headers,
          body: JSON.stringify({ command, timeout: 30000 }),
        }
        break

      case 'run-code':
        if (!code) return Response.json({ error: 'code is required' }, { status: 400 })
        targetUrl = `${sandboxUrl}/run-code?sandbox_id=${encodeURIComponent(sandbox_id)}`
        fetchOptions = {
          method: 'POST',
          headers,
          body: JSON.stringify({ code, language: language || 'python' }),
        }
        break

      case 'files/write':
        if (!path || content === undefined) return Response.json({ error: 'path and content required' }, { status: 400 })
        targetUrl = `${sandboxUrl}/files/write?sandbox_id=${encodeURIComponent(sandbox_id)}`
        fetchOptions = {
          method: 'POST',
          headers,
          body: JSON.stringify({ path, content }),
        }
        break

      case 'files/read':
        if (!path) return Response.json({ error: 'path is required' }, { status: 400 })
        targetUrl = `${sandboxUrl}/files/read?sandbox_id=${encodeURIComponent(sandbox_id)}`
        fetchOptions = {
          method: 'POST',
          headers,
          body: JSON.stringify({ path }),
        }
        break

      case 'files/ls':
        targetUrl = `${sandboxUrl}/files/ls?sandbox_id=${encodeURIComponent(sandbox_id)}`
        fetchOptions = {
          method: 'POST',
          headers,
          body: JSON.stringify({ path: path || '/workspace' }),
        }
        break

      case 'files/mkdir':
        if (!path) return Response.json({ error: 'path is required' }, { status: 400 })
        targetUrl = `${sandboxUrl}/files/mkdir?sandbox_id=${encodeURIComponent(sandbox_id)}`
        fetchOptions = {
          method: 'POST',
          headers,
          body: JSON.stringify({ path }),
        }
        break

      case 'files/rm':
        if (!path) return Response.json({ error: 'path is required' }, { status: 400 })
        targetUrl = `${sandboxUrl}/files/rm?sandbox_id=${encodeURIComponent(sandbox_id)}`
        fetchOptions = {
          method: 'POST',
          headers,
          body: JSON.stringify({ path }),
        }
        break

      case 'git/checkout':
        if (!repoUrl) return Response.json({ error: 'url is required' }, { status: 400 })
        targetUrl = `${sandboxUrl}/git/checkout?sandbox_id=${encodeURIComponent(sandbox_id)}`
        fetchOptions = {
          method: 'POST',
          headers,
          body: JSON.stringify({ url: repoUrl, branch, depth: depth || 1, target_dir }),
        }
        break

      case 'destroy':
        targetUrl = `${sandboxUrl}/destroy?sandbox_id=${encodeURIComponent(sandbox_id)}`
        fetchOptions = { method: 'POST', headers }
        break

      case 'info':
        targetUrl = `${sandboxUrl}/info?sandbox_id=${encodeURIComponent(sandbox_id)}`
        fetchOptions = { method: 'GET', headers }
        break

      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }

    const res = await fetch(targetUrl, fetchOptions)
    const data = await res.json()
    return Response.json({ ...data, sandbox_available: true })

  } catch (err) {
    console.error('[sandbox-proxy]', err)
    return Response.json({ error: err.message || 'Sandbox proxy error' }, { status: 500 })
  }
}

export async function GET(req) {
  const ip = getClientIP(req)
  if (!rateLimit(ip).ok) {
    return Response.json({ error: "You're sending requests too quickly. Slow down and try again shortly." }, { status: 429 })
  }

  if (!isSandboxAvailable()) {
    return Response.json({
      sandbox_available: false,
      fallback: 'judge0',
      message: 'Cloudflare Sandbox not configured. Using Judge0 as fallback.'
    })
  }

  try {
    const url = new URL(req.url)
    const action = url.searchParams.get('action')

    if (action === 'health') {
      const res = await fetch(`${getSandboxUrl()}/health`, { headers: getSandboxHeaders() })
      const data = await res.json()
      return Response.json({ ...data, sandbox_available: true })
    }

    if (action === 'info') {
      const sandboxId = url.searchParams.get('sandbox_id') || 'default'
      const res = await fetch(`${getSandboxUrl()}/info?sandbox_id=${encodeURIComponent(sandboxId)}`, { headers: getSandboxHeaders() })
      const data = await res.json()
      return Response.json({ ...data, sandbox_available: true })
    }

    return Response.json({
      sandbox_available: true,
      sandbox_url: getSandboxUrl(),
    })
  } catch (err) {
    return Response.json({ sandbox_available: false, error: err.message })
  }
}
