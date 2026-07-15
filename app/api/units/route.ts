import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessId } from '@/lib/supabase/session'
import { asTrimmedString, createUnit, listUnits } from '@/lib/services/units'

interface CreateUnitBody {
  name?: unknown
  allows_decimal?: unknown
}

export async function GET() {
  const businessId = await getCurrentBusinessId()
  if (!businessId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()

  try {
    const result = await listUnits(supabase, businessId)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ data: result.data })
  } catch (err) {
    console.error('[units:list] unexpected error', err)
    return NextResponse.json({ error: 'Could not load units. Please try again.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const businessId = await getCurrentBusinessId()
  if (!businessId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: CreateUnitBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const name = asTrimmedString(body.name)
  const allowsDecimal = body.allows_decimal === true

  if (!name) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })

  const supabase = await createClient()

  try {
    const result = await createUnit(supabase, businessId, { name, allowsDecimal })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ data: result.data })
  } catch (err) {
    console.error('[units:create] unexpected error', err)
    return NextResponse.json({ error: 'Could not create unit. Please try again.' }, { status: 500 })
  }
}
