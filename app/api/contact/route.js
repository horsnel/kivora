export const runtime = 'edge'
import { getSupabaseAdmin } from '@/lib/supabase'
import { rateLimit } from '@/lib/ratelimit'

export async function POST(req) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown'
  if (!rateLimit(ip).ok) {
    return Response.json({ error: 'Too many requests. Try again in a minute.' }, { status: 429 })
  }

  try {
    const admin = getSupabaseAdmin()
    if (!admin) {
      return Response.json({ error: 'Service not configured' }, { status: 503 })
    }

    const { name, email, subject, message } = await req.json()
    if (!email || !message) {
      return Response.json({ error: 'Email and message are required' }, { status: 400 })
    }

    // Basic email validation
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json({ error: 'Invalid email address' }, { status: 400 })
    }

    // Rate limit per email (prevent spam from same address)
    const { data: recent } = await admin
      .from('contact_submissions')
      .select('id')
      .eq('email', email.toLowerCase())
      .gte('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
      .limit(3)

    if (recent?.length >= 3) {
      return Response.json({ error: 'Too many submissions. Please wait a few minutes.' }, { status: 429 })
    }

    const { error } = await admin.from('contact_submissions').insert({
      name: name?.trim() || null,
      email: email.toLowerCase().trim(),
      subject: subject || 'General question',
      message: message.trim(),
    })

    if (error) throw error

    return Response.json({ success: true })
  } catch (err) {
    return Response.json({ error: err.message || 'Something went wrong' }, { status: 500 })
  }
}
