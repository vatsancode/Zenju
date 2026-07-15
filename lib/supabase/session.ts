import { createClient } from '@/lib/supabase/server'

// Resolves the business the currently logged-in user belongs to, for
// tenant-scoped API routes (as opposed to the super-admin routes, which use
// isCurrentUserAdmin + createServiceClient instead).
export async function getCurrentBusinessId(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data, error } = await supabase
    .from('business_users')
    .select('business_id')
    .eq('auth_user_id', user.id)
    .eq('is_active', true)
    .limit(1)
    .maybeSingle() as unknown as { data: { business_id: string } | null; error: unknown }

  if (error || !data) return null

  // business_users.is_active alone isn't enough — it stays true when the
  // business itself is suspended (see lib/services/auth.ts), so a session
  // that predates suspension must still be cut off here.
  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('status')
    .eq('id', data.business_id)
    .maybeSingle() as unknown as { data: { status: string } | null; error: unknown }

  if (businessError || business?.status !== 'active') return null
  return data.business_id
}
