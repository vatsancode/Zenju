import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessId } from '@/lib/supabase/session'
import { addBatch, listBatchesForVariant } from '@/lib/services/batches'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; variantId: string } }
) {
  const businessId = await getCurrentBusinessId()
  if (!businessId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()

  try {
    const result = await listBatchesForVariant(supabase, businessId, params.id, params.variantId)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ data: result.data })
  } catch (err) {
    console.error('[batches:list] unexpected error', params.variantId, err)
    return NextResponse.json({ error: 'Could not load stock history. Please try again.' }, { status: 500 })
  }
}

interface AddBatchBody {
  quantity?: unknown
  purchase_cost?: unknown
  expiry_date?: unknown
  batch_number?: unknown
  supplier_id?: unknown
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; variantId: string } }
) {
  const businessId = await getCurrentBusinessId()
  if (!businessId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: AddBatchBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const quantity = typeof body.quantity === 'number' && Number.isFinite(body.quantity) ? body.quantity : 0
  const purchaseCost = typeof body.purchase_cost === 'number' && Number.isFinite(body.purchase_cost) ? body.purchase_cost : 0
  const expiryDate = typeof body.expiry_date === 'string' && body.expiry_date ? body.expiry_date : null
  const batchNumber = typeof body.batch_number === 'string' && body.batch_number.trim() ? body.batch_number.trim() : null
  const supplierId = typeof body.supplier_id === 'string' && body.supplier_id ? body.supplier_id : null

  const supabase = await createClient()

  try {
    const result = await addBatch(supabase, businessId, params.id, params.variantId, {
      quantity,
      purchaseCost,
      expiryDate,
      batchNumber,
      supplierId,
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({
      data: {
        batch: result.data.batch,
        variant: result.data.variant,
        margin_alert: result.data.marginAlert,
      },
    })
  } catch (err) {
    console.error('[batches:add] unexpected error', params.variantId, err)
    return NextResponse.json({ error: 'Could not save the purchase. Please try again.' }, { status: 500 })
  }
}
