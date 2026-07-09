import { createClient } from '@/lib/supabase/server'

export async function isCurrentUserAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false

  const { data, error } = await supabase
    .from('admin_users')
    .select('id')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  return !error && data !== null
}
