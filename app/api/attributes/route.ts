import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessId } from '@/lib/supabase/session'
import { asTrimmedString, createAttribute, listAttributes } from '@/lib/services/attributes'

interface CreateAttributeBody {
  name?: unknown
}

export async function GET() {
  const businessId = await getCurrentBusinessId()
  if (!businessId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()

  try {
    const result = await listAttributes(supabase, businessId)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ data: result.data })
  } catch (err) {
    console.error('[attributes:list] unexpected error', err)
    return NextResponse.json({ error: 'Could not load attributes. Please try again.' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const businessId = await getCurrentBusinessId()
  if (!businessId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: CreateAttributeBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const name = asTrimmedString(body.name)
  if (!name) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })

  const supabase = await createClient()

  try {
    const result = await createAttribute(supabase, businessId, name)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ data: result.data })
  } catch (err) {
    console.error('[attributes:create] unexpected error', err)
    return NextResponse.json({ error: 'Could not create attribute. Please try again.' }, { status: 500 })
  }
}
