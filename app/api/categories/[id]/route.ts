import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessId } from '@/lib/supabase/session'
import { archiveCategory, asTrimmedString, deleteCategory, renameCategory } from '@/lib/services/categories'

interface PatchCategoryBody {
  name?: unknown
  is_archived?: unknown
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const businessId = await getCurrentBusinessId()
  if (!businessId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: PatchCategoryBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const supabase = await createClient()

  try {
    if (typeof body.name === 'string') {
      const name = asTrimmedString(body.name)
      if (!name) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })
      const result = await renameCategory(supabase, businessId, params.id, name)
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
      return NextResponse.json({ data: result.data })
    }

    if (typeof body.is_archived === 'boolean') {
      const result = await archiveCategory(supabase, businessId, params.id, body.is_archived)
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
      return NextResponse.json({ data: result.data })
    }

    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  } catch (err) {
    console.error('[categories:update] unexpected error', params.id, err)
    return NextResponse.json({ error: 'Could not update the category. Please try again.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const businessId = await getCurrentBusinessId()
  if (!businessId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()

  try {
    const result = await deleteCategory(supabase, businessId, params.id)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ data: result.data })
  } catch (err) {
    console.error('[categories:delete] unexpected error', params.id, err)
    return NextResponse.json({ error: 'Could not delete the category. Please try again.' }, { status: 500 })
  }
}
