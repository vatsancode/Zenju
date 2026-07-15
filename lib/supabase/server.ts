import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import type { NextRequest, NextResponse } from 'next/server'
import type { Database } from '@/types/database'

// @supabase/ssr's generic client typings don't line up with
// @supabase/supabase-js's — the RLS-respecting client loses its Database
// generics past `.from()`, typing every result (and insert/update argument)
// as `never`. Routed through `any` at this single query-builder boundary;
// every value in and out must be cast back to a named type immediately
// after use at each call site. Consolidated here so there's one place to
// remove this once the package versions are reconciled, instead of a copy
// per service file.
export function table(
  supabase: Awaited<ReturnType<typeof createClient>>,
  name: keyof Database['public']['Tables']
): any {
  return supabase.from(name)
}

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from a Server Component — safe to ignore
          }
        },
      },
    }
  )
}

// For route handlers that build their own NextResponse (e.g. OAuth callback
// redirects) — cookies must be read from the incoming request and written
// onto that specific response, not the ambient cookies() store.
export function createRouteHandlerClient(request: NextRequest, response: NextResponse) {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )
}

// Service-role client for admin operations (bypasses RLS).
// Deliberately NOT cookie/session-aware — createServerClient reads the
// current visitor's own session from cookies and uses that identity for
// requests, which defeats the purpose of a service-role client (it would
// still be evaluated under RLS as the logged-in user, not as a full-access
// role). This uses the plain client with session persistence disabled, so
// every request always goes out authenticated purely as the service role.
export async function createServiceClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
