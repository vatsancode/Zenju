import type { createClient } from '@/lib/supabase/server'
import { table } from '@/lib/supabase/server'
import type { InventoryItem } from '@/types/database'

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

function hydrateItem(row: RawItemRow): InventoryItemWithDetails {
  const defs = [...(row.attribute_definitions ?? [])].sort((a, b) => a.display_order - b.display_order)
  const { categories, units, attribute_definitions, ...item } = row
  return {
    ...item,
    category_name: categories?.name ?? null,
    unit_name: units?.name ?? '',
    attribute_ids: defs.map(d => d.attribute_id),
    attribute_names: defs.map(d => d.attributes?.name ?? ''),
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

  return { ok: true, data: (data as unknown as RawItemRow[]).map(hydrateItem) }
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
  expiresWithinDays: number | null
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

  if (input.hasExpiry && (!input.expiresWithinDays || input.expiresWithinDays <= 0)) {
    return { ok: false, error: 'Expiry days must be a positive number', status: 400 }
  }

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
      expires_within_days: input.hasExpiry ? input.expiresWithinDays : null,
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

  const { data: created, error: fetchError } = await table(supabase, 'inventory_items')
    .select(ITEM_SELECT_WITH_DETAILS)
    .eq('id', itemId)
    .single()

  if (fetchError || !created) {
    console.error('[inventory:create] refetch failed', fetchError)
    return { ok: false, error: GENERIC_SAVE_ERROR, status: 500 }
  }

  return { ok: true, data: hydrateItem(created as unknown as RawItemRow) }
}

export interface UpdateInventoryItemInput {
  name: string
  categoryId: string | null
  unitId: string
  hasExpiry: boolean
  expiresWithinDays: number | null
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

  if (input.hasExpiry && (!input.expiresWithinDays || input.expiresWithinDays <= 0)) {
    return { ok: false, error: 'Expiry days must be a positive number', status: 400 }
  }

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

  const { error: updateError } = await table(supabase, 'inventory_items')
    .update({
      name,
      category_id: input.categoryId,
      unit_id: input.unitId,
      has_expiry: input.hasExpiry,
      expires_within_days: input.hasExpiry ? input.expiresWithinDays : null,
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

  return { ok: true, data: hydrateItem(updated as unknown as RawItemRow) }
}
