import type { createClient } from '@/lib/supabase/server'
import { table } from '@/lib/supabase/server'
import type { InventoryBatch } from '@/types/database'
import type { ServiceResult } from '@/lib/services/inventory'

type ServiceClient = Awaited<ReturnType<typeof createClient>>

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
