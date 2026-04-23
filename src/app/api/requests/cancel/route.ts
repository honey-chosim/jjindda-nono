import { NextRequest, NextResponse } from 'next/server'
import { createRawServerSupabaseClient } from '@/lib/supabase-server'

/**
 * Cancel a sent dating request.
 *
 * Auth: session user must be the request's `requester_id` (enforced by RPC's
 * `auth.uid()` check). Only `pending` requests can be cancelled — RPC enforces.
 *
 * Uses the untyped raw client to sidestep postgrest-js v2 quirk where `Returns: void`
 * resolves Args → undefined.
 *
 * SMS: per CLAUDE.md SMS policy #18, request cancellation has NO SMS — in-app only.
 */
export async function POST(req: NextRequest) {
  const supabase = await createRawServerSupabaseClient()
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

  // RPC requires auth.uid() == requester_id — must use session-bound supabase.
  const { error: rpcError } = await supabase.rpc('cancel_dating_request', {
    p_request_id: requestId,
  })

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 500 })
  }

  // No SMS — cancellation is in-app only.
  return NextResponse.json({ ok: true })
}
