import { NextResponse, type NextRequest } from 'next/server'
import { isCurrentUserAdmin } from '@/lib/supabase/admin'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Service client bypasses RLS on purpose — this is the cross-tenant admin
  // view, gated by isCurrentUserAdmin() above instead of per-business RLS.
  const supabase = await createServiceClient()

  try {
    const { data, error } = await supabase
      .from('business_types')
      .select('id, name')
      .order('name')

    if (error) {
      console.error('[business-types:list] fetch business_types failed', error)
      return NextResponse.json({ error: 'Could not load business types. Please try again.' }, { status: 500 })
    }
    return NextResponse.json({ data })
  } catch (err) {
    console.error('[business-types:list] unexpected error', err)
    return NextResponse.json({ error: 'Could not load business types. Please try again.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let name: unknown
  try {
    ({ name } = await request.json())
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const trimmed = typeof name === 'string' ? name.trim() : ''
  if (!trimmed) {
    return NextResponse.json({ error: 'Name is required' }, { status: 400 })
  }

  // Service client bypasses RLS on purpose — this is the cross-tenant admin
  // action (managing business types globally), gated by isCurrentUserAdmin()
  // above instead of per-business RLS.
  const supabase = await createServiceClient()

  try {
    // Case-insensitive dedupe check — "Cafe" and "cafe" count as the same type.
    // The database also has a matching unique index as a backstop.
    const { data: existing, error: existingError } = await supabase
      .from('business_types')
      .select('id, name')
      .ilike('name', trimmed)
      .maybeSingle()

    if (existingError) {
      console.error('[business-types:create] dedupe check failed', existingError)
      return NextResponse.json({ error: 'Could not create business type. Please try again.' }, { status: 500 })
    }

    if (existing) {
      return NextResponse.json({ data: existing })
    }

    const { data, error } = await supabase
      .from('business_types')
      .insert({ name: trimmed })
      .select('id, name')
      .single()

    if (error) {
      console.error('[business-types:create] insert business_types failed', error)
      return NextResponse.json({ error: 'Could not create business type. Please try again.' }, { status: 500 })
    }
    return NextResponse.json({ data })
  } catch (err) {
    console.error('[business-types:create] unexpected error', err)
    return NextResponse.json({ error: 'Could not create business type. Please try again.' }, { status: 500 })
  }
}
