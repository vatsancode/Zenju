import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessId } from '@/lib/supabase/session'
import { addOpeningStock } from '@/lib/services/variants'

interface AddOpeningStockBody {
  quantity?: unknown
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; variantId: string } }
) {
  const businessId = await getCurrentBusinessId()
  if (!businessId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: AddOpeningStockBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const quantity = typeof body.quantity === 'number' && Number.isFinite(body.quantity) ? body.quantity : null
  if (quantity === null || quantity <= 0) {
    return NextResponse.json({ error: 'Quantity must be a positive number' }, { status: 400 })
  }

  const supabase = await createClient()

  try {
    const result = await addOpeningStock(supabase, businessId, params.id, params.variantId, quantity)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ data: result.data.variant })
  } catch (err) {
    console.error('[variants:opening-stock] unexpected error', params.variantId, err)
    return NextResponse.json({ error: 'Could not save the opening stock. Please try again.' }, { status: 500 })
  }
}
