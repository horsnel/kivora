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
  if (supabasePublic) {
    try {
      const { data: { session } } = await supabasePublic.auth.getSession()
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`
      }
    } catch {
      // Session check failed — proceed without auth header (anonymous mode)
    }
  }

  const res = await fetch(url, { ...options, headers })

  // Auto-redirect on expired session (only for page-level fetches, not background)
  if (res.status === 401 && typeof window !== 'undefined' && !url.includes('/api/messages')) {
    window.location.href = '/auth'
  }

  return res
}
