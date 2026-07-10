import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST, not GET — signing out is a state change. A GET version could be
// triggered by link prefetching, crawlers, or a plain <img src> from another
// site (CSRF-lite); POST at least requires an explicit form submit or fetch.
export async function POST(request: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/auth/login', request.url))
}
