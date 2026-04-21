export const runtime = 'edge'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function GET(req) {
  const { searchParams, origin } = new URL(req.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = createRouteHandlerClient({ cookies })
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      // Password recovery → send to a password update page
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/auth/update-password`)
      }
      // Email confirmation → send to onboarding
      return NextResponse.redirect(`${origin}/onboarding`)
    }
  }

  // Something went wrong
  return NextResponse.redirect(`${origin}/auth?error=callback_failed`)
}
