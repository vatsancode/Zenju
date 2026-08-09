import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessId } from '@/lib/supabase/session'
import { asTrimmedString, createInventoryItemWithStock, listInventoryItems, type StockRowInput } from '@/lib/services/inventory'

interface StockRowBody {
  quantity?: unknown
  expiry_date?: unknown
}

interface CreateInventoryItemBody {
  name?: unknown
  category_id?: unknown
  unit_id?: unknown
  has_expiry?: unknown
  notes?: unknown
  attribute_ids?: unknown
  has_variants?: unknown
  variant_name?: unknown
  code?: unknown
  purchase_cost?: unknown
  target_profit_percent?: unknown
  selling_price?: unknown
  stock_rows?: unknown
}

export async function GET() {
  const businessId = await getCurrentBusinessId()
  if (!businessId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()

  try {
    const result = await listInventoryItems(supabase, businessId)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ data: result.data })
  } catch (err) {
    console.error('[inventory:list] unexpected error', err)
    return NextResponse.json({ error: 'Could not load products. Please try again.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const businessId = await getCurrentBusinessId()
  if (!businessId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: CreateInventoryItemBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const name = asTrimmedString(body.name)
  const categoryId = typeof body.category_id === 'string' && body.category_id ? body.category_id : null
  const unitId = asTrimmedString(body.unit_id)
  const hasExpiry = body.has_expiry === true
  const notes = typeof body.notes === 'string' && body.notes.trim() ? body.notes.trim() : null
  const attributeIds = Array.isArray(body.attribute_ids)
    ? body.attribute_ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : []
  const hasVariants = body.has_variants === true
  const variantName = typeof body.variant_name === 'string' && body.variant_name.trim() ? body.variant_name.trim() : null
  const code = typeof body.code === 'string' && body.code.trim() ? body.code.trim() : null
  const purchaseCost = typeof body.purchase_cost === 'number' && Number.isFinite(body.purchase_cost) ? body.purchase_cost : 0
  const targetProfitPercent =
    typeof body.target_profit_percent === 'number' && Number.isFinite(body.target_profit_percent)
      ? body.target_profit_percent
      : null
  const sellingPrice = typeof body.selling_price === 'number' && Number.isFinite(body.selling_price) ? body.selling_price : 0
  const stockRows: StockRowInput[] = Array.isArray(body.stock_rows)
    ? (body.stock_rows as StockRowBody[]).map(row => ({
        quantity: typeof row.quantity === 'number' && Number.isFinite(row.quantity) ? row.quantity : 0,
        expiryDate: typeof row.expiry_date === 'string' && row.expiry_date ? row.expiry_date : null,
      }))
    : []

  if (!name) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
  if (!unitId) return NextResponse.json({ error: 'Unit is required' }, { status: 400 })

  const supabase = await createClient()

  try {
    const result = await createInventoryItemWithStock(supabase, businessId, {
      name,
      categoryId,
      unitId,
      hasExpiry,
      notes,
      attributeIds,
      hasVariants,
      variantName,
      code,
      purchaseCost,
      targetProfitPercent,
      sellingPrice,
      stockRows,
    })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ data: result.data })
  } catch (err) {
    console.error('[inventory:create] unexpected error', err)
    return NextResponse.json({ error: 'Could not create the product. Please try again.' }, { status: 500 })
  }
}
