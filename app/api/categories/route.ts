import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessId } from '@/lib/supabase/session'
import { asTrimmedString, createCategory, listCategories } from '@/lib/services/categories'

interface CreateCategoryBody {
  name?: unknown
  parent_id?: unknown
}

export async function GET() {
  const businessId = await getCurrentBusinessId()
  if (!businessId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()

  try {
    const result = await listCategories(supabase, businessId)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ data: result.data })
  } catch (err) {
    console.error('[categories:list] unexpected error', err)
    return NextResponse.json({ error: 'Could not load categories. Please try again.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const businessId = await getCurrentBusinessId()
  if (!businessId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: CreateCategoryBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const name = asTrimmedString(body.name)
  const parentId = typeof body.parent_id === 'string' && body.parent_id ? body.parent_id : null

  if (!name) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })

  const supabase = await createClient()

  try {
    const result = await createCategory(supabase, businessId, { name, parentId })
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ data: result.data })
  } catch (err) {
    console.error('[categories:create] unexpected error', err)
    return NextResponse.json({ error: 'Could not create category. Please try again.' }, { status: 500 })
  }
}
