import type { createClient } from '@/lib/supabase/server'
import { table } from '@/lib/supabase/server'

type ServiceClient = Awaited<ReturnType<typeof createClient>>

// Every business gets exactly one default branch, created alongside it by
// the create_business_with_owner RPC (see docs/database-schema.md) — this
// is the first runtime reader of that flag.
export async function getDefaultBranchId(supabase: ServiceClient, businessId: string): Promise<string | null> {
  const { data, error } = await table(supabase, 'branches')
    .select('id')
    .eq('business_id', businessId)
    .eq('is_default', true)
    .maybeSingle()
  if (error || !data) return null
  return (data as { id: string }).id
}
