import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/types/database'

type BrowserClient = ReturnType<typeof createBrowserClient<Database>>

// Module-level singleton: components used to call createClient() on every
// render/mount, each spinning up its own GoTrueClient with its own
// auto-refresh timer. None of those timers were ever torn down, so a single
// stale/invalid refresh token ended up being retried in parallel by every
// instance that had ever been created — the flood of repeated failed
// "token?grant_type=refresh_token" requests. One shared client fixes that.
let browserClient: BrowserClient | undefined

export function createClient(): BrowserClient {
  if (!browserClient) {
    browserClient = createBrowserClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }

  return browserClient
}
