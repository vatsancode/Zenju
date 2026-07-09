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

  const { data: membership, error: membershipError } = await supabase
    .from('business_users')
    .select('id')
    .eq('auth_user_id', authUserId)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle()

  if (membershipError) {
    return { destination: 'no-access', error: 'Something went wrong. Please try again.' }
  }
  if (membership) {
    return { destination: 'business', error: null }
  }

  return { destination: 'no-access', error: null }
}
