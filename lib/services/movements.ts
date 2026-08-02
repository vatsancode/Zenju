import type { createClient } from '@/lib/supabase/server'
import { table } from '@/lib/supabase/server'
import type { StockMovement } from '@/types/database'
import type { ServiceResult } from '@/lib/services/inventory'

type ServiceClient = Awaited<ReturnType<typeof createClient>>

async function variantBelongsToItem(supabase: ServiceClient, itemId: string, variantId: string): Promise<boolean> {
  const { data, error } = await table(supabase, 'inventory_variants')
    .select('id, inventory_item_id')
    .eq('id', variantId)
    .maybeSingle()
  if (error || !data) return false
  return (data as { inventory_item_id: string }).inventory_item_id === itemId
}

export interface MovementWithBranch extends StockMovement {
  branch_name: string | null
}

type RawMovementRow = StockMovement & { branches: { name: string } | null }

// Nothing writes to stock_movements yet (no consumption-logging backend
// exists), so this will return an empty list until that's built — the
// Consumption tab reads real data, there just isn't any yet. Purchase-type
// movements are excluded since those are already shown on the Purchase
// History tab (sourced from inventory_batches directly).
export async function listMovementsForVariant(
  supabase: ServiceClient,
  businessId: string,
  itemId: string,
  variantId: string
): Promise<ServiceResult<MovementWithBranch[]>> {
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

  const { data, error } = await table(supabase, 'stock_movements')
    .select('*, branches(name)')
    .eq('variant_id', variantId)
    .eq('business_id', businessId)
    .in('movement_type', ['sale', 'manual_adjustment', 'waste'])
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[movements:list] fetch failed', error)
    return { ok: false, error: 'Could not load consumption history. Please try again.', status: 500 }
  }

  return {
    ok: true,
    data: (data as unknown as RawMovementRow[]).map(({ branches, ...movement }) => ({
      ...movement,
      branch_name: branches?.name ?? null,
    })),
  }
}
