import { createBrowserClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

// Browser client using @supabase/ssr
export const supabasePublic =
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ? createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      )
    : null

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
