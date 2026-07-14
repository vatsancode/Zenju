import { NextResponse, type NextRequest } from 'next/server'
import { isCurrentUserAdmin } from '@/lib/supabase/admin'
import { createServiceClient } from '@/lib/supabase/server'
import { resetBusinessOwnerPassword } from '@/lib/services/businesses'

interface ResetPasswordBody {
  password?: unknown
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isCurrentUserAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: ResetPasswordBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const password = typeof body.password === 'string' ? body.password : ''
  if (password.length < 8) {
    return NextResponse.json({ error: 'Password must be at least 8 characters' }, { status: 400 })
  }

  // Service client bypasses RLS on purpose — this is the cross-tenant admin
  // action (resetting any business's owner password), gated by
  // isCurrentUserAdmin() above instead of per-business RLS.
  const supabase = await createServiceClient()

  try {
    const result = await resetBusinessOwnerPassword(supabase, params.id, password)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ data: result.data })
  } catch (err) {
    console.error('[businesses:reset-password] unexpected error', params.id, err)
    return NextResponse.json({ error: 'Could not reset the password. Please try again.' }, { status: 500 })
  }
}
