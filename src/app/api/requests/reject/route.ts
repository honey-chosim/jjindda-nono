import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

/**
 * Reject a received dating request.
 *
 * Auth: session user must be the request's `target_id` (enforced by the WHERE clause).
 * Only `pending` requests can be rejected (no-op if already accepted/expired/rejected).
 *
 * SMS: per CLAUDE.md SMS policy, template #13 (rejection-to-requester) is FORBIDDEN.
 * Notification is in-app only — DO NOT send SMS here.
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { requestId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const requestId = body?.requestId
  if (!requestId || typeof requestId !== 'string') {
    return NextResponse.json({ error: 'requestId required' }, { status: 400 })
  }

  const admin = getAdminClient()

  // Only pending requests where THIS user is the target can be rejected.
  // Returning the row lets us distinguish "no row matched" (forbidden / wrong state)
  // from "updated successfully".
  const { data: updated, error: updErr } = await admin
    .from('dating_requests')
    .update({ status: 'rejected' })
    .eq('id', requestId)
    .eq('target_id', user.id)
    .eq('status', 'pending')
    .select('id')

  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  if (!updated || updated.length === 0) {
    // Either request doesn't exist, isn't owned by this user, or isn't pending.
    return NextResponse.json(
      { error: 'Request not found, not yours, or no longer pending' },
      { status: 404 }
    )
  }

  // No SMS — rejection notification is in-app only (template #13 forbidden).
  return NextResponse.json({ ok: true })
}
