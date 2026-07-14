import { NextResponse, type NextRequest } from 'next/server'
import { createRouteHandlerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  // Bug 2 fix: validate `next` is a same-origin path before using it.
  // `new URL('//evil.com', origin)` resolves to https://evil.com — reject it.
  const rawNext = searchParams.get('next') ?? '/dashboard'
  const next =
    rawNext.startsWith('/') && !rawNext.startsWith('//')
      ? rawNext
      : '/dashboard'

  if (!code) {
    // No auth code in URL — something went wrong upstream (e.g. user denied OAuth)
    return NextResponse.redirect(new URL('/auth/login?error=oauth_cancelled', origin))
  }

  // Build the response object first so we can write cookies onto it
  const response = NextResponse.redirect(new URL(next, origin))

  // Construct a Supabase client that reads/writes cookies on this specific response
  const supabase = createRouteHandlerClient(request, response)

  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    // Token exchange failed — send back to login with a generic error flag
    return NextResponse.redirect(
      new URL('/auth/login?error=oauth_exchange_failed', origin)
    )
  }

  // Session cookies are now set on `response` — redirect to dashboard
  return response
}
