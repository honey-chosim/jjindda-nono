import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createRawServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'
import { notifyUser } from '@/services/notificationService'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

/**
 * "바로 수락하기" — target(B)이 자기가 결제 주체가 되어 즉시 수락.
 * instant_accept_match RPC 가 payer_id = target_id 로 match 생성 + 결제 타이머 시작.
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { requestId } = await req.json()
  if (!requestId) return NextResponse.json({ error: 'requestId required' }, { status: 400 })

  // RPC requires auth.uid() == target_id — must use session-bound supabase (JWT-carrying).
  // admin (service_role) has auth.uid()=NULL → 42501.
  // Use untyped raw client — postgrest-js v2 typed `.rpc()` resolves Args → undefined.
  const rawSupabase = await createRawServerSupabaseClient()
  const { data: matchId, error: rpcError } = await rawSupabase.rpc('instant_accept_match', {
    p_request_id: requestId,
  })

  if (rpcError) {
    const code = (rpcError as { code?: string }).code
    if (code === 'P0004') return NextResponse.json({ error: '이미 응답한 요청이에요.' }, { status: 409 })
    if (code === 'P0005') return NextResponse.json({ error: '만료된 요청이에요.' }, { status: 410 })
    return NextResponse.json({ error: rpcError.message }, { status: 500 })
  }

  // Admin client only for cross-user lookup + SMS dispatch.
  const admin = getAdminClient()

  // SMS #3 — requester(A)에게 "B가 수락했다" 알림
  const { data: drRow } = await admin
    .from('dating_requests')
    .select('requester_id, target_id')
    .eq('id', requestId)
    .single()

  if (drRow) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, name')
      .in('id', [drRow.requester_id, drRow.target_id])

    const targetProfile = profiles?.find((p) => p.id === drRow.target_id)

    try {
      await notifyUser({
        userId: drRow.requester_id,
        templateKey: 'match_accepted',
        referenceId: matchId,
        vars: { target_name: targetProfile?.name ?? '상대방', match_id: matchId },
      })
    } catch (e) { console.error('match_accepted SMS failed:', e) }
  }

  return NextResponse.json({ matchId })
}
