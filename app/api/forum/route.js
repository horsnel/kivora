export const runtime = 'edge' 
import { getSupabaseAdmin } from '@/lib/supabase'
import { rateLimit, getClientIP } from '@/lib/ratelimit'

// ── Attachment sanitizing ──────────────────────────────────────────
// Attachments must point at OUR Storage bucket. Everything else
// (arbitrary external URLs, oversized metadata, junk shapes) is dropped.
const MAX_ATTACHMENTS = 6

function storageOrigin() {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '').origin
  } catch {
    return null
  }
}

function sanitizeAttachments(input) {
  if (!Array.isArray(input)) return []
  const origin = storageOrigin()
  const out = []
  for (const item of input.slice(0, MAX_ATTACHMENTS)) {
    if (!item || typeof item !== 'object') continue
    const url = typeof item.url === 'string' ? item.url : ''
    if (!url) continue
    try {
      const u = new URL(url)
      if (origin && u.origin !== origin) continue
      if (!u.pathname.includes(`/storage/v1/object/public/community-media/`)) continue
    } catch {
      continue
    }
    out.push({
      url,
      name: String(item.name || 'file').slice(0, 200),
      size: Math.min(parseInt(item.size, 10) || 0, 11 * 1024 * 1024),
      type: String(item.type || '').slice(0, 100),
      kind: item.kind === 'image' ? 'image' : 'file',
    })
  }
  return out
}

// Inserts a row; if the `attachments` column doesn't exist yet (migration
// SQL not run), retries without attachments and flags a soft warning
// instead of failing the whole post.
const COLUMN_MISSING_RE = /PGRST204|attachments|schema cache/i

async function insertWithAttachments(table, payload) {
  const atts = Array.isArray(payload.attachments) ? payload.attachments : []
  // Never include the key when empty — keeps posting working even if the
  // migration SQL hasn't been run yet.
  const base = { ...payload }
  delete base.attachments
  const full = atts.length > 0 ? { ...base, attachments: atts } : base

  let { data, error } = await admin_insert(table, full)
  if (error && atts.length > 0 && COLUMN_MISSING_RE.test(`${error.code || ''} ${error.message || ''}`)) {
    const retry = await admin_insert(table, base)
    data = retry.data
    error = retry.error
    return { data, error, rolledBack: true }
  }
  return { data, error, rolledBack: false }
}

function admin_insert(table, payload) {
  // Thin wrapper so the retry path stays readable
  // eslint-disable-next-line no-use-before-define
  return getSupabaseAdmin().from(table).insert(payload).select('id').single()
}

// GET — list posts or get single post with replies
export async function GET(req) {
  try {
    const admin = getSupabaseAdmin()
    if (!admin) {
      return Response.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const { searchParams } = new URL(req.url)
    const postId = searchParams.get('id')

    if (postId) {
      // Get single post with replies
      const { data: post, error: postError } = await admin
        .from('forum_posts')
        .select('*')
        .eq('id', postId)
        .single()

      if (postError) throw postError
      if (!post) return Response.json({ error: 'Post not found' }, { status: 404 })

      const { data: replies, error: repliesError } = await admin
        .from('forum_replies')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true })

      if (repliesError) throw repliesError

      return Response.json({ post, replies: replies || [] })
    }

    // List all posts with reply count
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    const { data: posts, error: postsError } = await admin
      .from('forum_posts')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (postsError) throw postsError

    // Get reply counts for all posts
    const postIds = (posts || []).map(p => p.id)
    let replyCounts = {}
    if (postIds.length > 0) {
      const { data: counts } = await admin
        .from('forum_replies')
        .select('post_id')
        .in('post_id', postIds)

      if (counts) {
        counts.forEach(c => {
          replyCounts[c.post_id] = (replyCounts[c.post_id] || 0) + 1
        })
      }
    }

    const postsWithCounts = (posts || []).map(p => ({
      ...p,
      reply_count: replyCounts[p.id] || 0,
    }))

    return Response.json({ posts: postsWithCounts })
  } catch (err) {
    return Response.json({ error: err.message || 'Something went wrong' }, { status: 500 })
  }
}

// POST — create new post or reply
export async function POST(req) {
  const ip = getClientIP(req)
  if (!rateLimit(ip, 5).ok) {
    return Response.json({ error: "You're sending requests too quickly. Slow down and try again shortly." }, { status: 429 })
  }

  try {
    const admin = getSupabaseAdmin()
    if (!admin) {
      return Response.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const body = await req.json()
    let { user_id, author_name, type } = body

    if (!user_id) {
      return Response.json({ error: 'Authentication required' }, { status: 401 })
    }

    // ── Identity verification: when the client sends its session token,
    //    the verified user ID always wins over the body value.
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    if (token) {
      try {
        const { data: { user } } = await admin.auth.getUser(token)
        if (user) user_id = user.id
      } catch {
        // invalid token → keep body value (legacy behavior), uploads remain protected
      }
    }

    if (type === 'reply') {
      // Create a reply
      const { post_id, body: replyBody, attachments } = body
      if (!post_id || !replyBody?.trim()) {
        return Response.json({ error: 'Post ID and body are required' }, { status: 400 })
      }

      const { data, error, rolledBack } = await insertWithAttachments('forum_replies', {
        post_id,
        user_id,
        body: replyBody.trim(),
        author_name: author_name || 'Anonymous',
        attachments: sanitizeAttachments(attachments),
      })

      if (error) throw error
      return Response.json({ id: data.id, ...(rolledBack ? { warning: 'attachments_rolled_back' } : {}) })
    }

    // Create a new post
    const { title, body: postBody, attachments } = body
    if (!title?.trim() || !postBody?.trim()) {
      return Response.json({ error: 'Title and body are required' }, { status: 400 })
    }
    if (title.trim().length > 200) {
      return Response.json({ error: 'Title must be 200 characters or less' }, { status: 400 })
    }

    const { data, error, rolledBack } = await insertWithAttachments('forum_posts', {
      user_id,
      title: title.trim(),
      body: postBody.trim(),
      author_name: author_name || 'Anonymous',
      attachments: sanitizeAttachments(attachments),
    })

    if (error) throw error
    return Response.json({ id: data.id, ...(rolledBack ? { warning: 'attachments_rolled_back' } : {}) })
  } catch (err) {
    return Response.json({ error: err.message || 'Something went wrong' }, { status: 500 })
  }
}

// DELETE — delete own post or reply
export async function DELETE(req) {
  try {
    const admin = getSupabaseAdmin()
    if (!admin) {
      return Response.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const { type, id, user_id } = await req.json()
    if (!type || !id || !user_id) {
      return Response.json({ error: 'type, id, and user_id are required' }, { status: 400 })
    }

    const table = type === 'reply' ? 'forum_replies' : 'forum_posts'

    const { error } = await admin
      .from(table)
      .delete()
      .eq('id', id)
      .eq('user_id', user_id)

    if (error) throw error
    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message || 'Something went wrong' }, { status: 500 })
  }
}
