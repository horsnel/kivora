import { createBrowserClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

// Browser client using @supabase/ssr — stores PKCE verifier in cookies
// so the server-side callback can read it during OAuth flows.
export const supabasePublic =
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ? createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      )
    : null

// Server-side admin client — uses service role key, bypasses RLS
// Lazy initialization: CloudFlare Edge workers may not have env vars
// available at module evaluation time, so we create on first access.
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

// Keep backward compat — but this will be null until first call to getSupabaseAdmin()
export const supabaseAdmin = null
