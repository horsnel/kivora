import { createBrowserClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

// ── Browser client — LAZY singleton ──
// Previously this was a module-level `const`, which meant `createBrowserClient`
// ran during SSR module evaluation. On Cloudflare Pages edge runtime, the
// `@supabase/ssr` singleton cache could return a stale instance across
// requests, and the `isBrowser()` check inside `createBrowserClient` returns
// different values on server vs client — both potential hydration mismatch
// sources. Lazy-init ensures the client is only created when actually needed
// (inside useEffect / event handlers), never during SSR rendering.
let _browserClient = null

export function getSupabasePublic() {
  if (_browserClient) return _browserClient
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    _browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
  }
  return _browserClient
}

// Keep backward compat — `supabasePublic` was used as a direct import.
// Now it lazily creates the client on first access. The getter pattern
// ensures SSR never triggers createBrowserClient during render.
export const supabasePublic = new Proxy({}, {
  get(_, prop) {
    const client = getSupabasePublic()
    if (!client) return undefined
    const value = client[prop]
    return typeof value === 'function' ? value.bind(client) : value
  }
})

// Server-side admin client — lazy initialization for Cloudflare Workers
let _adminClient = null

export function getSupabaseAdmin() {
  if (_adminClient) return _adminClient
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  }
  return _adminClient
}

// Async alias (same as sync — env vars should be available at this point)
export async function getSupabaseAdminAsync() {
  return getSupabaseAdmin()
}

// Keep backward compat
export const supabaseAdmin = null
