// ── Server-only Cloudflare Environment Access ──
// This file MUST only be imported from server-side code (API routes, middleware).

// Import the module and access functions at runtime to avoid build-time issues
let _cfModule = null

async function _getCfModule() {
  if (_cfModule) return _cfModule
  try {
    _cfModule = await import('@cloudflare/next-on-pages')
    return _cfModule
  } catch {
    return null
  }
}

/**
 * Get an environment variable from either process.env or Cloudflare Workers env.
 * On Cloudflare Pages, secrets have empty values in process.env but are
 * available through the Workers env via getOptionalRequestContext().
 */
export async function getEnvVar(key) {
  // 1. Try process.env first (works locally + for plain-text vars on CF Pages)
  const procVal = process.env[key]
  if (procVal) return procVal

  // 2. On Cloudflare Pages, secrets are in the Workers env object
  try {
    const mod = await _getCfModule()
    if (mod?.getOptionalRequestContext) {
      const ctx = mod.getOptionalRequestContext()
      if (ctx?.env) {
        const val = ctx.env[key]
        if (val) return val
      }
    }
  } catch {
    // Silently fall through — env var not available
  }

  return ''
}

// ── Auto-detect Cloudflare Account ID from API Token ──
// Caches the result so we only hit the API once per cold start

let _cachedAccountId = null

/**
 * Get the Cloudflare Account ID.
 * 1. Check CF_ACCOUNT_ID env var first (explicit config)
 * 2. Auto-detect from the API token via /accounts endpoint
 */
export async function getCloudflareAccountId() {
  // 1. Explicit env var — fastest path
  const explicit = await getEnvVar('CF_ACCOUNT_ID')
  if (explicit) return explicit

  // 2. Cached from previous auto-detect
  if (_cachedAccountId) return _cachedAccountId

  // 3. Auto-detect from the API token
  const apiToken = await getEnvVar('CF_API_TOKEN')
  if (!apiToken) return ''

  try {
    const res = await fetch('https://api.cloudflare.com/client/v4/accounts', {
      headers: { 'Authorization': `Bearer ${apiToken}` },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return ''

    const data = await res.json()
    if (data.success && data.result?.length > 0) {
      // Use the first account (most users have one)
      _cachedAccountId = data.result[0].id
      return _cachedAccountId
    }
  } catch {
    // Auto-detect failed — token might not have Account Read permission
  }

  return ''
}
