import type { createClient } from '@/lib/supabase/server'
import { table } from '@/lib/supabase/server'
import type { InventoryItem, InventoryVariant } from '@/types/database'
import { createDefaultVariant } from '@/lib/services/variants'
import { getDefaultBranchId } from '@/lib/services/branches'

type ServiceClient = Awaited<ReturnType<typeof createClient>>

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number }

export function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

// Postgres unique_violation — migration 012's inventory_items_unique_name is
// the actual guarantee (see the same reasoning in categories.ts/units.ts/
// attributes.ts); this just turns its error into a friendly message if the
// app-level check races.
function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505'
}

const DUPLICATE_NAME_ERROR = 'A product with this name already exists'
const GENERIC_SAVE_ERROR = 'Could not save the product. Please try again.'

export interface InventoryItemWithDetails extends InventoryItem {
  category_name: string | null
  unit_name: string
  attribute_ids: string[]
  attribute_names: string[]
  // Parallel to attribute_ids/attribute_names — the attribute_definitions.id
  // for this item, in the same display order. Variants key their per-row
  // attribute values off this id (not attribute_id), so callers that need to
  // write variant_attribute_values need it alongside the display names.
  attribute_definition_ids: string[]
  variant_count: number
  current_stock: number
}

const ITEM_SELECT_WITH_DETAILS =
  '*, categories(name), units(name), attribute_definitions(id, attribute_id, display_order, attributes(id, name))'

type RawItemRow = InventoryItem & {
  categories: { name: string } | null
  units: { name: string } | null
  attribute_definitions: {
    id: string
    attribute_id: string
    display_order: number
    attributes: { id: string; name: string } | null
  }[]
}

// Variant count and total stock (summed across all variants and branches)
// per item — fetched separately since ITEM_SELECT_WITH_DETAILS doesn't join
// variants, and stock lives in a view, not a column.
async function getVariantCountsAndStock(
  supabase: ServiceClient,
  itemIds: string[]
): Promise<{ variantCounts: Record<string, number>; stockByItem: Record<string, number> } | null> {
  if (itemIds.length === 0) return { variantCounts: {}, stockByItem: {} }

  const { data: variants, error: variantsError } = await table(supabase, 'inventory_variants')
    .select('id, inventory_item_id')
    .in('inventory_item_id', itemIds)
  if (variantsError) {
    console.error('[inventory:variant-counts] fetch variants failed', variantsError)
    return null
  }

  const variantRows = variants as { id: string; inventory_item_id: string }[]
  const variantCounts: Record<string, number> = {}
  const itemByVariant: Record<string, string> = {}
  for (const v of variantRows) {
    variantCounts[v.inventory_item_id] = (variantCounts[v.inventory_item_id] ?? 0) + 1
    itemByVariant[v.id] = v.inventory_item_id
  }

  const stockByItem: Record<string, number> = {}
  const variantIds = variantRows.map(v => v.id)
  if (variantIds.length > 0) {
    const { data: stockRows, error: stockError } = await supabase
      .from('variant_stock_current')
      .select('variant_id, current_stock')
      .in('variant_id', variantIds)
    if (stockError) {
      console.error('[inventory:variant-counts] fetch stock failed', stockError)
      return null
    }
    for (const row of (stockRows as { variant_id: string; current_stock: number }[] ?? [])) {
      const itemId = itemByVariant[row.variant_id]
      if (!itemId) continue
      stockByItem[itemId] = (stockByItem[itemId] ?? 0) + Number(row.current_stock)
    }
  }

  return { variantCounts, stockByItem }
}

function hydrateItem(
  row: RawItemRow,
  extra: { variantCount: number; currentStock: number }
): InventoryItemWithDetails {
  const defs = [...(row.attribute_definitions ?? [])].sort((a, b) => a.display_order - b.display_order)
  const { categories, units, attribute_definitions, ...item } = row
  return {
    ...item,
    category_name: categories?.name ?? null,
    unit_name: units?.name ?? '',
    attribute_ids: defs.map(d => d.attribute_id),
    attribute_names: defs.map(d => d.attributes?.name ?? ''),
    attribute_definition_ids: defs.map(d => d.id),
    variant_count: extra.variantCount,
    current_stock: extra.currentStock,
  }
}

export async function listInventoryItems(
  supabase: ServiceClient,
  businessId: string
): Promise<ServiceResult<InventoryItemWithDetails[]>> {
  const { data, error } = await table(supabase, 'inventory_items')
    .select(ITEM_SELECT_WITH_DETAILS)
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[inventory:list] fetch failed', error)
    return { ok: false, error: 'Could not load products. Please try again.', status: 500 }
  }

  const rows = data as unknown as RawItemRow[]
  const extra = await getVariantCountsAndStock(supabase, rows.map(r => r.id))
  if (extra === null) return { ok: false, error: 'Could not load products. Please try again.', status: 500 }

  return {
    ok: true,
    data: rows.map(row => hydrateItem(row, {
      variantCount: extra.variantCounts[row.id] ?? 0,
      currentStock: extra.stockByItem[row.id] ?? 0,
    })),
  }
}

export async function getInventoryItem(
  supabase: ServiceClient,
  businessId: string,
  itemId: string
): Promise<ServiceResult<InventoryItemWithDetails>> {
  const { data, error } = await table(supabase, 'inventory_items')
    .select(ITEM_SELECT_WITH_DETAILS)
    .eq('id', itemId)
    .is('deleted_at', null)
    .maybeSingle()

  if (error) {
    console.error('[inventory:get] fetch failed', error)
    return { ok: false, error: 'Could not load the product. Please try again.', status: 500 }
  }
  const row = data as unknown as RawItemRow | null
  if (!row || row.business_id !== businessId) {
    return { ok: false, error: 'Product not found', status: 404 }
  }

  const extra = await getVariantCountsAndStock(supabase, [itemId])
  if (extra === null) return { ok: false, error: 'Could not load the product. Please try again.', status: 500 }

  return {
    ok: true,
    data: hydrateItem(row, {
      variantCount: extra.variantCounts[itemId] ?? 0,
      currentStock: extra.stockByItem[itemId] ?? 0,
    }),
  }
}

// Soft-deletes a product, but only if none of its variants have ever been
// purchased (inventory_batches) or sold (sale_items) — deleting a product
// with real transaction history would corrupt that history's product
// reference. A product with only 0-quantity stock rows (see
// createInventoryItemWithStock) has no batch rows yet, so it stays deletable.
export async function deleteInventoryItem(
  supabase: ServiceClient,
  businessId: string,
  itemId: string
): Promise<ServiceResult<null>> {
  const { data: existing, error: fetchError } = await table(supabase, 'inventory_items')
    .select('id, business_id')
    .eq('id', itemId)
    .is('deleted_at', null)
    .maybeSingle()

  if (fetchError) {
    console.error('[inventory:delete] fetch failed', fetchError)
    return { ok: false, error: 'Could not delete the product. Please try again.', status: 500 }
  }
  if (!existing || existing.business_id !== businessId) {
    return { ok: false, error: 'Product not found', status: 404 }
  }

  const { data: variants, error: variantsError } = await table(supabase, 'inventory_variants')
    .select('id')
    .eq('inventory_item_id', itemId)
  if (variantsError) {
    console.error('[inventory:delete] fetch variants failed', variantsError)
    return { ok: false, error: 'Could not delete the product. Please try again.', status: 500 }
  }
  const variantIds = (variants as { id: string }[] ?? []).map(v => v.id)

  if (variantIds.length > 0) {
    const { count: batchCount, error: batchError } = await table(supabase, 'inventory_batches')
      .select('id', { count: 'exact', head: true })
      .in('variant_id', variantIds)
    if (batchError) {
      console.error('[inventory:delete] check purchase data failed', batchError)
      return { ok: false, error: 'Could not delete the product. Please try again.', status: 500 }
    }
    if ((batchCount ?? 0) > 0) {
      return { ok: false, error: 'This product has purchase history and cannot be deleted', status: 409 }
    }

    const { count: saleCount, error: saleError } = await table(supabase, 'sale_items')
      .select('id', { count: 'exact', head: true })
      .in('variant_id', variantIds)
    if (saleError) {
      console.error('[inventory:delete] check sales data failed', saleError)
      return { ok: false, error: 'Could not delete the product. Please try again.', status: 500 }
    }
    if ((saleCount ?? 0) > 0) {
      return { ok: false, error: 'This product has sales history and cannot be deleted', status: 409 }
    }
  }

  const { error } = await table(supabase, 'inventory_items')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', itemId)
    .eq('business_id', businessId)

  if (error) {
    console.error('[inventory:delete] update failed', error)
    return { ok: false, error: 'Could not delete the product. Please try again.', status: 500 }
  }

  return { ok: true, data: null }
}

async function validateName(
  supabase: ServiceClient,
  businessId: string,
  name: string,
  excludeId?: string
): Promise<string | null> {
  if (!name) return 'Name cannot be empty'
  if (name.length > 100) return 'Name must be under 100 characters'

  let query = table(supabase, 'inventory_items')
    .select('id')
    .eq('business_id', businessId)
    .is('deleted_at', null)
    .ilike('name', name)
  if (excludeId) query = query.neq('id', excludeId)

  const { data, error } = await query.maybeSingle()
  if (error) {
    console.error('[inventory:validate-name] lookup failed', error)
    return 'Could not validate the product name. Please try again.'
  }
  if (data) return DUPLICATE_NAME_ERROR
  return null
}

type FieldError = { error: string; status: number } | null

async function validateUnit(supabase: ServiceClient, businessId: string, unitId: string): Promise<FieldError> {
  if (!unitId) return { error: 'Unit is required', status: 400 }

  const { data: unit, error } = await table(supabase, 'units')
    .select('id, business_id')
    .eq('id', unitId)
    .maybeSingle()
  if (error) {
    console.error('[inventory:validate-unit] fetch failed', error)
    return { error: GENERIC_SAVE_ERROR, status: 500 }
  }
  if (!unit || unit.business_id !== businessId) {
    return { error: 'Unit not found', status: 404 }
  }
  return null
}

async function validateCategory(supabase: ServiceClient, businessId: string, categoryId: string | null): Promise<FieldError> {
  if (!categoryId) return null

  const { data: category, error } = await table(supabase, 'categories')
    .select('id, business_id')
    .eq('id', categoryId)
    .maybeSingle()
  if (error) {
    console.error('[inventory:validate-category] fetch failed', error)
    return { error: GENERIC_SAVE_ERROR, status: 500 }
  }
  if (!category || category.business_id !== businessId) {
    return { error: 'Category not found', status: 404 }
  }
  return null
}

async function validateAttributeIds(supabase: ServiceClient, businessId: string, attributeIds: string[]): Promise<FieldError> {
  if (attributeIds.length === 0) return null

  const { data: attrs, error } = await table(supabase, 'attributes')
    .select('id, business_id')
    .in('id', attributeIds)
  if (error) {
    console.error('[inventory:validate-attributes] fetch failed', error)
    return { error: GENERIC_SAVE_ERROR, status: 500 }
  }
  const validIds = new Set(
    (attrs as { id: string; business_id: string }[] ?? [])
      .filter(a => a.business_id === businessId)
      .map(a => a.id)
  )
  if (validIds.size !== attributeIds.length) {
    return { error: 'One or more attributes were not found', status: 404 }
  }
  return null
}

export interface CreateInventoryItemInput {
  name: string
  categoryId: string | null
  unitId: string
  hasExpiry: boolean
  notes: string | null
  attributeIds: string[]
}

export async function createInventoryItem(
  supabase: ServiceClient,
  businessId: string,
  input: CreateInventoryItemInput
): Promise<ServiceResult<InventoryItemWithDetails>> {
  const name = input.name.trim()

  const nameError = await validateName(supabase, businessId, name)
  if (nameError) return { ok: false, error: nameError, status: 400 }

  const unitError = await validateUnit(supabase, businessId, input.unitId)
  if (unitError) return { ok: false, ...unitError }

  const categoryError = await validateCategory(supabase, businessId, input.categoryId)
  if (categoryError) return { ok: false, ...categoryError }

  const attributeIds = Array.from(new Set(input.attributeIds))
  const attrError = await validateAttributeIds(supabase, businessId, attributeIds)
  if (attrError) return { ok: false, ...attrError }

  const { data: inserted, error: insertError } = await table(supabase, 'inventory_items')
    .insert({
      business_id: businessId,
      name,
      category_id: input.categoryId,
      unit_id: input.unitId,
      has_expiry: input.hasExpiry,
      notes: input.notes,
    })
    .select('id')
    .single()

  if (insertError || !inserted) {
    if (isUniqueViolation(insertError)) {
      return { ok: false, error: DUPLICATE_NAME_ERROR, status: 400 }
    }
    console.error('[inventory:create] insert failed', insertError)
    return { ok: false, error: GENERIC_SAVE_ERROR, status: 500 }
  }

  const itemId = (inserted as { id: string }).id

  if (attributeIds.length > 0) {
    const { error: attrDefError } = await table(supabase, 'attribute_definitions').insert(
      attributeIds.map((attributeId, index) => ({
        inventory_item_id: itemId,
        attribute_id: attributeId,
        display_order: index,
      }))
    )
    if (attrDefError) {
      console.error('[inventory:create] attribute_definitions insert failed', attrDefError)
      // Roll back — don't leave behind a product whose selected attributes never saved.
      await table(supabase, 'inventory_items').delete().eq('id', itemId)
      return { ok: false, error: GENERIC_SAVE_ERROR, status: 500 }
    }
  }

  const defaultVariant = await createDefaultVariant(supabase, itemId)
  if (!defaultVariant.ok) {
    // Roll back — a product with no variant at all can't be sold or stocked.
    await table(supabase, 'inventory_items').delete().eq('id', itemId)
    return { ok: false, error: GENERIC_SAVE_ERROR, status: 500 }
  }

  const { data: created, error: fetchError } = await table(supabase, 'inventory_items')
    .select(ITEM_SELECT_WITH_DETAILS)
    .eq('id', itemId)
    .single()

  if (fetchError || !created) {
    console.error('[inventory:create] refetch failed', fetchError)
    return { ok: false, error: GENERIC_SAVE_ERROR, status: 500 }
  }

  // A freshly created default variant always has 0 stock — no need to query for it.
  return { ok: true, data: hydrateItem(created as unknown as RawItemRow, { variantCount: 1, currentStock: 0 }) }
}

export interface UpdateInventoryItemInput {
  name: string
  categoryId: string | null
  unitId: string
  hasExpiry: boolean
  hasVariants: boolean
  notes: string | null
  attributeIds: string[]
  confirmAttributeRemoval: boolean
}

export type UpdateInventoryItemResult =
  | { ok: true; data: InventoryItemWithDetails }
  | { ok: false; error: string; status: number; requiresConfirmation?: true; affectedAttributes?: string[] }

export async function updateInventoryItem(
  supabase: ServiceClient,
  businessId: string,
  itemId: string,
  input: UpdateInventoryItemInput
): Promise<UpdateInventoryItemResult> {
  const { data: existing, error: fetchError } = await table(supabase, 'inventory_items')
    .select('id, business_id')
    .eq('id', itemId)
    .is('deleted_at', null)
    .maybeSingle()
  if (fetchError) {
    console.error('[inventory:update] fetch failed', fetchError)
    return { ok: false, error: GENERIC_SAVE_ERROR, status: 500 }
  }
  if (!existing || existing.business_id !== businessId) {
    return { ok: false, error: 'Product not found', status: 404 }
  }

  const name = input.name.trim()

  const nameError = await validateName(supabase, businessId, name, itemId)
  if (nameError) return { ok: false, error: nameError, status: 400 }

  const unitError = await validateUnit(supabase, businessId, input.unitId)
  if (unitError) return { ok: false, ...unitError }

  const categoryError = await validateCategory(supabase, businessId, input.categoryId)
  if (categoryError) return { ok: false, ...categoryError }

  const newAttributeIds = Array.from(new Set(input.attributeIds))
  const attrError = await validateAttributeIds(supabase, businessId, newAttributeIds)
  if (attrError) return { ok: false, ...attrError }

  const { data: currentDefs, error: defsError } = await table(supabase, 'attribute_definitions')
    .select('id, attribute_id, display_order')
    .eq('inventory_item_id', itemId)
  if (defsError) {
    console.error('[inventory:update] fetch attribute_definitions failed', defsError)
    return { ok: false, error: GENERIC_SAVE_ERROR, status: 500 }
  }

  const defs = (currentDefs ?? []) as { id: string; attribute_id: string; display_order: number }[]
  const toAdd = newAttributeIds.filter(id => !defs.some(d => d.attribute_id === id))
  const toRemove = defs.filter(d => !newAttributeIds.includes(d.attribute_id))

  // An attribute definition with real variant data would otherwise be
  // silently cascade-deleted (attribute_definitions -> variant_attribute_values
  // is ON DELETE CASCADE) — require the caller to confirm first instead.
  if (toRemove.length > 0 && !input.confirmAttributeRemoval) {
    const { data: usedRows, error: usedError } = await table(supabase, 'variant_attribute_values')
      .select('attribute_definition_id')
      .in('attribute_definition_id', toRemove.map(d => d.id))
    if (usedError) {
      console.error('[inventory:update] check variant usage failed', usedError)
      return { ok: false, error: GENERIC_SAVE_ERROR, status: 500 }
    }
    const usedDefIds = new Set((usedRows ?? []).map((r: { attribute_definition_id: string }) => r.attribute_definition_id))
    const affectedDefs = toRemove.filter(d => usedDefIds.has(d.id))

    if (affectedDefs.length > 0) {
      const { data: attrRows, error: attrNameError } = await table(supabase, 'attributes')
        .select('id, name')
        .in('id', affectedDefs.map(d => d.attribute_id))
      if (attrNameError) {
        console.error('[inventory:update] fetch attribute names failed', attrNameError)
        return { ok: false, error: GENERIC_SAVE_ERROR, status: 500 }
      }
      const names = affectedDefs.map(d =>
        (attrRows as { id: string; name: string }[] ?? []).find(a => a.id === d.attribute_id)?.name ?? 'Unknown'
      )
      return {
        ok: false,
        error: 'Some attributes have variant data attached. Confirm to remove them anyway.',
        status: 409,
        requiresConfirmation: true,
        affectedAttributes: names,
      }
    }
  }

  // Turning has_variants off only makes sense with a single, unambiguous
  // variant — with 2+ variants there's no well-defined "which one becomes
  // the default" answer, so block it here regardless of what the client sent.
  if (!input.hasVariants) {
    const extra = await getVariantCountsAndStock(supabase, [itemId])
    if (extra === null) return { ok: false, error: GENERIC_SAVE_ERROR, status: 500 }
    if ((extra.variantCounts[itemId] ?? 0) > 1) {
      return {
        ok: false,
        error: 'This product has multiple variants — remove the extra ones before turning this off.',
        status: 409,
      }
    }
  }

  const { error: updateError } = await table(supabase, 'inventory_items')
    .update({
      name,
      category_id: input.categoryId,
      unit_id: input.unitId,
      has_expiry: input.hasExpiry,
      has_variants: input.hasVariants,
      notes: input.notes,
    })
    .eq('id', itemId)

  if (updateError) {
    if (isUniqueViolation(updateError)) {
      return { ok: false, error: DUPLICATE_NAME_ERROR, status: 400 }
    }
    console.error('[inventory:update] update failed', updateError)
    return { ok: false, error: GENERIC_SAVE_ERROR, status: 500 }
  }

  if (toRemove.length > 0) {
    const { error } = await table(supabase, 'attribute_definitions')
      .delete()
      .in('id', toRemove.map(d => d.id))
    if (error) {
      console.error('[inventory:update] delete attribute_definitions failed', error)
      return { ok: false, error: GENERIC_SAVE_ERROR, status: 500 }
    }
  }

  if (toAdd.length > 0) {
    const maxExistingOrder = defs.reduce((max, d) => Math.max(max, d.display_order), -1)
    const startOrder = maxExistingOrder + 1
    const { error } = await table(supabase, 'attribute_definitions').insert(
      toAdd.map((attributeId, i) => ({
        inventory_item_id: itemId,
        attribute_id: attributeId,
        display_order: startOrder + i,
      }))
    )
    if (error) {
      console.error('[inventory:update] insert attribute_definitions failed', error)
      return { ok: false, error: GENERIC_SAVE_ERROR, status: 500 }
    }
  }

  const { data: updated, error: refetchError } = await table(supabase, 'inventory_items')
    .select(ITEM_SELECT_WITH_DETAILS)
    .eq('id', itemId)
    .single()

  if (refetchError || !updated) {
    console.error('[inventory:update] refetch failed', refetchError)
    return { ok: false, error: GENERIC_SAVE_ERROR, status: 500 }
  }

  const extra = await getVariantCountsAndStock(supabase, [itemId])
  if (extra === null) return { ok: false, error: GENERIC_SAVE_ERROR, status: 500 }

  return {
    ok: true,
    data: hydrateItem(updated as unknown as RawItemRow, {
      variantCount: extra.variantCounts[itemId] ?? 0,
      currentStock: extra.stockByItem[itemId] ?? 0,
    }),
  }
}

export interface StockRowInput {
  quantity: number
  expiryDate: string | null
}

export interface CreateInventoryItemWithStockInput {
  name: string
  categoryId: string | null
  unitId: string
  hasExpiry: boolean
  notes: string | null
  attributeIds: string[]
  hasVariants: boolean
  variantName: string | null
  code: string | null
  purchaseCost: number
  targetProfitPercent: number | null
  sellingPrice: number
  stockRows: StockRowInput[]
}

export interface CreateInventoryItemWithStockResult {
  item: InventoryItemWithDetails
  variant: InventoryVariant
}

// Collects everything the redesigned "Add Product" form submits — item,
// variant, and opening stock — into one atomic call, instead of the client
// sequencing 3 separate requests with partial-failure handling.
export async function createInventoryItemWithStock(
  supabase: ServiceClient,
  businessId: string,
  input: CreateInventoryItemWithStockInput
): Promise<ServiceResult<CreateInventoryItemWithStockResult>> {
  const name = input.name.trim()

  const nameError = await validateName(supabase, businessId, name)
  if (nameError) return { ok: false, error: nameError, status: 400 }

  const unitError = await validateUnit(supabase, businessId, input.unitId)
  if (unitError) return { ok: false, ...unitError }

  const categoryError = await validateCategory(supabase, businessId, input.categoryId)
  if (categoryError) return { ok: false, ...categoryError }

  const attributeIds = Array.from(new Set(input.attributeIds))
  const attrError = await validateAttributeIds(supabase, businessId, attributeIds)
  if (attrError) return { ok: false, ...attrError }

  if (input.hasVariants && !input.variantName?.trim()) {
    return { ok: false, error: 'Variant name is required', status: 400 }
  }
  if (!input.purchaseCost || input.purchaseCost <= 0) {
    return { ok: false, error: 'Purchase cost must be a positive number', status: 400 }
  }
  if (!input.sellingPrice || input.sellingPrice <= 0) {
    return { ok: false, error: 'Selling price must be a positive number', status: 400 }
  }
  // Opening stock is optional — a product can be created before it's ever
  // been purchased. A row is only meaningful once it carries quantity, so
  // rows left at 0 are dropped later rather than rejected here.
  for (const row of input.stockRows) {
    if (row.quantity < 0) {
      return { ok: false, error: 'Stock quantity cannot be negative', status: 400 }
    }
    if (input.hasExpiry && row.quantity > 0 && !row.expiryDate) {
      return { ok: false, error: 'Expiry date is required for batches with stock', status: 400 }
    }
  }

  const branchId = await getDefaultBranchId(supabase, businessId)
  if (!branchId) {
    console.error('[inventory:create-with-stock] no default branch for business', businessId)
    return { ok: false, error: 'Could not find a default branch for this business.', status: 500 }
  }

  const { data: inserted, error: insertError } = await table(supabase, 'inventory_items')
    .insert({
      business_id: businessId,
      name,
      category_id: input.categoryId,
      unit_id: input.unitId,
      has_expiry: input.hasExpiry,
      has_variants: input.hasVariants,
      notes: input.notes,
    })
    .select('id')
    .single()

  if (insertError || !inserted) {
    if (isUniqueViolation(insertError)) {
      return { ok: false, error: DUPLICATE_NAME_ERROR, status: 400 }
    }
    console.error('[inventory:create-with-stock] insert failed', insertError)
    return { ok: false, error: GENERIC_SAVE_ERROR, status: 500 }
  }

  const itemId = (inserted as { id: string }).id

  if (attributeIds.length > 0) {
    const { error: attrDefError } = await table(supabase, 'attribute_definitions').insert(
      attributeIds.map((attributeId, index) => ({
        inventory_item_id: itemId,
        attribute_id: attributeId,
        display_order: index,
      }))
    )
    if (attrDefError) {
      console.error('[inventory:create-with-stock] attribute_definitions insert failed', attrDefError)
      await table(supabase, 'inventory_items').delete().eq('id', itemId)
      return { ok: false, error: GENERIC_SAVE_ERROR, status: 500 }
    }
  }

  const variantCode = input.code?.trim()
    ? input.code.trim()
    : input.hasVariants
      ? input.variantName!.trim()
      : 'VAR-001'

  const { data: insertedVariant, error: variantError } = await table(supabase, 'inventory_variants')
    .insert({
      inventory_item_id: itemId,
      variant_code: variantCode,
      purchase_price: input.purchaseCost,
      selling_price: input.sellingPrice,
      target_profit_percent: input.targetProfitPercent,
    })
    .select('*')
    .single()

  if (variantError || !insertedVariant) {
    console.error('[inventory:create-with-stock] variant insert failed', variantError)
    await table(supabase, 'inventory_items').delete().eq('id', itemId)
    return { ok: false, error: GENERIC_SAVE_ERROR, status: 500 }
  }

  const variant = insertedVariant as InventoryVariant

  // Rows left at 0 quantity represent "no stock yet" and aren't real
  // batches — nothing to insert or track for them.
  const stockedRows = input.stockRows.filter(row => row.quantity > 0)

  if (stockedRows.length > 0) {
    const { error: batchError } = await table(supabase, 'inventory_batches').insert(
      stockedRows.map(row => ({
        business_id: businessId,
        variant_id: variant.id,
        branch_id: branchId,
        purchase_price: input.purchaseCost,
        quantity_received: row.quantity,
        quantity_remaining: row.quantity,
        expiry_date: row.expiryDate,
        batch_number: 'Opening Stock',
      }))
    )

    if (batchError) {
      console.error('[inventory:create-with-stock] batch insert failed', batchError)
      // Cascades into the just-inserted batches thanks to the FK's ON DELETE
      // CASCADE (migration 013) — no separate batch cleanup needed.
      await table(supabase, 'inventory_items').delete().eq('id', itemId)
      return { ok: false, error: GENERIC_SAVE_ERROR, status: 500 }
    }
  }

  const { data: created, error: fetchError } = await table(supabase, 'inventory_items')
    .select(ITEM_SELECT_WITH_DETAILS)
    .eq('id', itemId)
    .single()

  if (fetchError || !created) {
    console.error('[inventory:create-with-stock] refetch failed', fetchError)
    return { ok: false, error: GENERIC_SAVE_ERROR, status: 500 }
  }

  const openingStock = stockedRows.reduce((sum, row) => sum + row.quantity, 0)
  const item = hydrateItem(created as unknown as RawItemRow, { variantCount: 1, currentStock: openingStock })

  return { ok: true, data: { item, variant } }
}
