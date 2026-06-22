// ── Shared user resolution helper ─────────────────────────────────
// Used by every API route that charges credits. Resolves the Supabase user
// from the Authorization: Bearer <access_token> header.
//
// Returns { user, admin } where:
//   user  — the Supabase auth.user object (or null if anonymous)
//   admin — a service-role Supabase client (for charging credits via RPC)
//
// Usage:
//   const { user, admin } = await resolveUserAndAdmin(req)
//   if (admin && user?.id) {
//     const check = await requireCredits(req, admin, user, 'explore')
//     if (!check.ok) return check.response
//   }

import { createClient } from '@supabase/supabase-js'
import { getEnvVar } from '@/lib/cfEnv'

export async function resolveUserAndAdmin(req) {
  const supaUrl = await getEnvVar('NEXT_PUBLIC_SUPABASE_URL')
  const supaAnon = await getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  const serviceKey = await getEnvVar('SUPABASE_SERVICE_ROLE_KEY')

  let user = null
  const authHeader = req.headers.get('authorization') || ''
  const accessToken = authHeader.replace(/^Bearer\s+/i, '')

  if (accessToken && supaUrl && supaAnon) {
    try {
      const userClient = createClient(supaUrl, supaAnon, {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
      })
      const { data: { user: u } } = await userClient.auth.getUser()
      user = u
    } catch { /* anonymous */ }
  }

  const admin = (supaUrl && serviceKey) ? createClient(supaUrl, serviceKey) : null
  return { user, admin, supaUrl, supaAnon, serviceKey }
}
