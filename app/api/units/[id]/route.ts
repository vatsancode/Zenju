import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessId } from '@/lib/supabase/session'
import { asTrimmedString, deleteUnit, renameUnit, toggleUnitDecimal } from '@/lib/services/units'

interface PatchUnitBody {
  name?: unknown
  allows_decimal?: unknown
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const businessId = await getCurrentBusinessId()
  if (!businessId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: PatchUnitBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const supabase = await createClient()

  try {
    if (typeof body.name === 'string') {
      const name = asTrimmedString(body.name)
      if (!name) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
      const result = await renameUnit(supabase, businessId, params.id, name)
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
      return NextResponse.json({ data: result.data })
    }

    if (typeof body.allows_decimal === 'boolean') {
      const result = await toggleUnitDecimal(supabase, businessId, params.id, body.allows_decimal)
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
      return NextResponse.json({ data: result.data })
    }

    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  } catch (err) {
    console.error('[units:update] unexpected error', params.id, err)
    return NextResponse.json({ error: 'Could not update the unit. Please try again.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const businessId = await getCurrentBusinessId()
  if (!businessId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()

  try {
    const result = await deleteUnit(supabase, businessId, params.id)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ data: result.data })
  } catch (err) {
    console.error('[units:delete] unexpected error', params.id, err)
    return NextResponse.json({ error: 'Could not delete the unit. Please try again.' }, { status: 500 })
  }
}
