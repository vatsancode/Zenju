import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getCurrentBusinessId } from '@/lib/supabase/session'
import { listMovementsForVariant } from '@/lib/services/movements'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string; variantId: string } }
) {
  const businessId = await getCurrentBusinessId()
  if (!businessId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = await createClient()

  try {
    const result = await listMovementsForVariant(supabase, businessId, params.id, params.variantId)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ data: result.data })
  } catch (err) {
    console.error('[movements:list] unexpected error', params.variantId, err)
    return NextResponse.json({ error: 'Could not load consumption history. Please try again.' }, { status: 500 })
  }
}
