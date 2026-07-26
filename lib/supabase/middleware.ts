import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Edge Middleware can't use next/headers's cookies() (used by lib/supabase/server.ts),
// so it needs its own client wired to the request/response cookie jars instead.
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refreshes the session cookie if needed — the "badge check" from the analogy.
  // A stale/invalid refresh token makes this reject rather than throw, so check
  // both the error and a try/catch: either way the cookies it holds are dead
  // weight that would otherwise keep getting retried on every future request.
  let user = null
  let refreshFailed = false
  try {
    const { data, error } = await supabase.auth.getUser()
    user = data.user
    refreshFailed = Boolean(error)
  } catch {
    refreshFailed = true
  }

  if (refreshFailed) {
    response.cookies.getAll()
      .filter((cookie) => cookie.name.startsWith('sb-'))
      .forEach((cookie) => response.cookies.delete(cookie.name))
  }

  const path = request.nextUrl.pathname
  const isProtectedRoute = path.startsWith('/admin') || path.startsWith('/dashboard')

  if (isProtectedRoute && !user) {
    const loginUrl = new URL('/auth/login', request.url)
    if (refreshFailed) loginUrl.searchParams.set('sessionExpired', '1')
    return NextResponse.redirect(loginUrl)
  }

  return response
}
