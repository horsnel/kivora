export const runtime = 'edge'

import { getSupabaseAdmin } from '@/lib/supabase'
import { rateLimit, getClientIP } from '@/lib/ratelimit'

// ── Community attachment upload ─────────────────────────────────────
// POST multipart/form-data { file } with an Authorization: Bearer <jwt>.
// Stores the file in the public `community-media` Storage bucket and
// returns { url, name, size, type, kind } for embedding in posts/replies.

const BUCKET = 'community-media'

const IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

const DOC_TYPES = {
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'text/csv': 'csv',
  'application/zip': 'zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
}

const MAX_IMAGE = 5 * 1024 * 1024 // 5 MB
const MAX_DOC = 10 * 1024 * 1024 // 10 MB

function json(body, status) {
  return Response.json(body, { status })
}

export async function POST(req) {
  const ip = getClientIP(req)
  if (!rateLimit(ip, 20).ok) {
    return json({ error: "You're sending requests too quickly. Slow down and try again shortly." }, 429)
  }

  try {
    const admin = getSupabaseAdmin()
    if (!admin) return json({ error: 'Server configuration error' }, 500)

    // ── Auth: verify the caller's JWT — uploads must be signed-in users
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (!token) return json({ error: 'Sign in to upload attachments' }, 401)

    const { data: { user }, error: authError } = await admin.auth.getUser(token)
    if (authError || !user) return json({ error: 'Sign in to upload attachments' }, 401)

    // ── Validate file
    let form
    try {
      form = await req.formData()
    } catch {
      return json({ error: 'Invalid upload — expected multipart form data' }, 400)
    }
    const file = form.get('file')
    if (!file || typeof file === 'string') return json({ error: 'No file provided' }, 400)
    if (file.size === 0) return json({ error: 'File is empty' }, 400)

    const type = file.type || ''
    const isImage = Boolean(IMAGE_TYPES[type])
    const isDoc = Boolean(DOC_TYPES[type])
    if (!isImage && !isDoc) return json({ error: 'Unsupported file type' }, 415)

    const max = isImage ? MAX_IMAGE : MAX_DOC
    if (file.size > max) {
      return json({ error: `File too large — max ${Math.round(max / (1024 * 1024))} MB` }, 413)
    }

    // ── Ensure the public bucket exists (idempotent, service role)
    try {
      const { data: existing } = await admin.storage.getBucket(BUCKET)
      if (!existing) {
        await admin.storage.createBucket(BUCKET, {
          public: true,
          fileSizeLimit: `${MAX_DOC}`,
          allowedMimeTypes: [...Object.keys(IMAGE_TYPES), ...Object.keys(DOC_TYPES)],
        })
      }
    } catch {
      // getBucket/createBucket race or already exists — the upload below is the real test
    }

    // ── Upload to a per-user path (no user-controllable path parts)
    const ext = (isImage ? IMAGE_TYPES : DOC_TYPES)[type]
    const rand = Math.random().toString(36).slice(2, 8)
    const path = `posts/${user.id}/${Date.now()}-${rand}.${ext}`

    const { error: uploadError } = await admin.storage
      .from(BUCKET)
      .upload(path, file, { contentType: type, cacheControl: '31536000', upsert: false })
    if (uploadError) throw uploadError

    const { data: publicUrl } = admin.storage.from(BUCKET).getPublicUrl(path)
    if (!publicUrl?.publicUrl) throw new Error('Upload succeeded but the public URL is missing')

    return json({
      url: publicUrl.publicUrl,
      name: String(file.name || 'file').slice(0, 120),
      size: file.size,
      type,
      kind: isImage ? 'image' : 'file',
    })
  } catch (err) {
    return json({ error: err.message || 'Upload failed' }, 500)
  }
}
