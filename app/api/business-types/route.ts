import { NextResponse, type NextRequest } from 'next/server'
import { isCurrentUserAdmin } from '@/lib/supabase/admin'
import { createServiceClient } from '@/lib/supabase/server'

export async function GET() {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createServiceClient()
  const { data, error } = await supabase
    .from('business_types')
    .select('id, name')
    .order('name')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ business_types: data })
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

  const supabase = await createServiceClient()

  // Case-insensitive dedupe check — "Cafe" and "cafe" count as the same type.
  // The database also has a matching unique index as a backstop.
  const { data: existing, error: existingError } = await supabase
    .from('business_types')
    .select('id, name')
    .ilike('name', trimmed)
    .maybeSingle()

  if (existingError) {
    return NextResponse.json({ error: existingError.message }, { status: 500 })
  }

  if (existing) {
    return NextResponse.json({ business_type: existing })
  }

  const { data, error } = await supabase
    .from('business_types')
    .insert({ name: trimmed })
    .select('id, name')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ business_type: data })
}
