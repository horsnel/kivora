import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

// ════════════════════════════════════════════════════════════════════
// Kivora edge middleware — three jobs:
//
// 1. CSP STRATEGY (hybrid, fixes the 'unsafe-inline' finding):
//    - 30 prerendered (static) pages get a build-time HASH-based CSP,
//      injected into public/_headers by scripts/generate-csp.mjs after
//      each build. Middleware must NOT attach a second CSP there
//      (browsers enforce every CSP header — a nonce policy would have
//      to be satisfied too, breaking hash'd scripts).
//    - 4 server-rendered page routes (/auth/callback, /build/<id>,
//      /build/<id>/<part>, /explore/<slug>) render per request, so their
//      inline scripts can only be authorized with a per-request NONCE.
//      Middleware mints the nonce, sets the CSP on the REQUEST headers
//      (Next.js then auto-nonces every script it renders) and on the
//      response for exactly those paths. Their paths are excluded from
//      the generated _headers CSP for the same dual-policy reason.
//
// 2. SECURITY HEADERS + tech-stack fingerprint stripping on every
//    matched route (x-powered-by / x-matched-path / x-nextjs-* etc.).
//
// 3. SUPABASE SESSION HANDLING (auth path groups only — unchanged
//    behavior: cookie refresh + route protection redirects).
// ════════════════════════════════════════════════════════════════════

// Server-rendered page routes (must stay in sync with the dynamic routes
// in the app — scripts/generate-csp.mjs excludes them from _headers).
const DYNAMIC_PAGE_RE =
  /^\/auth\/callback$|^\/build\/[^/]+(?:\/[^/]+)?$|^\/explore\/[^/]+$/

function buildNonceCsp(nonce) {
  return [
    "default-src 'self'",
    // 'strict-dynamic' lets nonce-trusted scripts load their dependents at
    // runtime (webpack chunks, next/script injections, mermaid from jsdelivr)
    // — no host allowlist needed, and attacker-injected scripts are blocked.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "media-src 'self' blob: data: https:",
    // next/font self-hosts Inter + JetBrains Mono — no external font hosts
    "font-src 'self' data:",
    "connect-src 'self' https://asfzdbpfakwpiawhhrby.supabase.co wss://asfzdbpfakwpiawhhrby.supabase.co",
    "frame-src 'self' blob: data:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ')
}

// Attaches the hardened header set to a response (and strips the headers
// that fingerprint our stack — the "Technology stack disclosed" finding).
function applySecurityHeaders(response, pathname, cspOrNull) {
  const h = response.headers
  if (cspOrNull) h.set('Content-Security-Policy', cspOrNull)
  h.set('X-Content-Type-Options', 'nosniff')
  h.set('X-Frame-Options', 'DENY')
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  h.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  h.set(
    'Permissions-Policy',
    'camera=(), microphone=(self), geolocation=(), payment=(), usb=(), interest-cohort=()'
  )
  h.set('Cross-Origin-Opener-Policy', 'same-origin')
  h.set('Cross-Origin-Resource-Policy', 'same-origin')
  // Admin panel must never be indexed
  if (pathname.startsWith('/admin')) {
    h.set('X-Robots-Tag', 'noindex, nofollow')
  }
  // Tech-stack disclosure reduction
  h.delete('x-powered-by')
  h.delete('x-matched-path')
  h.delete('x-nextjs-prerender')
  h.delete('x-nextjs-stale-time')
  return response
}

export async function middleware(request) {
  const { pathname } = request.nextUrl

  // ── 1. Mint nonce + request-header CSP (drives Next auto-nonce on SSR'd
  //      pages; ignored when serving prerendered HTML bytes) ──
  const nonce = crypto.randomUUID().replace(/-/g, '')
  const nonceCsp = buildNonceCsp(nonce)

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', nonceCsp)

  // Attach the response CSP ONLY to the server-rendered page routes —
  // prerendered pages rely on the hash CSP from public/_headers
  // (scripts/generate-csp.mjs) and must not receive a second policy.
  const responseCsp = DYNAMIC_PAGE_RE.test(pathname) ? nonceCsp : null

  const isAuthPath =
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/auth')

  // ── 2. Supabase session handling — auth path groups only ──
  if (
    isAuthPath &&
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    // Collect cookies that Supabase wants to set so we can
    // attach them to whatever response we return (next or redirect).
    const cookiesToSet = []

    try {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
          cookies: {
            getAll() {
              return request.cookies.getAll()
            },
            setAll(cookies) {
              // Update request cookies so the Supabase client sees them immediately
              cookies.forEach(({ name, value }) =>
                request.cookies.set(name, value)
              )
              // Save for later — we'll attach to whichever response we return
              cookiesToSet.push(...cookies)
            },
          },
        }
      )

      // This triggers cookie reads/refreshes — calls setAll if tokens need updating
      const { data: { session } } = await supabase.auth.getSession()

      // Helper: attach collected cookies to any response
      function withCookies(res) {
        cookiesToSet.forEach(({ name, value, options }) =>
          res.cookies.set(name, value, { ...options, sameSite: 'Lax' })
        )
        return res
      }

      // Protect dashboard and onboarding — require login
      if ((pathname.startsWith('/dashboard') || pathname.startsWith('/onboarding')) && !session) {
        const url = request.nextUrl.clone()
        url.pathname = '/auth'
        url.searchParams.set('redirect', pathname)
        return applySecurityHeaders(
          withCookies(NextResponse.redirect(url)),
          pathname,
          responseCsp
        )
      }

      // If logged in user hits /auth (but NOT /auth/callback or /auth/reset or /auth/update-password), redirect appropriately
      if (pathname === '/auth' && session) {
        // Check onboarding status before deciding where to redirect
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('onboarding_done')
            .eq('id', session.user.id)
            .single()

          const url = request.nextUrl.clone()
          url.pathname = profile?.onboarding_done ? '/dashboard' : '/onboarding'
          return applySecurityHeaders(
            withCookies(NextResponse.redirect(url)),
            pathname,
            responseCsp
          )
        } catch (_) {
          // If profile check fails, default to dashboard
          const url = request.nextUrl.clone()
          url.pathname = '/dashboard'
          return applySecurityHeaders(
            withCookies(NextResponse.redirect(url)),
            pathname,
            responseCsp
          )
        }
      }

      // If logged in user hits /dashboard but hasn't completed onboarding, redirect to onboarding
      if (pathname.startsWith('/dashboard') && session) {
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('onboarding_done')
            .eq('id', session.user.id)
            .single()

          if (!profile?.onboarding_done) {
            const url = request.nextUrl.clone()
            url.pathname = '/onboarding'
            return applySecurityHeaders(
              withCookies(NextResponse.redirect(url)),
              pathname,
              responseCsp
            )
          }
        } catch (_) {
          // If profile check fails, let the client-side handle it
        }
      }

      // Protect /admin route — redirect unauthenticated users
      if (pathname.startsWith('/admin') && !session) {
        const url = request.nextUrl.clone()
        url.pathname = '/'
        return applySecurityHeaders(
          withCookies(NextResponse.redirect(url)),
          pathname,
          responseCsp
        )
      }

      // Normal request — pass through with refreshed cookies
      return applySecurityHeaders(
        withCookies(NextResponse.next({ request: { headers: requestHeaders } })),
        pathname,
        responseCsp
      )
    } catch (_) {
      // If Supabase session handling fails, continue with security headers only
      return applySecurityHeaders(
        NextResponse.next({ request: { headers: requestHeaders } }),
        pathname,
        responseCsp
      )
    }
  }

  // ── 3. Everyone else — passthrough with hardened headers (CSP only for
  //      the SSR'd page routes; static pages carry the _headers hash CSP) ──
  return applySecurityHeaders(
    NextResponse.next({ request: { headers: requestHeaders } }),
    pathname,
    responseCsp
  )
}

export const config = {
  matcher: [
    // All page + API paths EXCEPT static assets (any path with a file
    // extension) and Next internals. Static assets keep the public/_headers
    // hardening without a middleware round-trip.
    '/((?!_next/static|_next/image|.*\\..*).*)',
  ],
}
