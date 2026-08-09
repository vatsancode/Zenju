import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessId } from '@/lib/supabase/session'
import { asTrimmedString, deleteInventoryItem, getInventoryItem, updateInventoryItem } from '@/lib/services/inventory'

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const businessId = await getCurrentBusinessId()
  if (!businessId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()

  try {
    const result = await getInventoryItem(supabase, businessId, params.id)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ data: result.data })
  } catch (err) {
    console.error('[inventory:get] unexpected error', params.id, err)
    return NextResponse.json({ error: 'Could not load the product. Please try again.' }, { status: 500 })
  }
}

interface UpdateInventoryItemBody {
  name?: unknown
  category_id?: unknown
  unit_id?: unknown
  has_expiry?: unknown
  has_variants?: unknown
  notes?: unknown
  attribute_ids?: unknown
  confirm_attribute_removal?: unknown
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const businessId = await getCurrentBusinessId()
  if (!businessId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: UpdateInventoryItemBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const name = asTrimmedString(body.name)
  const categoryId = typeof body.category_id === 'string' && body.category_id ? body.category_id : null
  const unitId = asTrimmedString(body.unit_id)
  const hasExpiry = body.has_expiry === true
  const hasVariants = body.has_variants === true
  const notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null
  const attributeIds = Array.isArray(body.attribute_ids)
    ? body.attribute_ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : []
  const confirmAttributeRemoval = body.confirm_attribute_removal === true

  if (!name) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
  if (!unitId) return NextResponse.json({ error: 'Unit is required' }, { status: 400 })

  const supabase = await createClient()

  try {
    const result = await updateInventoryItem(supabase, businessId, params.id, {
      name,
      categoryId,
      unitId,
      hasExpiry,
      hasVariants,
      notes,
      attributeIds,
      confirmAttributeRemoval,
    })
    if (!result.ok) {
      return NextResponse.json(
        {
          error: result.error,
          ...(result.requiresConfirmation ? { requires_confirmation: true, affected_attributes: result.affectedAttributes } : {}),
        },
        { status: result.status }
      )
    }
    return NextResponse.json({ data: result.data })
  } catch (err) {
    console.error('[inventory:update] unexpected error', params.id, err)
    return NextResponse.json({ error: 'Could not save the product. Please try again.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const businessId = await getCurrentBusinessId()
  if (!businessId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()

  try {
    const result = await deleteInventoryItem(supabase, businessId, params.id)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ data: result.data })
  } catch (err) {
    console.error('[inventory:delete] unexpected error', params.id, err)
    return NextResponse.json({ error: 'Could not delete the product. Please try again.' }, { status: 500 })
  }
}
