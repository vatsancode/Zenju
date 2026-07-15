import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessId } from '@/lib/supabase/session'
import { deleteConversion } from '@/lib/services/unit-conversions'

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const businessId = await getCurrentBusinessId()
  if (!businessId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()

  try {
    const result = await deleteConversion(supabase, businessId, params.id)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ data: result.data })
  } catch (err) {
    console.error('[unit-conversions:delete] unexpected error', params.id, err)
    return NextResponse.json({ error: 'Could not delete the conversion. Please try again.' }, { status: 500 })
  }
}
