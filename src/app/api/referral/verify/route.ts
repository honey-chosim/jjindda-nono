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

  const { inviteeId, approved, note } = await req.json() as {
    inviteeId: string; approved: boolean; note?: string
  }

  // 권한: invite_codes에서 내가 초대한 invitee인지 확인
  const admin = getAdminClient()
  const { data: invite } = await admin
    .from('invite_codes')
    .select('id')
    .eq('created_by', user.id)
    .eq('used_by', inviteeId)
    .maybeSingle()

  if (!invite) return NextResponse.json({ error: 'Not your invitee' }, { status: 403 })

  // verify_referral_profile RPC 호출 — 내부에서 auth.uid() == invite_codes.created_by 체크.
  // 세션 supabase로 호출해야 JWT가 전달됨 (admin/service_role 은 auth.uid()=NULL → 42501).
  // 단, postgrest-js v2 quirk 때문에 typed client 의 `Returns: void` RPC 는 Args 가 undefined 로
  // resolve 됨 → 빌드 실패. 따라서 untyped raw 세션 client 사용.
  void supabase
  const rawSupabase = await createRawServerSupabaseClient()
  const { error: rpcErr } = await rawSupabase.rpc('verify_referral_profile', {
    p_invitee_id: inviteeId,
    p_approved: approved,
    p_note: note ?? null,
  })
  if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 500 })

  // 이력 정리: 승인 시 둘 다 삭제(새 라운드), 거절 시 승인만 삭제(거절 dedup 유지)
  const keysToClear = approved
    ? ['profile_approved', 'profile_rejected']
    : ['profile_approved']
  await admin
    .from('sms_notifications')
    .delete()
    .eq('user_id', inviteeId)
    .in('template_key', keysToClear)
    .eq('reference_id', inviteeId)

  if (approved) {
    // 양쪽 검증 완료됐는지 체크 → SMS 발송
    const { data: profile } = await admin
      .from('profiles')
      .select('is_verified, verified_by_referrer')
      .eq('id', inviteeId)
      .single()

    if (profile?.is_verified && profile?.verified_by_referrer) {
      try {
        await notifyUser({
          userId: inviteeId,
          templateKey: 'profile_approved',
          referenceId: inviteeId,
          vars: {},
        })
      } catch (e) { console.error('profile_approved SMS failed:', e) }
    }
  } else {
    // 친구 거절 시 SMS 발송 (#7)
    try {
      await notifyUser({
        userId: inviteeId,
        templateKey: 'profile_rejected',
        referenceId: inviteeId,
        vars: note ? { reason: note } : {},
      })
    } catch (e) { console.error('profile_rejected SMS (friend) failed:', e) }
  }

  return NextResponse.json({ ok: true })
}
