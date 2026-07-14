import type { createClient } from '@/lib/supabase/client'

export type LoginDestination = 'admin' | 'business' | 'no-access'

export interface LoginDestinationResult {
  destination: LoginDestination
  error: string | null
}

// Admin check always wins. Falling through to "no-access" covers both a
// real orphaned/suspended account and a transient query failure — callers
// must check `error` before treating "no-access" as "show suspended".
export async function resolveLoginDestination(
  supabase: ReturnType<typeof createClient>,
  authUserId: string
): Promise<LoginDestinationResult> {
  const { data: adminRow, error: adminError } = await supabase
    .from('admin_users')
    .select('id')
    .eq('auth_user_id', authUserId)
    .maybeSingle()

  if (adminError) {
    return { destination: 'no-access', error: 'Something went wrong. Please try again.' }
  }
  if (adminRow) {
    return { destination: 'admin', error: null }
  }

  // Cast needed because @supabase/ssr@0.5.2's generic client typings don't
  // line up with @supabase/supabase-js@2.100.1 — .select() results resolve
  // to `never` once a field is accessed, even though the data is correct
  // at runtime. Pre-existing mismatch, not introduced by this query.
  const { data: membership, error: membershipError } = await supabase
    .from('business_users')
    .select('business_id')
    .eq('auth_user_id', authUserId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle() as unknown as { data: { business_id: string } | null; error: unknown }

  if (membershipError) {
    return { destination: 'no-access', error: 'Something went wrong. Please try again.' }
  }
  if (!membership) {
    return { destination: 'no-access', error: null }
  }

  // Membership alone isn't enough — a suspended business must block login
  // even though its business_users rows are still marked is_active.
  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('status')
    .eq('id', membership.business_id)
    .maybeSingle() as unknown as { data: { status: string } | null; error: unknown }

  if (businessError) {
    return { destination: 'no-access', error: 'Something went wrong. Please try again.' }
  }
  if (business?.status === 'active') {
    return { destination: 'business', error: null }
  }

  return { destination: 'no-access', error: null }
}
