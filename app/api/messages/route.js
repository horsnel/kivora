export const runtime = 'edge' 
import { getSupabaseAdmin } from '@/lib/supabase'

// Uses user_id query/body param + service role key (bypasses RLS).
// Client validates auth before calling — API trusts user_id from client.

export async function GET(req) {
  try {
    const admin = getSupabaseAdmin()
    if (!admin) {
      return Response.json({ error: 'Database not configured' }, { status: 503 })
    }

    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('user_id')
    const markRead = searchParams.get('markRead')

    // If marking as read
    if (markRead) {
      await admin.from('contact_submissions').update({ read: true }).eq('id', markRead)
      return Response.json({ success: true })
    }

    // Fetch all submissions (admin view for the site owner)
    const { data, error } = await admin
      .from('contact_submissions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100)

    if (error) throw error

    return Response.json({ submissions: data })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req) {
  try {
    const admin = getSupabaseAdmin()
    if (!admin) {
      return Response.json({ error: 'Database not configured' }, { status: 503 })
    }

    const { id } = await req.json()
    if (!id) return Response.json({ error: 'id required' }, { status: 400 })

    const { error } = await admin.from('contact_submissions').delete().eq('id', id)
    if (error) throw error

    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
