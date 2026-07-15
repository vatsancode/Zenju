import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessId } from '@/lib/supabase/session'
import { createConversion, listConversions } from '@/lib/services/unit-conversions'

interface CreateConversionBody {
  from_unit_id?: unknown
  to_unit_id?: unknown
  factor?: unknown
}

export async function GET() {
  const businessId = await getCurrentBusinessId()
  if (!businessId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()

  try {
    const result = await listConversions(supabase, businessId)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ data: result.data })
  } catch (err) {
    console.error('[unit-conversions:list] unexpected error', err)
    return NextResponse.json({ error: 'Could not load unit conversions. Please try again.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const businessId = await getCurrentBusinessId()
  if (!businessId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: CreateConversionBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const fromUnitId = typeof body.from_unit_id === 'string' ? body.from_unit_id : ''
  const toUnitId = typeof body.to_unit_id === 'string' ? body.to_unit_id : ''
  const factor = typeof body.factor === 'number' ? body.factor : Number(body.factor)

  const supabase = await createClient()

  try {
    const result = await createConversion(supabase, businessId, { fromUnitId, toUnitId, factor })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ data: result.data })
  } catch (err) {
    console.error('[unit-conversions:create] unexpected error', err)
    return NextResponse.json({ error: 'Could not create conversion. Please try again.' }, { status: 500 })
  }
}
