import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function middleware(request) {
  // Collect cookies that Supabase wants to set so we can
  // attach them to whatever response we return (next or redirect).
  const cookiesToSet = []

  // Skip if Supabase env vars not configured
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return NextResponse.next({ request })
  }

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

    const { pathname } = request.nextUrl

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
      return withCookies(NextResponse.redirect(url))
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
        return withCookies(NextResponse.redirect(url))
      } catch (_) {
        // If profile check fails, default to dashboard
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return withCookies(NextResponse.redirect(url))
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
          return withCookies(NextResponse.redirect(url))
        }
      } catch (_) {
        // If profile check fails, let the client-side handle it
      }
    }

    // Normal request — pass through with refreshed cookies
    return withCookies(NextResponse.next({ request }))
  } catch (_) {
    // If Supabase is not configured, just continue
    return NextResponse.next({ request })
  }
}

export const config = {
  matcher: ['/dashboard/:path*', '/onboarding/:path*', '/auth/:path*'],
}
