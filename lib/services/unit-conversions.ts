import type { createClient } from '@/lib/supabase/server'
import { table } from '@/lib/supabase/server'
import type { UnitConversion } from '@/types/database'

type ServiceClient = Awaited<ReturnType<typeof createClient>>

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number }

// Postgres unique_violation — migration 001's UNIQUE (business_id,
// from_unit_id, to_unit_id) is the floor guarantee against the exact same
// pair racing in twice. It doesn't catch a reversed pair or an indirect
// path — those are real graph logic, not a uniqueness constraint, so they
// stay app-level in findConversionFactor() below (same as the client-side
// copy in app/dashboard/settings/page.tsx, re-checked here rather than
// trusted from the client).
function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505'
}

// Ported from the client-side copy in app/dashboard/settings/page.tsx —
// BFS over the conversion graph to find whether any path (direct or
// through other units) already relates the two units.
function findConversionFactor(
  sourceId: string,
  targetId: string,
  conversions: UnitConversion[]
): number | null {
  if (sourceId === targetId) return 1

  const graph = new Map<string, { unitId: string; factor: number }[]>()
  for (const conv of conversions) {
    if (!graph.has(conv.from_unit_id)) graph.set(conv.from_unit_id, [])
    if (!graph.has(conv.to_unit_id)) graph.set(conv.to_unit_id, [])
    graph.get(conv.from_unit_id)!.push({ unitId: conv.to_unit_id, factor: conv.factor })
    graph.get(conv.to_unit_id)!.push({ unitId: conv.from_unit_id, factor: 1 / conv.factor })
  }

  const visited = new Set<string>([sourceId])
  const queue: { unitId: string; acc: number }[] = [{ unitId: sourceId, acc: 1 }]

  while (queue.length > 0) {
    const { unitId, acc } = queue.shift()!
    for (const edge of graph.get(unitId) || []) {
      if (edge.unitId === targetId) return acc * edge.factor
      if (!visited.has(edge.unitId)) {
        visited.add(edge.unitId)
        queue.push({ unitId: edge.unitId, acc: acc * edge.factor })
      }
    }
  }
  return null
}

export async function listConversions(
  supabase: ServiceClient,
  businessId: string
): Promise<ServiceResult<UnitConversion[]>> {
  const { data, error } = await table(supabase, 'unit_conversions')
    .select('*')
    .eq('business_id', businessId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[unit-conversions:list] fetch failed', error)
    return { ok: false, error: 'Could not load unit conversions. Please try again.', status: 500 }
  }

  return { ok: true, data: data as unknown as UnitConversion[] }
}

export interface CreateConversionInput {
  fromUnitId: string
  toUnitId: string
  factor: number
}

export async function createConversion(
  supabase: ServiceClient,
  businessId: string,
  input: CreateConversionInput
): Promise<ServiceResult<UnitConversion>> {
  const { fromUnitId, toUnitId, factor } = input

  if (!fromUnitId || !toUnitId) return { ok: false, error: 'Select both units', status: 400 }
  if (fromUnitId === toUnitId) return { ok: false, error: 'Cannot convert a unit to itself', status: 400 }
  if (!Number.isFinite(factor) || factor <= 0) {
    return { ok: false, error: 'Factor must be a positive number', status: 400 }
  }

  const [
    { data: unitRows, error: unitError },
    { data: existingConversions, error: fetchError },
  ] = await Promise.all([
    table(supabase, 'units')
      .select('id')
      .eq('business_id', businessId)
      .in('id', [fromUnitId, toUnitId]),
    table(supabase, 'unit_conversions')
      .select('*')
      .eq('business_id', businessId),
  ])

  if (unitError) {
    console.error('[unit-conversions:create] fetch units failed', unitError)
    return { ok: false, error: 'Could not create the conversion. Please try again.', status: 500 }
  }
  if ((unitRows ?? []).length !== 2) {
    return { ok: false, error: 'One or both units were not found', status: 404 }
  }

  if (fetchError) {
    console.error('[unit-conversions:create] fetch existing failed', fetchError)
    return { ok: false, error: 'Could not create the conversion. Please try again.', status: 500 }
  }

  const conversions = existingConversions as unknown as UnitConversion[]
  if (findConversionFactor(fromUnitId, toUnitId, conversions) !== null) {
    return { ok: false, error: 'A conversion path already exists between these units', status: 400 }
  }

  const { data, error } = await table(supabase, 'unit_conversions')
    .insert({
      business_id: businessId,
      from_unit_id: fromUnitId,
      to_unit_id: toUnitId,
      factor,
    })
    .select('*')
    .single()

  if (error || !data) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: 'A direct conversion between these units already exists', status: 400 }
    }
    console.error('[unit-conversions:create] insert failed', error)
    return { ok: false, error: 'Could not create the conversion. Please try again.', status: 500 }
  }

  return { ok: true, data: data as unknown as UnitConversion }
}

export async function deleteConversion(
  supabase: ServiceClient,
  businessId: string,
  id: string
): Promise<ServiceResult<null>> {
  const { data: existing, error: fetchError } = await table(supabase, 'unit_conversions')
    .select('id, business_id')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) {
    console.error('[unit-conversions:delete] fetch failed', fetchError)
    return { ok: false, error: 'Could not delete the conversion. Please try again.', status: 500 }
  }
  if (!existing || existing.business_id !== businessId) {
    return { ok: false, error: 'Conversion not found', status: 404 }
  }

  const { error } = await table(supabase, 'unit_conversions')
    .delete()
    .eq('business_id', businessId)
    .eq('id', id)

  if (error) {
    console.error('[unit-conversions:delete] delete failed', error)
    return { ok: false, error: 'Could not delete the conversion. Please try again.', status: 500 }
  }

  return { ok: true, data: null }
}
