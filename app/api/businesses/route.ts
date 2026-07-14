import { NextResponse, type NextRequest } from 'next/server'
import { isCurrentUserAdmin } from '@/lib/supabase/admin'
import { createServiceClient } from '@/lib/supabase/server'
import { asTrimmedString, createBusiness, listBusinesses } from '@/lib/services/businesses'

interface CreateBusinessBody {
  business_name?: unknown
  owner_name?: unknown
  business_type_id?: unknown
  email?: unknown
  phone?: unknown
  password?: unknown
}

export async function GET() {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Service client bypasses RLS on purpose — this is the cross-tenant admin
  // view, gated by isCurrentUserAdmin() above instead of per-business RLS.
  const supabase = await createServiceClient()

  try {
    const result = await listBusinesses(supabase)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ data: result.data })
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
    const result = await createBusiness(supabase, { businessName, ownerName, businessTypeId, email, phone, password })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ data: result.data })
  } catch (err) {
    console.error('[businesses:create] unexpected error', err)
    return NextResponse.json({ error: 'Could not create business. Please try again.' }, { status: 500 })
  }
}
