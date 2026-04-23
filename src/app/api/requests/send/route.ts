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

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { targetId } = await req.json()
  if (!targetId) return NextResponse.json({ error: 'targetId required' }, { status: 400 })

  // Call RPC via session-bound supabase (auth.uid() check inside RPC requires user JWT).
  // Use untyped raw client — postgrest-js v2 typed `.rpc()` resolves Args → undefined.
  const rawSupabase = await createRawServerSupabaseClient()
  const { data: requestId, error: rpcError } = await rawSupabase.rpc('send_dating_request', {
    p_requester_id: user.id,
    p_target_id: targetId,
  })
  if (rpcError) {
    const code = (rpcError as { code?: string }).code
    if (code === 'P0001') return NextResponse.json({ error: '동시 요청 최대 3개를 넘을 수 없어요.' }, { status: 409 })
    if (code === 'P0002') return NextResponse.json({ error: '오늘의 요청권을 모두 사용했어요. 내일 오전 8시에 초기화돼요.' }, { status: 409 })
    if (code === '23505') return NextResponse.json({ error: '이미 이 사람에게 보낸 요청이 있어요.' }, { status: 409 })
    return NextResponse.json({ error: rpcError.message }, { status: 500 })
  }

  // SMS #1: notify B (target) about incoming request
  const admin = getAdminClient()
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, name')
    .in('id', [user.id, targetId])

  const requesterName = profiles?.find((p) => p.id === user.id)?.name ?? '상대방'

  try {
    await notifyUser({
      userId: targetId,
      templateKey: 'request_received',
      referenceId: requestId,
      vars: { requester_name: requesterName, request_id: requestId },
    })
  } catch (e) {
    console.error('request_received SMS failed:', e)
  }

  return NextResponse.json({ requestId })
}
