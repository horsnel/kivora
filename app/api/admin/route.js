export const runtime = 'edge'
import { getSupabaseAdmin } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { getEnvVar } from '@/lib/cfEnv'
import { getClientIP } from '@/lib/ratelimit'

// ── Brute-force protection (RedSentinel: "Public admin panel detected") ──
// Durable per-IP cap on FAILED admin-password attempts, stored in the
// existing anon_daily_usage table (action='admin_login_fail'). Successful
// logins never consume budget, so a legitimate admin can never lock
// themselves out; table failures fail open for the same reason.
const MAX_FAILED_ATTEMPTS_PER_DAY = 25

async function failedAttemptsToday(admin, ip) {
  if (!admin || !ip || ip === 'unknown') return 0
  try {
    const today = new Date().toISOString().slice(0, 10)
    const { data } = await admin
      .from('anon_daily_usage')
      .select('count')
      .eq('ip', ip)
      .eq('action', 'admin_login_fail')
      .eq('date', today)
      .maybeSingle()
    return data?.count || 0
  } catch {
    return 0
  }
}

async function recordFailedAttempt(admin, ip) {
  if (!admin || !ip || ip === 'unknown') return
  try {
    const today = new Date().toISOString().slice(0, 10)
    const { data } = await admin
      .from('anon_daily_usage')
      .select('count')
      .eq('ip', ip)
      .eq('action', 'admin_login_fail')
      .eq('date', today)
      .maybeSingle()
    if (data) {
      await admin
        .from('anon_daily_usage')
        .update({ count: data.count + 1, updated_at: new Date().toISOString() })
        .eq('ip', ip)
        .eq('action', 'admin_login_fail')
        .eq('date', today)
    } else {
      await admin
        .from('anon_daily_usage')
        .insert({ ip, action: 'admin_login_fail', date: today, count: 1 })
    }
  } catch {
    // Fail open — never lock the admin out because of a table hiccup
  }
}

// Timing-safe string compare: hash both sides first so length and content
// leak nothing through early-exit timing (crypto.subtle on edge + Node).
async function timingSafeEqual(a, b) {
  try {
    const enc = new TextEncoder()
    const [da, db] = await Promise.all([
      crypto.subtle.digest('SHA-256', enc.encode(String(a))),
      crypto.subtle.digest('SHA-256', enc.encode(String(b))),
    ])
    const va = new Uint8Array(da)
    const vb = new Uint8Array(db)
    let diff = 0
    for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i]
    return diff === 0
  } catch {
    return a === b
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export async function GET(req) {
  try {
    const admin = getSupabaseAdmin()
    if (!admin) {
      return Response.json({ error: 'Server configuration error' }, { status: 500 })
    }

    // ── Auth (two paths, both server-verified) ──
    // 1. Admin password sent as x-admin-key (checked against ADMIN_PASSWORD env var)
    // 2. Supabase JWT via Authorization: Bearer — must belong to a profile with is_admin
    // NOTE: client-supplied user IDs are never trusted — identity comes from the JWT.
    const adminKey = req.headers.get('x-admin-key')
    const envPassword = await getEnvVar('ADMIN_PASSWORD')

    let authorized = false

    if (envPassword && adminKey) {
      // ── Password path: rate-limited + timing-safe ──
      const ip = getClientIP(req)
      const attempts = await failedAttemptsToday(admin, ip)
      if (attempts >= MAX_FAILED_ATTEMPTS_PER_DAY) {
        return Response.json(
          { error: 'Too many failed attempts — try again after 00:00 UTC.' },
          { status: 429, headers: { 'Retry-After': '3600' } }
        )
      }
      if (await timingSafeEqual(adminKey, envPassword)) {
        authorized = true
      } else {
        await recordFailedAttempt(admin, ip)
        await sleep(400) // blunt online brute force
      }
    } else {
      const authHeader = req.headers.get('authorization') || ''
      const accessToken = authHeader.replace(/^Bearer\s+/i, '')
      const supaUrl = await getEnvVar('NEXT_PUBLIC_SUPABASE_URL')
      const supaAnon = await getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY')

      if (accessToken && supaUrl && supaAnon) {
        try {
          const userClient = createClient(supaUrl, supaAnon, {
            global: { headers: { Authorization: `Bearer ${accessToken}` } },
          })
          const { data: { user } } = await userClient.auth.getUser()
          if (user) {
            const { data: profile } = await admin
              .from('profiles')
              .select('is_admin')
              .eq('id', user.id)
              .single()
            if (profile?.is_admin) authorized = true
          }
        } catch { /* invalid token — unauthorized */ }
      }
    }

    if (!authorized) {
      return Response.json({ error: 'Forbidden — admin access required' }, { status: 403 })
    }

    // Fetch all metrics in parallel
    const [
      usersResult,
      chatsResult,
      exploreResult,
      contactsResult,
      sessionsResult,
      recentSignupsResult,
      recentSessionsResult,
    ] = await Promise.all([
      admin.from('profiles').select('id', { count: 'exact', head: true }),
      admin.from('chat_sessions').select('id', { count: 'exact', head: true }),
      admin.from('explore_cache').select('id', { count: 'exact', head: true }),
      admin.from('contact_submissions').select('id', { count: 'exact', head: true }),
      admin.from('study_sessions').select('id', { count: 'exact', head: true }),
      admin.from('profiles').select('id, email, display_name, created_at').order('created_at', { ascending: false }).limit(10),
      admin.from('study_sessions').select('id, user_id, tool_type, subject, created_at').order('created_at', { ascending: false }).limit(20),
    ])

    return Response.json({
      metrics: {
        totalUsers: usersResult.count || 0,
        totalChats: chatsResult.count || 0,
        totalExplore: exploreResult.count || 0,
        totalContacts: contactsResult.count || 0,
        totalSessions: sessionsResult.count || 0,
      },
      recentSignups: recentSignupsResult.data || [],
      recentActivity: recentSessionsResult.data || [],
    })
  } catch (err) {
    return Response.json({ error: err.message || 'Something went wrong' }, { status: 500 })
  }
}
