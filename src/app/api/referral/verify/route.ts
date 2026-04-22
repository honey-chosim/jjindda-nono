import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase'
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
  const supabase = getSupabaseClient()
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

  // verify_referral_profile RPC 호출 (profiles + referral_verifications 업데이트)
  const { error: rpcErr } = await admin.rpc('verify_referral_profile', {
    p_invitee_id: inviteeId,
    p_approved: approved,
    p_note: note ?? null,
  })
  if (rpcErr) return NextResponse.json({ error: rpcErr.message }, { status: 500 })

  // 승인된 경우 양쪽 검증 완료됐는지 체크 → SMS 발송
  if (approved) {
    const { data: profile } = await admin
      .from('profiles')
      .select('is_verified, verified_by_referrer')
      .eq('id', inviteeId)
      .single()

    if (profile?.is_verified && profile?.verified_by_referrer) {
      notifyUser({
        userId: inviteeId,
        templateKey: 'profile_approved',
        referenceId: inviteeId,
        vars: {},
      }).catch(console.error)
    }
  } else {
    // 친구가 거절로 돌리면 기존 승인 SMS 이력 삭제 → 재승인 시 재발송 가능
    await admin
      .from('sms_notifications')
      .delete()
      .eq('user_id', inviteeId)
      .eq('template_key', 'profile_approved')
      .eq('reference_id', inviteeId)
  }

  return NextResponse.json({ ok: true })
}
