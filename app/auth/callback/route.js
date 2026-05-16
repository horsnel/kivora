export const runtime = 'edge'
import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

function htmlRedirect(origin, path, cookiesToSet = []) {
  const url = `${origin}${path}`
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta http-equiv="refresh" content="0;url=${url}" />
</head>
<body>
  <p>Redirecting...</p>
  <script>window.location.href="${url}"</script>
</body>
</html>`

  const res = new NextResponse(html, {
    status: 200,
    headers: { 'Content-Type': 'text/html' },
  })

  cookiesToSet.forEach(({ name, value, options }) => {
    res.cookies.set(name, value, {
      ...options,
      sameSite: 'Lax',
      path: '/',
    })
  })

  return res
}

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type')

  // Debug: check if env vars are available
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    // Env vars missing — redirect with debug info
    const debugUrl = `/auth?error=missing_env&url=${encodeURIComponent(supabaseUrl || 'undefined')}&key=${encodeURIComponent(supabaseKey ? 'set' : 'undefined')}`
    return htmlRedirect(origin, debugUrl)
  }

  if (code) {
    const cookiesToSet = []

    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookies) {
          cookiesToSet.push(...cookies)
        },
      },
    })

    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Password recovery flow
      if (type === 'recovery') {
        return htmlRedirect(origin, '/auth/update-password', cookiesToSet)
      }

      // Check if user has completed onboarding
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('onboarding_done')
            .eq('id', user.id)
            .single()

          if (profile?.onboarding_done) {
            // Returning user — go to dashboard
            return htmlRedirect(origin, '/dashboard', cookiesToSet)
          }
        }
      } catch (_) {
        // If profile check fails, default to onboarding
      }

      // New user or onboarding not done — go to onboarding
      return htmlRedirect(origin, '/onboarding', cookiesToSet)
    }

    // Code exchange failed
    return htmlRedirect(origin, `/auth?error=exchange_failed&msg=${encodeURIComponent(error.message)}`)
  }

  // No code provided
  return htmlRedirect(origin, '/auth?error=no_code')
}
