import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessId } from '@/lib/supabase/session'
import { getVariantForItem, updateVariant, type UpdateVariantInput } from '@/lib/services/variants'

interface UpdateVariantBody {
  variant_code?: unknown
  selling_price?: unknown
  purchase_price?: unknown
  target_profit_percent?: unknown
  par_stock?: unknown
  attribute_values?: unknown
}

function asNullableNumber(value: unknown): number | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string; variantId: string } }
) {
  const businessId = await getCurrentBusinessId()
  if (!businessId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()

  try {
    const result = await getVariantForItem(supabase, businessId, params.id, params.variantId)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ data: result.data })
  } catch (err) {
    console.error('[variants:get] unexpected error', params.variantId, err)
    return NextResponse.json({ error: 'Could not load the variant. Please try again.' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string; variantId: string } }
) {
  const businessId = await getCurrentBusinessId()
  if (!businessId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: UpdateVariantBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const input: UpdateVariantInput = {}
  if (typeof body.variant_code === 'string') input.variant_code = body.variant_code.trim() || null
  if (body.variant_code === null) input.variant_code = null

  const sellingPrice = asNullableNumber(body.selling_price)
  if (sellingPrice !== undefined) input.selling_price = sellingPrice
  if (sellingPrice === undefined && body.selling_price !== undefined) {
    return NextResponse.json({ error: 'Selling price must be a number' }, { status: 400 })
  }

  const purchasePrice = asNullableNumber(body.purchase_price)
  if (purchasePrice !== undefined) input.purchase_price = purchasePrice
  if (purchasePrice === undefined && body.purchase_price !== undefined) {
    return NextResponse.json({ error: 'Purchase price must be a number' }, { status: 400 })
  }

  const targetProfitPercent = asNullableNumber(body.target_profit_percent)
  if (targetProfitPercent !== undefined) input.target_profit_percent = targetProfitPercent
  if (targetProfitPercent === undefined && body.target_profit_percent !== undefined) {
    return NextResponse.json({ error: 'Target profit % must be a number' }, { status: 400 })
  }

  const parStock = asNullableNumber(body.par_stock)
  if (parStock !== undefined) input.par_stock = parStock
  if (parStock === undefined && body.par_stock !== undefined) {
    return NextResponse.json({ error: 'Par stock must be a number' }, { status: 400 })
  }

  if (body.attribute_values !== undefined) {
    if (!Array.isArray(body.attribute_values) || !body.attribute_values.every((v: unknown) => typeof v === 'string')) {
      return NextResponse.json({ error: 'Attribute values must be an array of strings' }, { status: 400 })
    }
    input.attribute_values = body.attribute_values as string[]
  }

  const supabase = await createClient()

  try {
    const result = await updateVariant(supabase, businessId, params.id, params.variantId, input)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ data: result.data })
  } catch (err) {
    console.error('[variants:update] unexpected error', params.variantId, err)
    return NextResponse.json({ error: 'Could not save the variant. Please try again.' }, { status: 500 })
  }
}
