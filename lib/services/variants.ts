import type { createClient } from '@/lib/supabase/server'
import { table } from '@/lib/supabase/server'
import type { InventoryVariant } from '@/types/database'
import type { ServiceResult } from '@/lib/services/inventory'
import { getDefaultBranchId } from '@/lib/services/branches'

type ServiceClient = Awaited<ReturnType<typeof createClient>>

const GENERIC_SAVE_ERROR = 'Could not save the variant. Please try again.'

// Aligned by index to the item's attribute_definition_ids (same order as
// attribute_names) — index i of attribute_values is this variant's value
// for attribute_definition_ids[i]. Empty string where no value is saved yet.
export interface VariantWithDetails extends InventoryVariant {
  attribute_values: string[]
  current_stock: number
}

async function itemBelongsToBusiness(
  supabase: ServiceClient,
  businessId: string,
  itemId: string
): Promise<boolean> {
  const { data, error } = await table(supabase, 'inventory_items')
    .select('id, business_id')
    .eq('id', itemId)
    .is('deleted_at', null)
    .maybeSingle()
  if (error || !data) return false
  return (data as { business_id: string }).business_id === businessId
}

async function getAttributeDefinitionIds(supabase: ServiceClient, itemId: string): Promise<string[] | null> {
  const { data, error } = await table(supabase, 'attribute_definitions')
    .select('id, display_order')
    .eq('inventory_item_id', itemId)
    .order('display_order', { ascending: true })
  if (error) {
    console.error('[variants:attribute-defs] fetch failed', error)
    return null
  }
  return (data as { id: string; display_order: number }[] ?? []).map(d => d.id)
}

// Fetches variant_attribute_values for a set of variants and returns each
// variant's values as an array parallel to defIds (empty string = unset).
async function getValuesByVariant(
  supabase: ServiceClient,
  variantIds: string[],
  defIds: string[]
): Promise<Record<string, string[]> | null> {
  const empty = () => defIds.map(() => '')
  if (variantIds.length === 0 || defIds.length === 0) {
    return Object.fromEntries(variantIds.map(id => [id, empty()]))
  }

  const { data, error } = await table(supabase, 'variant_attribute_values')
    .select('variant_id, attribute_definition_id, value')
    .in('variant_id', variantIds)
  if (error) {
    console.error('[variants:values] fetch failed', error)
    return null
  }

  const byVariant: Record<string, Record<string, string>> = {}
  for (const row of (data as { variant_id: string; attribute_definition_id: string; value: string }[] ?? [])) {
    byVariant[row.variant_id] ??= {}
    byVariant[row.variant_id][row.attribute_definition_id] = row.value
  }

  return Object.fromEntries(
    variantIds.map(id => [id, defIds.map(defId => byVariant[id]?.[defId] ?? '')])
  )
}

// Sums variant_stock_current across branches per variant — the UI doesn't
// do per-branch stock yet, so a single total is what's shown.
async function getStockByVariant(supabase: ServiceClient, variantIds: string[]): Promise<Record<string, number> | null> {
  if (variantIds.length === 0) return {}

  const { data, error } = await supabase
    .from('variant_stock_current')
    .select('variant_id, current_stock')
    .in('variant_id', variantIds)
  if (error) {
    console.error('[variants:stock] fetch failed', error)
    return null
  }

  const totals: Record<string, number> = {}
  for (const row of (data as { variant_id: string; current_stock: number }[] ?? [])) {
    totals[row.variant_id] = (totals[row.variant_id] ?? 0) + Number(row.current_stock)
  }
  return totals
}

export async function createDefaultVariant(
  supabase: ServiceClient,
  itemId: string
): Promise<ServiceResult<InventoryVariant>> {
  const { data, error } = await table(supabase, 'inventory_variants')
    .insert({ inventory_item_id: itemId, variant_code: 'VAR-001' })
    .select('*')
    .single()

  if (error || !data) {
    console.error('[variants:create-default] insert failed', error)
    return { ok: false, error: GENERIC_SAVE_ERROR, status: 500 }
  }
  return { ok: true, data: data as InventoryVariant }
}

export async function listVariantsForItem(
  supabase: ServiceClient,
  businessId: string,
  itemId: string
): Promise<ServiceResult<VariantWithDetails[]>> {
  if (!(await itemBelongsToBusiness(supabase, businessId, itemId))) {
    return { ok: false, error: 'Product not found', status: 404 }
  }

  const defIds = await getAttributeDefinitionIds(supabase, itemId)
  if (defIds === null) return { ok: false, error: 'Could not load variants. Please try again.', status: 500 }

  const { data, error } = await table(supabase, 'inventory_variants')
    .select('*')
    .eq('inventory_item_id', itemId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[variants:list] fetch failed', error)
    return { ok: false, error: 'Could not load variants. Please try again.', status: 500 }
  }

  const rows = data as InventoryVariant[]
  const variantIds = rows.map(r => r.id)
  const valuesByVariant = await getValuesByVariant(supabase, variantIds, defIds)
  if (valuesByVariant === null) return { ok: false, error: 'Could not load variants. Please try again.', status: 500 }

  const stockByVariant = await getStockByVariant(supabase, variantIds)
  if (stockByVariant === null) return { ok: false, error: 'Could not load variants. Please try again.', status: 500 }

  return {
    ok: true,
    data: rows.map(row => ({
      ...row,
      current_stock: stockByVariant[row.id] ?? 0,
      attribute_values: valuesByVariant[row.id] ?? [],
    })),
  }
}

export interface UpdateVariantInput {
  variant_code?: string | null
  selling_price?: number | null
  purchase_price?: number | null
  par_stock?: number | null
  // Parallel to the item's attribute_definition_ids — pass the full array
  // whenever attribute values are being saved (partial saves aren't
  // supported; an empty string clears that attribute's value).
  attribute_values?: string[]
}

export async function updateVariant(
  supabase: ServiceClient,
  businessId: string,
  itemId: string,
  variantId: string,
  input: UpdateVariantInput
): Promise<ServiceResult<VariantWithDetails>> {
  if (!(await itemBelongsToBusiness(supabase, businessId, itemId))) {
    return { ok: false, error: 'Product not found', status: 404 }
  }

  const { data: existing, error: fetchError } = await table(supabase, 'inventory_variants')
    .select('id, inventory_item_id')
    .eq('id', variantId)
    .maybeSingle()
  if (fetchError) {
    console.error('[variants:update] fetch failed', fetchError)
    return { ok: false, error: GENERIC_SAVE_ERROR, status: 500 }
  }
  if (!existing || (existing as { inventory_item_id: string }).inventory_item_id !== itemId) {
    return { ok: false, error: 'Variant not found', status: 404 }
  }

  const { attribute_values, ...columnUpdates } = input

  if (Object.keys(columnUpdates).length > 0) {
    const { error: updateError } = await table(supabase, 'inventory_variants')
      .update(columnUpdates)
      .eq('id', variantId)
    if (updateError) {
      console.error('[variants:update] update failed', updateError)
      return { ok: false, error: GENERIC_SAVE_ERROR, status: 500 }
    }
  }

  const defIds = await getAttributeDefinitionIds(supabase, itemId)
  if (defIds === null) return { ok: false, error: GENERIC_SAVE_ERROR, status: 500 }

  if (attribute_values) {
    // Replace wholesale rather than upsert — simpler than reconciling
    // per-attribute diffs, and this table has no unique constraint to
    // upsert against.
    const { error: delError } = await table(supabase, 'variant_attribute_values')
      .delete()
      .eq('variant_id', variantId)
    if (delError) {
      console.error('[variants:update] clear attribute values failed', delError)
      return { ok: false, error: GENERIC_SAVE_ERROR, status: 500 }
    }

    const rowsToInsert = defIds
      .map((defId, i) => ({ attribute_definition_id: defId, value: (attribute_values[i] ?? '').trim() }))
      .filter(v => v.value.length > 0)
      .map(v => ({ variant_id: variantId, attribute_definition_id: v.attribute_definition_id, value: v.value }))

    if (rowsToInsert.length > 0) {
      const { error: insError } = await table(supabase, 'variant_attribute_values').insert(rowsToInsert)
      if (insError) {
        console.error('[variants:update] insert attribute values failed', insError)
        return { ok: false, error: GENERIC_SAVE_ERROR, status: 500 }
      }
    }
  }

  const { data: updated, error: refetchError } = await table(supabase, 'inventory_variants')
    .select('*')
    .eq('id', variantId)
    .single()
  if (refetchError || !updated) {
    console.error('[variants:update] refetch failed', refetchError)
    return { ok: false, error: GENERIC_SAVE_ERROR, status: 500 }
  }

  const valuesByVariant = await getValuesByVariant(supabase, [variantId], defIds)
  if (valuesByVariant === null) return { ok: false, error: GENERIC_SAVE_ERROR, status: 500 }

  const stockByVariant = await getStockByVariant(supabase, [variantId])
  if (stockByVariant === null) return { ok: false, error: GENERIC_SAVE_ERROR, status: 500 }

  return {
    ok: true,
    data: {
      ...(updated as InventoryVariant),
      current_stock: stockByVariant[variantId] ?? 0,
      attribute_values: valuesByVariant[variantId] ?? [],
    },
  }
}

export interface AddOpeningStockResult {
  variant: VariantWithDetails
}

export async function addOpeningStock(
  supabase: ServiceClient,
  businessId: string,
  itemId: string,
  variantId: string,
  quantity: number
): Promise<ServiceResult<AddOpeningStockResult>> {
  if (!(await itemBelongsToBusiness(supabase, businessId, itemId))) {
    return { ok: false, error: 'Product not found', status: 404 }
  }

  const { data: variant, error: fetchError } = await table(supabase, 'inventory_variants')
    .select('*')
    .eq('id', variantId)
    .maybeSingle()
  if (fetchError) {
    console.error('[variants:opening-stock] fetch failed', fetchError)
    return { ok: false, error: GENERIC_SAVE_ERROR, status: 500 }
  }
  if (!variant || (variant as InventoryVariant).inventory_item_id !== itemId) {
    return { ok: false, error: 'Variant not found', status: 404 }
  }

  const branchId = await getDefaultBranchId(supabase, businessId)
  if (!branchId) {
    console.error('[variants:opening-stock] no default branch for business', businessId)
    return { ok: false, error: 'Could not find a default branch for this business.', status: 500 }
  }

  const { error: batchError } = await table(supabase, 'inventory_batches').insert({
    business_id: businessId,
    variant_id: variantId,
    branch_id: branchId,
    purchase_price: (variant as InventoryVariant).purchase_price ?? 0,
    quantity_received: quantity,
    quantity_remaining: quantity,
    batch_number: 'Opening Stock',
  })
  if (batchError) {
    console.error('[variants:opening-stock] batch insert failed', batchError)
    return { ok: false, error: 'Could not save the opening stock. Please try again.', status: 500 }
  }

  const defIds = await getAttributeDefinitionIds(supabase, itemId)
  if (defIds === null) return { ok: false, error: GENERIC_SAVE_ERROR, status: 500 }

  const valuesByVariant = await getValuesByVariant(supabase, [variantId], defIds)
  if (valuesByVariant === null) return { ok: false, error: GENERIC_SAVE_ERROR, status: 500 }

  const stockByVariant = await getStockByVariant(supabase, [variantId])
  if (stockByVariant === null) return { ok: false, error: GENERIC_SAVE_ERROR, status: 500 }

  return {
    ok: true,
    data: {
      variant: {
        ...(variant as InventoryVariant),
        current_stock: stockByVariant[variantId] ?? 0,
        attribute_values: valuesByVariant[variantId] ?? [],
      },
    },
  }
}
