export const runtime = 'edge'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  try {
    if (!supabaseAdmin) {
      return Response.json({ error: 'Database not configured' }, { status: 503 })
    }
    // Check Supabase cache first (24hr TTL)
    const { data: cached } = await supabaseAdmin
      .from('exchange_rates')
      .select('rates, updated_at')
      .eq('id', 1)
      .single()

    if (cached) {
      const age = Date.now() - new Date(cached.updated_at).getTime()
      if (age < 86400000) {
        return Response.json(cached.rates)
      }
    }

    // Fetch fresh from free API (no key required)
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD')
    const data = await res.json()

    // Cache in Supabase
    await supabaseAdmin.from('exchange_rates').upsert({
      id: 1,
      rates: data.rates,
      updated_at: new Date().toISOString()
    }, { onConflict: 'id' })

    return Response.json(data.rates)
  } catch (err) {
    // Return cached rates even if stale
    try {
      const { data: fallback } = await supabaseAdmin
        .from('exchange_rates').select('rates').eq('id', 1).single()
      if (fallback?.rates) return Response.json(fallback.rates)
    } catch (_) {}

    return Response.json({}, { status: 500 })
  }
}
