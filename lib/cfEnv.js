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
