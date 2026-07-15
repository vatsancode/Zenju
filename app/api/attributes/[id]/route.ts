import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessId } from '@/lib/supabase/session'
import { asTrimmedString, deleteAttribute, renameAttribute } from '@/lib/services/attributes'

interface PatchAttributeBody {
  name?: unknown
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const businessId = await getCurrentBusinessId()
  if (!businessId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: PatchAttributeBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const name = asTrimmedString(body.name)
  if (!name) return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 })

  const supabase = await createClient()

  try {
    const result = await renameAttribute(supabase, businessId, params.id, name)
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({ data: result.data })
  } catch (err) {
    console.error('[attributes:update] unexpected error', params.id, err)
    return NextResponse.json({ error: 'Could not update the attribute. Please try again.' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const businessId = await getCurrentBusinessId()
  if (!businessId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()

  try {
    const result = await deleteAttribute(supabase, businessId, params.id)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ data: result.data })
  } catch (err) {
    console.error('[attributes:delete] unexpected error', params.id, err)
    return NextResponse.json({ error: 'Could not delete the attribute. Please try again.' }, { status: 500 })
  }
}
