import type { createClient } from '@/lib/supabase/server'
import { table } from '@/lib/supabase/server'
import type { InventoryBatch, InventoryVariant } from '@/types/database'
import type { ServiceResult } from '@/lib/services/inventory'
import { getDefaultBranchId } from '@/lib/services/branches'
import { computeMarginAlert, type MarginAlert } from '@/lib/services/margin-alert'

type ServiceClient = Awaited<ReturnType<typeof createClient>>

const GENERIC_SAVE_ERROR = 'Could not save the purchase. Please try again.'

export interface BatchWithSupplier extends InventoryBatch {
  supplier_name: string | null
}

type RawBatchRow = InventoryBatch & { suppliers: { name: string } | null }

async function variantBelongsToItem(supabase: ServiceClient, itemId: string, variantId: string): Promise<boolean> {
  const { data, error } = await table(supabase, 'inventory_variants')
    .select('id, inventory_item_id')
    .eq('id', variantId)
    .maybeSingle()
  if (error || !data) return false
  return (data as { inventory_item_id: string }).inventory_item_id === itemId
}

// Returns every batch ever recorded for this variant, newest first — the
// "Purchase History" tab shows all of these; "Current Stock" is just this
// same list filtered client-side to quantity_remaining > 0.
export async function listBatchesForVariant(
  supabase: ServiceClient,
  businessId: string,
  itemId: string,
  variantId: string
): Promise<ServiceResult<BatchWithSupplier[]>> {
  const { data: item, error: itemError } = await table(supabase, 'inventory_items')
    .select('id, business_id')
    .eq('id', itemId)
    .is('deleted_at', null)
    .maybeSingle()
  if (itemError || !item || (item as { business_id: string }).business_id !== businessId) {
    return { ok: false, error: 'Product not found', status: 404 }
  }

  if (!(await variantBelongsToItem(supabase, itemId, variantId))) {
    return { ok: false, error: 'Variant not found', status: 404 }
  }

  const { data, error } = await table(supabase, 'inventory_batches')
    .select('*, suppliers(name)')
    .eq('variant_id', variantId)
    .order('received_at', { ascending: false })

  if (error) {
    console.error('[batches:list] fetch failed', error)
    return { ok: false, error: 'Could not load stock history. Please try again.', status: 500 }
  }

  return {
    ok: true,
    data: (data as unknown as RawBatchRow[]).map(({ suppliers, ...batch }) => ({
      ...batch,
      supplier_name: suppliers?.name ?? null,
    })),
  }
}

export interface AddBatchInput {
  quantity: number
  purchaseCost: number
  expiryDate: string | null
  batchNumber: string | null
  supplierId: string | null
}

export interface AddBatchResult {
  batch: InventoryBatch
  variant: InventoryVariant
  marginAlert: MarginAlert | null
}

// Records a purchase after creation (used by the variant page's "Record new
// purchase" action) and updates the variant's cached "latest cost" — unlike
// addOpeningStock (lib/services/variants.ts), which reuses the variant's
// existing cost for a one-time zero-stock top-up.
export async function addBatch(
  supabase: ServiceClient,
  businessId: string,
  itemId: string,
  variantId: string,
  input: AddBatchInput
): Promise<ServiceResult<AddBatchResult>> {
  const { data: item, error: itemError } = await table(supabase, 'inventory_items')
    .select('id, business_id, has_expiry')
    .eq('id', itemId)
    .is('deleted_at', null)
    .maybeSingle()
  if (itemError || !item || (item as { business_id: string }).business_id !== businessId) {
    return { ok: false, error: 'Product not found', status: 404 }
  }

  if (!(await variantBelongsToItem(supabase, itemId, variantId))) {
    return { ok: false, error: 'Variant not found', status: 404 }
  }

  if (!input.quantity || input.quantity <= 0) {
    return { ok: false, error: 'Quantity must be a positive number', status: 400 }
  }
  if (!input.purchaseCost || input.purchaseCost <= 0) {
    return { ok: false, error: 'Purchase cost must be a positive number', status: 400 }
  }
  if ((item as { has_expiry: boolean }).has_expiry && !input.expiryDate) {
    return { ok: false, error: 'Expiry date is required for this product', status: 400 }
  }

  const branchId = await getDefaultBranchId(supabase, businessId)
  if (!branchId) {
    console.error('[batches:add] no default branch for business', businessId)
    return { ok: false, error: 'Could not find a default branch for this business.', status: 500 }
  }

  const { data: insertedBatch, error: batchError } = await table(supabase, 'inventory_batches')
    .insert({
      business_id: businessId,
      variant_id: variantId,
      branch_id: branchId,
      supplier_id: input.supplierId,
      purchase_price: input.purchaseCost,
      quantity_received: input.quantity,
      quantity_remaining: input.quantity,
      expiry_date: input.expiryDate,
      batch_number: input.batchNumber,
    })
    .select('*')
    .single()

  if (batchError || !insertedBatch) {
    console.error('[batches:add] insert failed', batchError)
    return { ok: false, error: GENERIC_SAVE_ERROR, status: 500 }
  }

  const { data: updatedVariant, error: variantError } = await table(supabase, 'inventory_variants')
    .update({ purchase_price: input.purchaseCost })
    .eq('id', variantId)
    .select('*')
    .single()

  if (variantError || !updatedVariant) {
    console.error('[batches:add] variant cost update failed', variantError)
    return { ok: false, error: GENERIC_SAVE_ERROR, status: 500 }
  }

  const variant = updatedVariant as InventoryVariant
  const marginAlert = computeMarginAlert(variant.purchase_price, variant.selling_price, variant.target_profit_percent)

  return {
    ok: true,
    data: { batch: insertedBatch as InventoryBatch, variant, marginAlert },
  }
}
