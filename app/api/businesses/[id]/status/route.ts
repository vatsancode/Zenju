import { NextResponse, type NextRequest } from 'next/server'
import { isCurrentUserAdmin } from '@/lib/supabase/admin'
import { createServiceClient } from '@/lib/supabase/server'
import { setBusinessStatus, type BusinessStatus } from '@/lib/services/businesses'

interface SetStatusBody {
  status?: unknown
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: SetStatusBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const status = body.status
  if (status !== 'active' && status !== 'suspended') {
    return NextResponse.json({ error: "Status must be 'active' or 'suspended'" }, { status: 400 })
  }

  // Service client bypasses RLS on purpose — this is the cross-tenant admin
  // action (suspending/activating any business), gated by isCurrentUserAdmin()
  // above instead of per-business RLS.
  const supabase = await createServiceClient()

  try {
    const result = await setBusinessStatus(supabase, params.id, status as BusinessStatus)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ data: result.data })
  } catch (err) {
    console.error('[businesses:set-status] unexpected error', params.id, err)
    return NextResponse.json({ error: 'Could not update the business status. Please try again.' }, { status: 500 })
  }
}
