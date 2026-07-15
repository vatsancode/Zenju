import type { createClient } from '@/lib/supabase/server'
import { table } from '@/lib/supabase/server'
import type { Unit } from '@/types/database'

type ServiceClient = Awaited<ReturnType<typeof createClient>>

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number }

export function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

// Postgres unique_violation — see migration 009_units_unique_name.sql. The
// app-level duplicate check below can still race (two requests both read
// "no duplicate yet" before either inserts), so the DB index is the actual
// guarantee; this just turns its error into the same friendly message.
function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505'
}

const DUPLICATE_NAME_ERROR = 'A unit with this name already exists'

export interface UnitWithUsage extends Unit {
  in_use: boolean
}

export async function listUnits(
  supabase: ServiceClient,
  businessId: string
): Promise<ServiceResult<UnitWithUsage[]>> {
  const { data, error } = await table(supabase, 'units')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[units:list] fetch failed', error)
    return { ok: false, error: 'Could not load units. Please try again.', status: 500 }
  }

  const units = data as unknown as Unit[]
  if (units.length === 0) return { ok: true, data: [] }

  const usedUnitIds = await getUsedUnitIds(supabase, businessId)
  if (!usedUnitIds.ok) return usedUnitIds

  return {
    ok: true,
    data: units.map(u => ({ ...u, in_use: usedUnitIds.data.has(u.id) })),
  }
}

// Units are referenced from two places — an inventory item's base unit, and
// a catalogue component's unit — so both need checking, batched in one
// query each rather than per-unit (the N+1 pattern that made category
// deletes slow before it was fixed).
async function getUsedUnitIds(supabase: ServiceClient, businessId: string): Promise<ServiceResult<Set<string>>> {
  const [{ data: invRows, error: invError }, { data: compRows, error: compError }] = await Promise.all([
    table(supabase, 'inventory_items').select('unit_id').eq('business_id', businessId).is('deleted_at', null),
    table(supabase, 'catalogue_components').select('unit_id, catalogue_items!inner(business_id)').eq('catalogue_items.business_id', businessId).is('catalogue_items.deleted_at', null),
  ])

  if (invError || compError) {
    console.error('[units:usage] fetch failed', invError, compError)
    return { ok: false, error: 'Could not load units. Please try again.', status: 500 }
  }

  const usedIds = new Set<string>()
  for (const row of [...(invRows ?? []), ...(compRows ?? [])] as { unit_id: string | null }[]) {
    if (row.unit_id) usedIds.add(row.unit_id)
  }
  return { ok: true, data: usedIds }
}

async function isUnitInUse(supabase: ServiceClient, businessId: string, unitId: string): Promise<boolean> {
  const [{ count: invCount }, { count: compCount }] = await Promise.all([
    table(supabase, 'inventory_items')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('unit_id', unitId)
      .is('deleted_at', null),
    table(supabase, 'catalogue_components')
      .select('id, catalogue_items!inner(business_id)', { count: 'exact', head: true })
      .eq('unit_id', unitId)
      .eq('catalogue_items.business_id', businessId)
      .is('catalogue_items.deleted_at', null),
  ])
  return (invCount ?? 0) > 0 || (compCount ?? 0) > 0
}

async function validateName(
  supabase: ServiceClient,
  businessId: string,
  name: string,
  excludeId?: string
): Promise<string | null> {
  if (!name) return 'Name cannot be empty'
  if (name.length > 30) return 'Name must be under 30 characters'

  let query = table(supabase, 'units')
    .select('id')
    .eq('business_id', businessId)
    .ilike('name', name)
  if (excludeId) query = query.neq('id', excludeId)

  const { data, error } = await query.maybeSingle()
  if (error) {
    console.error('[units:validate-name] lookup failed', error)
    return 'Could not validate the unit name. Please try again.'
  }
  if (data) return DUPLICATE_NAME_ERROR
  return null
}

export interface CreateUnitInput {
  name: string
  allowsDecimal: boolean
}

export async function createUnit(
  supabase: ServiceClient,
  businessId: string,
  input: CreateUnitInput
): Promise<ServiceResult<Unit>> {
  const name = input.name.trim()

  const nameError = await validateName(supabase, businessId, name)
  if (nameError) return { ok: false, error: nameError, status: 400 }

  const { data, error } = await table(supabase, 'units')
    .insert({
      business_id: businessId,
      name,
      // No dedicated abbreviation input in the UI yet — default it to the
      // name itself, since the column is NOT NULL in the schema.
      abbreviation: name,
      allows_decimal: input.allowsDecimal,
      is_locked: false,
    })
    .select('*')
    .single()

  if (error || !data) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: DUPLICATE_NAME_ERROR, status: 400 }
    }
    console.error('[units:create] insert failed', error)
    return { ok: false, error: 'Could not create the unit. Please try again.', status: 500 }
  }

  return { ok: true, data: data as unknown as Unit }
}

export async function renameUnit(
  supabase: ServiceClient,
  businessId: string,
  id: string,
  name: string
): Promise<ServiceResult<Unit>> {
  const trimmed = name.trim()

  const { data: existing, error: fetchError } = await table(supabase, 'units')
    .select('id, business_id')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) {
    console.error('[units:rename] fetch failed', fetchError)
    return { ok: false, error: 'Could not rename the unit. Please try again.', status: 500 }
  }
  if (!existing || existing.business_id !== businessId) {
    return { ok: false, error: 'Unit not found', status: 404 }
  }

  if (await isUnitInUse(supabase, businessId, id)) {
    return { ok: false, error: 'This unit is in use and cannot be renamed', status: 409 }
  }

  const nameError = await validateName(supabase, businessId, trimmed, id)
  if (nameError) return { ok: false, error: nameError, status: 400 }

  const { data, error } = await table(supabase, 'units')
    .update({ name: trimmed })
    .eq('id', id)
    .select('*')
    .single()

  if (error || !data) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: DUPLICATE_NAME_ERROR, status: 400 }
    }
    console.error('[units:rename] update failed', error)
    return { ok: false, error: 'Could not rename the unit. Please try again.', status: 500 }
  }

  return { ok: true, data: data as unknown as Unit }
}

export async function toggleUnitDecimal(
  supabase: ServiceClient,
  businessId: string,
  id: string,
  allowsDecimal: boolean
): Promise<ServiceResult<Unit>> {
  const { data: existing, error: fetchError } = await table(supabase, 'units')
    .select('id, business_id')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) {
    console.error('[units:toggle-decimal] fetch failed', fetchError)
    return { ok: false, error: 'Could not update the unit. Please try again.', status: 500 }
  }
  if (!existing || existing.business_id !== businessId) {
    return { ok: false, error: 'Unit not found', status: 404 }
  }

  if (await isUnitInUse(supabase, businessId, id)) {
    return { ok: false, error: 'This unit is in use and cannot be changed', status: 409 }
  }

  const { data, error } = await table(supabase, 'units')
    .update({ allows_decimal: allowsDecimal })
    .eq('id', id)
    .select('*')
    .single()

  if (error || !data) {
    console.error('[units:toggle-decimal] update failed', error)
    return { ok: false, error: 'Could not update the unit. Please try again.', status: 500 }
  }

  return { ok: true, data: data as unknown as Unit }
}

export async function deleteUnit(
  supabase: ServiceClient,
  businessId: string,
  id: string
): Promise<ServiceResult<null>> {
  const { data: existing, error: fetchError } = await table(supabase, 'units')
    .select('id, business_id')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) {
    console.error('[units:delete] fetch failed', fetchError)
    return { ok: false, error: 'Could not delete the unit. Please try again.', status: 500 }
  }
  if (!existing || existing.business_id !== businessId) {
    return { ok: false, error: 'Unit not found', status: 404 }
  }

  if (await isUnitInUse(supabase, businessId, id)) {
    return { ok: false, error: 'This unit is in use and cannot be deleted', status: 409 }
  }

  const { error } = await table(supabase, 'units')
    .delete()
    .eq('business_id', businessId)
    .eq('id', id)

  if (error) {
    console.error('[units:delete] delete failed', error)
    return { ok: false, error: 'Could not delete the unit. Please try again.', status: 500 }
  }

  return { ok: true, data: null }
}
