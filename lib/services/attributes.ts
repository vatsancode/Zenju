import type { createClient } from '@/lib/supabase/server'
import { table } from '@/lib/supabase/server'
import type { Attribute } from '@/types/database'

type ServiceClient = Awaited<ReturnType<typeof createClient>>

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number }

export function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

// Postgres unique_violation — migration 011's attributes_unique_name is the
// actual guarantee (see the same reasoning in categories.ts/units.ts); this
// just turns its error into a friendly message if the app-level check races.
function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505'
}

const DUPLICATE_NAME_ERROR = 'An attribute with this name already exists'

export interface AttributeWithUsage extends Attribute {
  in_use: boolean
}

// attribute_definitions has no business_id of its own — it's scoped through
// inventory_item_id -> inventory_items.business_id, same join pattern used
// for catalogue_components in units.ts.
async function getUsedAttributeIds(supabase: ServiceClient, businessId: string): Promise<ServiceResult<Set<string>>> {
  const { data, error } = await table(supabase, 'attribute_definitions')
    .select('attribute_id, inventory_items!inner(business_id)')
    .eq('inventory_items.business_id', businessId)
    .is('inventory_items.deleted_at', null)

  if (error) {
    console.error('[attributes:usage] fetch failed', error)
    return { ok: false, error: 'Could not load attributes. Please try again.', status: 500 }
  }

  const usedIds = new Set<string>()
  for (const row of (data ?? []) as { attribute_id: string }[]) {
    usedIds.add(row.attribute_id)
  }
  return { ok: true, data: usedIds }
}

async function isAttributeInUse(supabase: ServiceClient, businessId: string, attributeId: string): Promise<boolean> {
  const { count } = await table(supabase, 'attribute_definitions')
    .select('id, inventory_items!inner(business_id)', { count: 'exact', head: true })
    .eq('attribute_id', attributeId)
    .eq('inventory_items.business_id', businessId)
    .is('inventory_items.deleted_at', null)
  return (count ?? 0) > 0
}

export async function listAttributes(
  supabase: ServiceClient,
  businessId: string
): Promise<ServiceResult<AttributeWithUsage[]>> {
  const { data, error } = await table(supabase, 'attributes')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[attributes:list] fetch failed', error)
    return { ok: false, error: 'Could not load attributes. Please try again.', status: 500 }
  }

  const attributes = data as unknown as Attribute[]
  if (attributes.length === 0) return { ok: true, data: [] }

  const usedIds = await getUsedAttributeIds(supabase, businessId)
  if (!usedIds.ok) return usedIds

  return {
    ok: true,
    data: attributes.map(a => ({ ...a, in_use: usedIds.data.has(a.id) })),
  }
}

async function validateName(
  supabase: ServiceClient,
  businessId: string,
  name: string,
  excludeId?: string
): Promise<string | null> {
  if (!name) return 'Name cannot be empty'
  if (name.length > 50) return 'Name must be under 50 characters'

  let query = table(supabase, 'attributes')
    .select('id')
    .eq('business_id', businessId)
    .ilike('name', name)
  if (excludeId) query = query.neq('id', excludeId)

  const { data, error } = await query.maybeSingle()
  if (error) {
    console.error('[attributes:validate-name] lookup failed', error)
    return 'Could not validate the attribute name. Please try again.'
  }
  if (data) return DUPLICATE_NAME_ERROR
  return null
}

export async function createAttribute(
  supabase: ServiceClient,
  businessId: string,
  name: string
): Promise<ServiceResult<Attribute>> {
  const trimmed = name.trim()

  const nameError = await validateName(supabase, businessId, trimmed)
  if (nameError) return { ok: false, error: nameError, status: 400 }

  const { data, error } = await table(supabase, 'attributes')
    .insert({ business_id: businessId, name: trimmed })
    .select('*')
    .single()

  if (error || !data) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: DUPLICATE_NAME_ERROR, status: 400 }
    }
    console.error('[attributes:create] insert failed', error)
    return { ok: false, error: 'Could not create the attribute. Please try again.', status: 500 }
  }

  return { ok: true, data: data as unknown as Attribute }
}

export async function renameAttribute(
  supabase: ServiceClient,
  businessId: string,
  id: string,
  name: string
): Promise<ServiceResult<Attribute>> {
  const trimmed = name.trim()

  const { data: existing, error: fetchError } = await table(supabase, 'attributes')
    .select('id, business_id')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) {
    console.error('[attributes:rename] fetch failed', fetchError)
    return { ok: false, error: 'Could not rename the attribute. Please try again.', status: 500 }
  }
  if (!existing || existing.business_id !== businessId) {
    return { ok: false, error: 'Attribute not found', status: 404 }
  }

  if (await isAttributeInUse(supabase, businessId, id)) {
    return { ok: false, error: 'This attribute is in use and cannot be renamed', status: 409 }
  }

  const nameError = await validateName(supabase, businessId, trimmed, id)
  if (nameError) return { ok: false, error: nameError, status: 400 }

  const { data, error } = await table(supabase, 'attributes')
    .update({ name: trimmed })
    .eq('id', id)
    .select('*')
    .single()

  if (error || !data) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: DUPLICATE_NAME_ERROR, status: 400 }
    }
    console.error('[attributes:rename] update failed', error)
    return { ok: false, error: 'Could not rename the attribute. Please try again.', status: 500 }
  }

  return { ok: true, data: data as unknown as Attribute }
}

export async function deleteAttribute(
  supabase: ServiceClient,
  businessId: string,
  id: string
): Promise<ServiceResult<null>> {
  const { data: existing, error: fetchError } = await table(supabase, 'attributes')
    .select('id, business_id')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) {
    console.error('[attributes:delete] fetch failed', fetchError)
    return { ok: false, error: 'Could not delete the attribute. Please try again.', status: 500 }
  }
  if (!existing || existing.business_id !== businessId) {
    return { ok: false, error: 'Attribute not found', status: 404 }
  }

  if (await isAttributeInUse(supabase, businessId, id)) {
    return { ok: false, error: 'This attribute is in use and cannot be deleted', status: 409 }
  }

  const { error } = await table(supabase, 'attributes')
    .delete()
    .eq('business_id', businessId)
    .eq('id', id)

  if (error) {
    console.error('[attributes:delete] delete failed', error)
    return { ok: false, error: 'Could not delete the attribute. Please try again.', status: 500 }
  }

  return { ok: true, data: null }
}
