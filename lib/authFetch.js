// ── Auth-aware fetch utility ──────────────────────────────────────
// Auto-attaches the Supabase session token to API calls.
// Redirects to /auth on 401 (session expired).
//
// Usage:
//   import { authFetch } from '@/lib/authFetch'
//   const res = await authFetch('/api/chat', { method: 'POST', body: ... })

import { supabasePublic } from '@/lib/supabase'

export async function authFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) }

  // Attach Bearer token if user is logged in
  let hadAuthToken = false
  if (supabasePublic) {
    try {
      const { data: { session } } = await supabasePublic.auth.getSession()
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
        hadAuthToken = true
      }
    } catch {
      // Session check failed — proceed without auth header (anonymous mode)
    }
  }

  const res = await fetch(url, { ...options, headers })

  // Auto-redirect on expired session — but ONLY when the request actually
  // carried a token. v5.22: a 401 on an ANONYMOUS request is a legitimate
  // "guest" answer (e.g. /api/credits/balance on /chat), not an expired
  // session — redirecting there logged every visitor out of /chat and onto
  // the auth wall. Expired-token flows (hadAuthToken) keep the old behavior.
  if (res.status === 401 && hadAuthToken && typeof window !== 'undefined' && !url.includes('/api/messages')) {
    window.location.href = '/auth'
  }

  return res
}
