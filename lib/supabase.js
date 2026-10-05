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
let _envWarned = false

// ── Browser env resolution ──
// Order: (1) runtime-injected bootstrap — the root layout embeds the two
// PUBLIC Supabase values from the server/worker env into every SSR'd page
// (window.__KIVORA_ENV__), (2) build-time inlined NEXT_PUBLIC_* vars.
// Step 1 is what fixes Cloudflare Pages direct-upload deploys built without
// NEXT_PUBLIC_* vars: previously the client stayed null and every page
// touching `supabasePublic.auth` crashed with
// "Cannot read properties of undefined (reading 'getUser')".
function readBrowserEnv() {
  if (typeof window !== 'undefined' && window.__KIVORA_ENV__) {
    const { url, key } = window.__KIVORA_ENV__
    if (url && key) return { url, key }
  }
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL,
      key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    }
  }
  return null
}

export function getSupabasePublic() {
  if (_browserClient) return _browserClient
  const env = readBrowserEnv()
  if (env) {
    _browserClient = createBrowserClient(env.url, env.key)
  } else if (!_envWarned && typeof window !== 'undefined') {
    _envWarned = true
    console.error(
      '[supabase] browser client unavailable — no runtime bootstrap (window.__KIVORA_ENV__) and no build-time NEXT_PUBLIC_SUPABASE_URL/ANON_KEY'
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
