import type { createClient } from '@/lib/supabase/server'
import { table } from '@/lib/supabase/server'
import type { Category } from '@/types/database'

type ServiceClient = Awaited<ReturnType<typeof createClient>>

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status: number }

export function asTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

// Postgres unique_violation. The app-level validateName() check below can
// still race — two requests that both read "no duplicate yet" before either
// has inserted (e.g. a slow request that looks stalled, prompting a second
// click/Enter) — so the DB-level unique index (migration 008) is the actual
// guarantee; this just turns its error into the same friendly message.
function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && (error as { code?: string }).code === '23505'
}

function duplicateNameError(parentId: string | null): string {
  return parentId === null
    ? 'A category with this name already exists'
    : 'A subcategory with this name already exists under this parent'
}

export interface CategoryWithCount extends Category {
  item_count: number
}

export async function listCategories(
  supabase: ServiceClient,
  businessId: string
): Promise<ServiceResult<CategoryWithCount[]>> {
  const { data, error } = await table(supabase, 'categories')
    .select('*')
    .eq('business_id', businessId)
    .order('display_order', { ascending: true })

  if (error) {
    console.error('[categories:list] fetch failed', error)
    return { ok: false, error: 'Could not load categories. Please try again.', status: 500 }
  }

  const categories = data as unknown as Category[]
  if (categories.length === 0) return { ok: true, data: [] }

  const [{ data: invRows, error: invError }, { data: catRows, error: catError }] = await Promise.all([
    table(supabase, 'inventory_items').select('category_id').eq('business_id', businessId).is('deleted_at', null),
    table(supabase, 'catalogue_items').select('category_id').eq('business_id', businessId).is('deleted_at', null),
  ])

  if (invError || catError) {
    console.error('[categories:list] fetch item counts failed', invError, catError)
    return { ok: false, error: 'Could not load categories. Please try again.', status: 500 }
  }

  const countByCategoryId = new Map<string, number>()
  for (const row of [...(invRows ?? []), ...(catRows ?? [])] as { category_id: string | null }[]) {
    if (!row.category_id) continue
    countByCategoryId.set(row.category_id, (countByCategoryId.get(row.category_id) ?? 0) + 1)
  }

  return {
    ok: true,
    data: categories.map(c => ({ ...c, item_count: countByCategoryId.get(c.id) ?? 0 })),
  }
}

async function validateName(
  supabase: ServiceClient,
  businessId: string,
  name: string,
  parentId: string | null,
  excludeId?: string
): Promise<string | null> {
  if (!name) return 'Name cannot be empty'
  if (name.length > 50) return 'Name must be under 50 characters'

  let query = table(supabase, 'categories')
    .select('id')
    .eq('business_id', businessId)
    .eq('is_archived', false)
    .ilike('name', name)

  query = parentId === null ? query.is('parent_id', null) : query.eq('parent_id', parentId)
  if (excludeId) query = query.neq('id', excludeId)

  const { data, error } = await query.maybeSingle()
  if (error) {
    console.error('[categories:validate-name] lookup failed', error)
    return 'Could not validate the category name. Please try again.'
  }
  if (data) return duplicateNameError(parentId)
  return null
}

export interface CreateCategoryInput {
  name: string
  parentId: string | null
}

export async function createCategory(
  supabase: ServiceClient,
  businessId: string,
  input: CreateCategoryInput
): Promise<ServiceResult<Category>> {
  const name = input.name.trim()
  const parentId = input.parentId

  if (parentId) {
    const { data: parent, error: parentError } = await table(supabase, 'categories')
      .select('id, parent_id, business_id')
      .eq('id', parentId)
      .maybeSingle()

    if (parentError) {
      console.error('[categories:create] fetch parent failed', parentError)
      return { ok: false, error: 'Could not create the category. Please try again.', status: 500 }
    }
    if (!parent || parent.business_id !== businessId) {
      return { ok: false, error: 'Parent category not found', status: 404 }
    }
    // Schema rule: only one level of nesting — a subcategory can't have children.
    if (parent.parent_id !== null) {
      return { ok: false, error: 'A subcategory cannot itself have subcategories', status: 400 }
    }
  }

  const nameError = await validateName(supabase, businessId, name, parentId)
  if (nameError) return { ok: false, error: nameError, status: 400 }

  let siblingQuery = table(supabase, 'categories')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', businessId)
  siblingQuery = parentId === null ? siblingQuery.is('parent_id', null) : siblingQuery.eq('parent_id', parentId)
  const { count, error: countError } = await siblingQuery

  if (countError) {
    console.error('[categories:create] sibling count failed', countError)
  }

  const { data, error } = await table(supabase, 'categories')
    .insert({
      business_id: businessId,
      name,
      parent_id: parentId,
      display_order: count ?? 0,
    })
    .select('*')
    .single()

  if (error || !data) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: duplicateNameError(parentId), status: 400 }
    }
    console.error('[categories:create] insert failed', error)
    return { ok: false, error: 'Could not create the category. Please try again.', status: 500 }
  }

  return { ok: true, data: data as unknown as Category }
}

export async function renameCategory(
  supabase: ServiceClient,
  businessId: string,
  id: string,
  name: string
): Promise<ServiceResult<Category>> {
  const trimmed = name.trim()

  const { data: existing, error: fetchError } = await table(supabase, 'categories')
    .select('id, parent_id, business_id')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) {
    console.error('[categories:rename] fetch failed', fetchError)
    return { ok: false, error: 'Could not rename the category. Please try again.', status: 500 }
  }
  if (!existing || existing.business_id !== businessId) {
    return { ok: false, error: 'Category not found', status: 404 }
  }

  const nameError = await validateName(supabase, businessId, trimmed, existing.parent_id, id)
  if (nameError) return { ok: false, error: nameError, status: 400 }

  const { data, error } = await table(supabase, 'categories')
    .update({ name: trimmed })
    .eq('id', id)
    .select('*')
    .single()

  if (error || !data) {
    if (isUniqueViolation(error)) {
      return { ok: false, error: duplicateNameError(existing.parent_id), status: 400 }
    }
    console.error('[categories:rename] update failed', error)
    return { ok: false, error: 'Could not rename the category. Please try again.', status: 500 }
  }

  return { ok: true, data: data as unknown as Category }
}

async function getUsageCount(supabase: ServiceClient, businessId: string, categoryId: string): Promise<number> {
  const [{ count: invCount }, { count: catCount }] = await Promise.all([
    table(supabase, 'inventory_items')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('category_id', categoryId)
      .is('deleted_at', null),
    table(supabase, 'catalogue_items')
      .select('id', { count: 'exact', head: true })
      .eq('business_id', businessId)
      .eq('category_id', categoryId)
      .is('deleted_at', null),
  ])

  return (invCount ?? 0) + (catCount ?? 0)
}

export interface CategoryUsage {
  totalItems: number
  childCount: number
}

export async function getCategoryUsage(
  supabase: ServiceClient,
  businessId: string,
  id: string
): Promise<ServiceResult<CategoryUsage>> {
  const { data: children, error: childError } = await table(supabase, 'categories')
    .select('id')
    .eq('business_id', businessId)
    .eq('parent_id', id)

  if (childError) {
    console.error('[categories:usage] fetch children failed', childError)
    return { ok: false, error: 'Could not check category usage. Please try again.', status: 500 }
  }

  const childIds = ((children ?? []) as { id: string }[]).map(c => c.id)
  const counts = await Promise.all(
    [id, ...childIds].map(categoryId => getUsageCount(supabase, businessId, categoryId))
  )
  const totalItems = counts.reduce((sum, n) => sum + n, 0)

  return { ok: true, data: { totalItems, childCount: childIds.length } }
}

export async function archiveCategory(
  supabase: ServiceClient,
  businessId: string,
  id: string,
  archived: boolean
): Promise<ServiceResult<null>> {
  const { data: existing, error: fetchError } = await table(supabase, 'categories')
    .select('id, parent_id, business_id')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) {
    console.error('[categories:archive] fetch failed', fetchError)
    return { ok: false, error: 'Could not update the category. Please try again.', status: 500 }
  }
  if (!existing || existing.business_id !== businessId) {
    return { ok: false, error: 'Category not found', status: 404 }
  }

  const idsToUpdate = [id]
  if (!archived && existing.parent_id) {
    // Restoring a subcategory also restores its parent, matching the UI's
    // assumption that a visible subcategory always has a visible parent.
    idsToUpdate.push(existing.parent_id)
  }
  if (archived || !existing.parent_id) {
    const { data: children } = await table(supabase, 'categories')
      .select('id')
      .eq('business_id', businessId)
      .eq('parent_id', id)
    idsToUpdate.push(...((children ?? []) as { id: string }[]).map(c => c.id))
  }

  const { error } = await table(supabase, 'categories')
    .update({ is_archived: archived })
    .in('id', idsToUpdate)
    .eq('business_id', businessId)

  if (error) {
    console.error('[categories:archive] update failed', error)
    return { ok: false, error: 'Could not update the category. Please try again.', status: 500 }
  }

  return { ok: true, data: null }
}

export async function deleteCategory(
  supabase: ServiceClient,
  businessId: string,
  id: string
): Promise<ServiceResult<null>> {
  const { data: existing, error: fetchError } = await table(supabase, 'categories')
    .select('id, business_id')
    .eq('id', id)
    .maybeSingle()

  if (fetchError) {
    console.error('[categories:delete] fetch failed', fetchError)
    return { ok: false, error: 'Could not delete the category. Please try again.', status: 500 }
  }
  if (!existing || existing.business_id !== businessId) {
    return { ok: false, error: 'Category not found', status: 404 }
  }

  const usage = await getCategoryUsage(supabase, businessId, id)
  if (usage.ok && usage.data.totalItems > 0) {
    return { ok: false, error: 'This category is in use and cannot be deleted — archive it instead', status: 409 }
  }

  const { data: children } = await table(supabase, 'categories')
    .select('id')
    .eq('business_id', businessId)
    .eq('parent_id', id)
  const idsToDelete = [id, ...((children ?? []) as { id: string }[]).map(c => c.id)]

  const { error } = await table(supabase, 'categories')
    .delete()
    .eq('business_id', businessId)
    .in('id', idsToDelete)

  if (error) {
    console.error('[categories:delete] delete failed', error)
    return { ok: false, error: 'Could not delete the category. Please try again.', status: 500 }
  }

  return { ok: true, data: null }
}
