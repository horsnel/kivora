// ════════════════════════════════════════════════════════════════════
// GET|POST|DELETE /api/vfs — Kivora Agent Workspace API (v5.27)
//
// User-facing CRUD over the persistent virtual file system that backs
// the AI agent's terminal (lib/vfs.js). Powers the chat Workspace panel.
//
//   GET    ?path=src/main.py           → single file (content or base64)
//   GET    ?download=1&path=out.csv    → file with Content-Disposition
//   GET    ?prefix=src/                → list (default: whole workspace)
//   POST   { path, content, workspace?, mime? } → write/upsert
//   DELETE ?path=...                   → delete
//
// Auth: Bearer access token (resolveUserAndAdmin) — anonymous requests
// get 401 with a sign-in hint. runtime=edge is MANDATORY for
// next-on-pages (v5.22 lesson).
// ════════════════════════════════════════════════════════════════════
import { resolveUserAndAdmin } from '@/lib/authUser'
import { vfsWrite, vfsRead, vfsList, vfsDelete, normalizeWorkspace, formatBytes } from '@/lib/vfs'

export const runtime = 'edge'

const json = (body, status = 200, extra = {}) =>
  Response.json(body, { status, headers: { 'cache-control': 'no-store', ...extra } })

async function handle(req) {
  const { user, admin } = await resolveUserAndAdmin(req)
  if (!user || !admin) {
    return json({ ok: false, error: 'unauthenticated', detail: 'Sign in to use your workspace.' }, 401)
  }
  const u = new URL(req.url)
  const workspace = normalizeWorkspace(u.searchParams.get('workspace') || 'default') || 'default'
  const method = req.method

  try {
    if (method === 'GET') {
      const path = u.searchParams.get('path')
      const download = u.searchParams.get('download') === '1'
      if (!path) {
        const r = await vfsList(admin, user.id, workspace, u.searchParams.get('prefix') || '')
        if (!r.ok) return json(r, r.reason === 'workspace_unavailable' ? 401 : 400)
        return json({ ok: true, workspace: r.workspace, files: r.files })
      }
      const r = await vfsRead(admin, user.id, workspace, path)
      if (!r.ok) return json(r, r.reason === 'not_found' ? 404 : 400)
      if (download && !r.isBase64) {
        return new Response(r.content, {
          status: 200,
          headers: {
            'content-type': r.mime || 'text/plain; charset=utf-8',
            'content-disposition': `attachment; filename="${r.path.split('/').pop().replace(/"/g, '')}"`,
            'cache-control': 'no-store',
          },
        })
      }
      if (download && r.isBase64) {
        const bin = atob(r.content)
        const bytes = new Uint8Array(bin.length)
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
        return new Response(bytes, {
          status: 200,
          headers: {
            'content-type': r.mime || 'application/octet-stream',
            'content-disposition': `attachment; filename="${r.path.split('/').pop().replace(/"/g, '')}"`,
            'cache-control': 'no-store',
          },
        })
      }
      return json(r)
    }

    if (method === 'POST') {
      const body = await req.json().catch(() => null)
      if (!body || typeof body.path !== 'string') return json({ ok: false, error: 'bad_request', detail: 'path required' }, 400)
      if (typeof body.content !== 'string') return json({ ok: false, error: 'bad_request', detail: 'content required' }, 400)
      const r = await vfsWrite(admin, user.id, body.workspace || workspace, body.path, body.content, {
        mime: body.mime,
        isBase64: body.isBase64 === true,
      })
      if (!r.ok) {
        const status = r.reason === 'too_large' || r.reason === 'bad_path' || r.reason === 'bad_workspace' ? 400 : r.reason === 'quota' ? 413 : 500
        return json(r, status)
      }
      return json(r)
    }

    if (method === 'DELETE') {
      const path = u.searchParams.get('path')
      if (!path) return json({ ok: false, error: 'bad_request', detail: 'path required' }, 400)
      const r = await vfsDelete(admin, user.id, workspace, path)
      if (!r.ok) return json(r, r.reason === 'not_found' ? 404 : 400)
      return json(r)
    }

    return json({ ok: false, error: 'method_not_allowed' }, 405)
  } catch (e) {
    return json({ ok: false, error: 'server_error', detail: String(e?.message || '').slice(0, 200) }, 500)
  }
}

export async function GET(req) {
  return handle(req)
}
export async function POST(req) {
  return handle(req)
}
export async function DELETE(req) {
  return handle(req)
}
