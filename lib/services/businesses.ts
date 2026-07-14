import type { createServiceClient } from '@/lib/supabase/server'
import type { BusinessStatus } from '@/types/database'

export type { BusinessStatus }

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number }

export function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export interface BusinessSummary {
  id: string
  business_name: string
  owner_name: string
  email: string
  phone: string
  business_type_id: string | null
  plan: string
  status: BusinessStatus
  created_at: string
}

export async function listBusinesses(supabase: ServiceClient): Promise<ServiceResult<BusinessSummary[]>> {
  const { data: businesses, error: businessesError } = await supabase
    .from('businesses')
    .select('id, name, business_type_id, subscription_plan, owner_user_id, status, created_at')
    .order('created_at', { ascending: false })

  if (businessesError) {
    console.error('[businesses:list] fetch businesses failed', businessesError)
    return { ok: false, error: 'Could not load businesses. Please try again.', status: 500 }
  }

  if (businesses.length === 0) {
    return { ok: true, data: [] }
  }

  const businessIds = businesses.map(b => b.id)
  const { data: owners, error: ownersError } = await supabase
    .from('business_users')
    .select('business_id, display_name, phone')
    .in('business_id', businessIds)
    .eq('role', 'owner')

  if (ownersError) {
    console.error('[businesses:list] fetch owners failed', ownersError)
    return { ok: false, error: 'Could not load businesses. Please try again.', status: 500 }
  }

  const ownerByBusinessId = new Map(owners.map(o => [o.business_id, o]))

  // One lookup per distinct owner login — email lives in Supabase Auth, not a table we can join.
  const uniqueAuthIds = Array.from(new Set(businesses.map(b => b.owner_user_id)))
  const emailByAuthId = new Map<string, string>()
  await Promise.all(uniqueAuthIds.map(async authId => {
    const { data, error } = await supabase.auth.admin.getUserById(authId)
    if (error || !data.user) {
      console.error('[businesses:list] fetch owner email failed', authId, error)
      return
    }
    emailByAuthId.set(authId, data.user.email ?? '')
  }))

  return {
    ok: true,
    data: businesses.map(b => {
      const owner = ownerByBusinessId.get(b.id)
      return {
        id: b.id,
        business_name: b.name,
        owner_name: owner?.display_name ?? '',
        email: emailByAuthId.get(b.owner_user_id) ?? '',
        phone: owner?.phone ?? '',
        business_type_id: b.business_type_id,
        plan: b.subscription_plan,
        status: b.status,
        created_at: b.created_at,
      }
    }),
  }
}

async function deleteAuthUser(supabase: ServiceClient, authId: string) {
  const { error } = await supabase.auth.admin.deleteUser(authId)
  if (error) console.error('[businesses:create] cleanup failed — deleteUser', authId, error)
}

export interface CreateBusinessInput {
  businessName: string
  ownerName: string
  businessTypeId: string
  email: string
  phone: string
  password: string
}

export async function createBusiness(
  supabase: ServiceClient,
  input: CreateBusinessInput
): Promise<ServiceResult<BusinessSummary>> {
  const { businessName, ownerName, businessTypeId, email, phone, password } = input

  // ── Step 1: create the owner's login ────────────────────────────────────
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authError || !authData.user) {
    console.error('[businesses:create] createUser failed', authError)
    const message = authError?.code === 'email_exists' || authError?.message.toLowerCase().includes('already')
      ? 'An account with this email already exists'
      : 'Could not create the owner login. Please try again.'
    return { ok: false, error: message, status: 400 }
  }

  const newAuthId = authData.user.id

  // ── Steps 2-4: business + business_user + branch, atomically ───────────────
  // create_business_with_owner (supabase/migrations/006_create_business_rpc.sql)
  // runs all three inserts in one Postgres transaction — if any fails, Postgres
  // rolls all of them back automatically. Only the Auth user above (not a
  // regular table, can't join the transaction) needs manual cleanup here.
  const { data: business, error: businessError } = await supabase
    .rpc('create_business_with_owner', {
      p_business_name: businessName,
      p_owner_auth_id: newAuthId,
      p_business_type_id: businessTypeId,
      p_owner_name: ownerName,
      p_owner_phone: phone,
    })

  if (businessError || !business) {
    console.error('[businesses:create] create_business_with_owner failed', businessError)
    await deleteAuthUser(supabase, newAuthId)
    return { ok: false, error: 'Could not create the business. Please try again.', status: 500 }
  }

  return {
    ok: true,
    data: {
      id: business.id,
      business_name: business.name,
      owner_name: ownerName,
      email,
      phone,
      business_type_id: business.business_type_id,
      plan: business.subscription_plan,
      status: business.status,
      created_at: business.created_at,
    },
  }
}

export async function resetBusinessOwnerPassword(
  supabase: ServiceClient,
  businessId: string,
  password: string
): Promise<ServiceResult<null>> {
  // The client only ever sends a business id, never a login id directly —
  // the owner's actual auth user is resolved here, server-side, so a bug
  // or tampered request can only ever target a business that really exists.
  const { data: business, error: businessError } = await supabase
    .from('businesses')
    .select('owner_user_id')
    .eq('id', businessId)
    .maybeSingle()

  if (businessError) {
    console.error('[businesses:reset-password] fetch business failed', businessId, businessError)
    return { ok: false, error: 'Could not reset the password. Please try again.', status: 500 }
  }

  if (!business) {
    return { ok: false, error: 'Business not found', status: 404 }
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(business.owner_user_id, { password })

  if (updateError) {
    console.error('[businesses:reset-password] updateUserById failed', businessId, updateError)
    return { ok: false, error: 'Could not reset the password. Please try again.', status: 500 }
  }

  return { ok: true, data: null }
}

export async function setBusinessStatus(
  supabase: ServiceClient,
  businessId: string,
  status: BusinessStatus
): Promise<ServiceResult<null>> {
  const { data: business, error: updateError } = await supabase
    .from('businesses')
    .update({ status })
    .eq('id', businessId)
    .select('id')
    .maybeSingle()

  if (updateError) {
    console.error('[businesses:set-status] update failed', businessId, updateError)
    return { ok: false, error: 'Could not update the business status. Please try again.', status: 500 }
  }

  if (!business) {
    return { ok: false, error: 'Business not found', status: 404 }
  }

  return { ok: true, data: null }
}
