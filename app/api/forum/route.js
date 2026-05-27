export const runtime = 'edge'
import { getSupabaseAdmin } from '@/lib/supabase'
import { rateLimit } from '@/lib/ratelimit'

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
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!rateLimit(ip, 5).ok) {
    return Response.json({ error: "You're sending requests too quickly. Slow down and try again shortly." }, { status: 429 })
  }

  try {
    const admin = getSupabaseAdmin()
    if (!admin) {
      return Response.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const body = await req.json()
    const { user_id, author_name, type } = body

    if (!user_id) {
      return Response.json({ error: 'Authentication required' }, { status: 401 })
    }

    if (type === 'reply') {
      // Create a reply
      const { post_id, body: replyBody } = body
      if (!post_id || !replyBody?.trim()) {
        return Response.json({ error: 'Post ID and body are required' }, { status: 400 })
      }

      const { data, error } = await admin
        .from('forum_replies')
        .insert({
          post_id,
          user_id,
          body: replyBody.trim(),
          author_name: author_name || 'Anonymous',
        })
        .select('id')
        .single()

      if (error) throw error
      return Response.json({ id: data.id })
    }

    // Create a new post
    const { title, body: postBody } = body
    if (!title?.trim() || !postBody?.trim()) {
      return Response.json({ error: 'Title and body are required' }, { status: 400 })
    }
    if (title.trim().length > 200) {
      return Response.json({ error: 'Title must be 200 characters or less' }, { status: 400 })
    }

    const { data, error } = await admin
      .from('forum_posts')
      .insert({
        user_id,
        title: title.trim(),
        body: postBody.trim(),
        author_name: author_name || 'Anonymous',
      })
      .select('id')
      .single()

    if (error) throw error
    return Response.json({ id: data.id })
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
