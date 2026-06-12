export const runtime = 'edge'

import { getSupabaseAdmin } from '@/lib/supabase'

// ══════════════════════════════════════════════════════════════════
// APEX 2.0 DIALOGUE API — Dialogic Wiki interface
// GET  /api/apex/dialogue?page_id=...  — Get dialogue for a wiki page
// POST /api/apex/dialogue              — Add a dialogue entry
// ══════════════════════════════════════════════════════════════════

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const pageId = searchParams.get('page_id')
  const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100)

  if (!pageId) {
    return Response.json({ error: 'page_id required' }, { status: 400 })
  }

  const admin = getSupabaseAdmin()
  if (!admin) {
    return Response.json({ error: 'Database not configured' }, { status: 503 })
  }

  try {
    const { data, error } = await admin
      .from('apex_wiki_dialogue')
      .select('*')
      .eq('page_id', pageId)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ dialogue: data || [] })
  } catch (err) {
    console.error('[APEX Dialogue] GET error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request) {
  const admin = getSupabaseAdmin()
  if (!admin) {
    return Response.json({ error: 'Database not configured' }, { status: 503 })
  }

  try {
    const body = await request.json()
    const { pageId, message, messageType = 'question', intent = '', referencedClaims = [] } = body

    if (!pageId || !message) {
      return Response.json({ error: 'pageId and message required' }, { status: 400 })
    }

    // Insert the user's message
    const { data: userMsg, error: insertErr } = await admin
      .from('apex_wiki_dialogue')
      .insert({
        page_id: pageId,
        message,
        role: 'user',
        message_type: messageType,
        intent,
        referenced_claims: JSON.stringify(referencedClaims),
      })
      .select('id')
      .single()

    if (insertErr) {
      return Response.json({ error: insertErr.message }, { status: 500 })
    }

    // Get the wiki page for context
    const { data: page } = await admin
      .from('apex_wiki_pages')
      .select('title, content, slug')
      .eq('id', pageId)
      .single()

    // Get recent dialogue for context
    const { data: recentDialogue } = await admin
      .from('apex_wiki_dialogue')
      .select('role, message, message_type, created_at')
      .eq('page_id', pageId)
      .order('created_at', { ascending: true })
      .limit(10)

    // Insert APEX response placeholder
    const { data: apexMsg } = await admin
      .from('apex_wiki_dialogue')
      .insert({
        page_id: pageId,
        message: 'Processing your question...',
        role: 'apex',
        message_type: 'answer',
        intent: intent || 'explore',
      })
      .select('id')
      .single()

    return Response.json({
      success: true,
      userMessageId: userMsg?.id,
      apexMessageId: apexMsg?.id,
      pageSlug: page?.slug,
      dialogueContext: recentDialogue?.slice(-6) || [],
    })
  } catch (err) {
    console.error('[APEX Dialogue] POST error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
