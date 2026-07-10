import { NextResponse, type NextRequest } from 'next/server'
import { isCurrentUserAdmin } from '@/lib/supabase/admin'
import { createServiceClient } from '@/lib/supabase/server'

interface CreateBusinessBody {
  business_name?: unknown
  owner_name?: unknown
  business_type_id?: unknown
  email?: unknown
  phone?: unknown
  password?: unknown
}

function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>

async function deleteBusiness(supabase: ServiceClient, businessId: string) {
  const { error } = await supabase.from('businesses').delete().eq('id', businessId)
  if (error) console.error('[businesses:create] cleanup failed — delete businesses', businessId, error)
}

async function deleteBusinessUsers(supabase: ServiceClient, businessId: string) {
  const { error } = await supabase.from('business_users').delete().eq('business_id', businessId)
  if (error) console.error('[businesses:create] cleanup failed — delete business_users', businessId, error)
}

async function deleteAuthUser(supabase: ServiceClient, authId: string) {
  const { error } = await supabase.auth.admin.deleteUser(authId)
  if (error) console.error('[businesses:create] cleanup failed — deleteUser', authId, error)
}

export async function GET() {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Service client bypasses RLS on purpose — this is the cross-tenant admin
  // view, gated by isCurrentUserAdmin() above instead of per-business RLS.
  const supabase = await createServiceClient()

  try {
    const { data: businesses, error: businessesError } = await supabase
      .from('businesses')
      .select('id, name, business_type_id, subscription_plan, owner_user_id, created_at')
      .order('created_at', { ascending: false })

    if (businessesError) {
      console.error('[businesses:list] fetch businesses failed', businessesError)
      return NextResponse.json({ error: 'Could not load businesses. Please try again.' }, { status: 500 })
    }

    if (businesses.length === 0) {
      return NextResponse.json({ businesses: [] })
    }

    const businessIds = businesses.map(b => b.id)
    const { data: owners, error: ownersError } = await supabase
      .from('business_users')
      .select('business_id, display_name, phone')
      .in('business_id', businessIds)
      .eq('role', 'owner')

    if (ownersError) {
      console.error('[businesses:list] fetch owners failed', ownersError)
      return NextResponse.json({ error: 'Could not load businesses. Please try again.' }, { status: 500 })
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

    return NextResponse.json({
      businesses: businesses.map(b => {
        const owner = ownerByBusinessId.get(b.id)
        return {
          id: b.id,
          business_name: b.name,
          owner_name: owner?.display_name ?? '',
          email: emailByAuthId.get(b.owner_user_id) ?? '',
          phone: owner?.phone ?? '',
          business_type_id: b.business_type_id,
          plan: b.subscription_plan,
          created_at: b.created_at,
        }
      }),
    })
  } catch (err) {
    console.error('[businesses:list] unexpected error', err)
    return NextResponse.json({ error: 'Could not load businesses. Please try again.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: CreateBusinessBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const businessName = asTrimmedString(body.business_name)
  const ownerName = asTrimmedString(body.owner_name)
  const businessTypeId = asTrimmedString(body.business_type_id)
  const email = asTrimmedString(body.email)
  const phone = asTrimmedString(body.phone)
  const password = typeof body.password === 'string' ? body.password : ''

  if (!businessName) return NextResponse.json({ error: 'Business name is required' }, { status: 400 })
  if (!ownerName) return NextResponse.json({ error: 'Owner name is required' }, { status: 400 })
  if (!businessTypeId) return NextResponse.json({ error: 'Business type is required' }, { status: 400 })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'A valid email is required' }, { status: 400 })
  }
  // Owner is mandatory phone-on-file — matches the business_users_owner_phone_check DB constraint
  if (!phone) return NextResponse.json({ error: 'Phone is required for the business owner' }, { status: 400 })
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  // Service client bypasses RLS on purpose — this is the cross-tenant admin
  // action (creating a business for any owner), gated by isCurrentUserAdmin()
  // above instead of per-business RLS.
  const supabase = await createServiceClient()

  try {
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
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const newAuthId = authData.user.id

    // ── Step 2: create the business ───────────────────────────────────────────
    const { data: business, error: businessError } = await supabase
      .from('businesses')
      .insert({
        name: businessName,
        owner_user_id: newAuthId,
        business_type_id: businessTypeId,
        subscription_plan: 'free',
        currency: 'INR',
      })
      .select('id, name, business_type_id, subscription_plan, created_at')
      .single()

    if (businessError || !business) {
      console.error('[businesses:create] insert businesses failed', businessError)
      await deleteAuthUser(supabase, newAuthId)
      return NextResponse.json({ error: 'Could not create the business. Please try again.' }, { status: 500 })
    }

    // ── Step 3: attach the owner to the business ──────────────────────────────
    const { error: businessUserError } = await supabase
      .from('business_users')
      .insert({
        business_id: business.id,
        auth_user_id: newAuthId,
        role: 'owner',
        branch_id: null,
        display_name: ownerName,
        phone,
        is_active: true,
      })

    if (businessUserError) {
      console.error('[businesses:create] insert business_users failed', businessUserError)
      await deleteBusiness(supabase, business.id)
      await deleteAuthUser(supabase, newAuthId)
      return NextResponse.json({ error: 'Could not create the business. Please try again.' }, { status: 500 })
    }

    // ── Step 4: give the business its default branch ─────────────────────────
    const { error: branchError } = await supabase
      .from('branches')
      .insert({
        business_id: business.id,
        name: 'Main Store',
        address: null,
        is_default: true,
      })

    if (branchError) {
      console.error('[businesses:create] insert branches failed', branchError)
      await deleteBusinessUsers(supabase, business.id)
      await deleteBusiness(supabase, business.id)
      await deleteAuthUser(supabase, newAuthId)
      return NextResponse.json({ error: 'Could not create the business. Please try again.' }, { status: 500 })
    }

    return NextResponse.json({
      business: {
        id: business.id,
        business_name: business.name,
        owner_name: ownerName,
        email,
        phone,
        business_type_id: business.business_type_id,
        plan: business.subscription_plan,
        created_at: business.created_at,
      },
    })
  } catch (err) {
    console.error('[businesses:create] unexpected error', err)
    return NextResponse.json({ error: 'Could not create business. Please try again.' }, { status: 500 })
  }
}
