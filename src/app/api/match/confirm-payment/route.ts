import { NextRequest, NextResponse } from 'next/server'
import { createRawServerSupabaseClient } from '@/lib/supabase-server'

/**
 * 유저 "이체 완료 알리기" — pending → pending_confirmation 상태 전환.
 *
 * Auth: RPC `confirm_payment_transfer` requires `auth.uid() == matches.payer_id`.
 * Must use session-bound supabase (carries user JWT). admin (service_role) → auth.uid()=NULL → 42501.
 *
 * Uses the untyped raw client to sidestep postgrest-js v2 quirk where `Returns: void`
 * resolves Args → undefined.
 *
 * SMS: 결제 완료 (#5) 는 어드민이 paid 로 최종 확정할 때 발송 — 여기서는 발송 안 함.
 */
export async function POST(req: NextRequest) {
  const supabase = await createRawServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { matchId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const matchId = body?.matchId
  if (!matchId || typeof matchId !== 'string') {
    return NextResponse.json({ error: 'matchId required' }, { status: 400 })
  }

  const { error: rpcError } = await supabase.rpc('confirm_payment_transfer', {
    p_match_id: matchId,
  })

  if (rpcError) {
    return NextResponse.json({ error: rpcError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
