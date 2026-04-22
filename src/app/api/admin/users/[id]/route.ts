import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { notifyUser } from '@/services/notificationService'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function checkAuth() {
  const cookieStore = await cookies()
  return cookieStore.get('admin_session')?.value === 'authenticated'
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkAuth())) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const supabaseAdmin = getAdminClient()

  // 양쪽 검증(운영진 + 친구) 모두 완료 시 profile_approved SMS 1회 발송.
  // sms_notifications 중복방지(reference_id=userId)로 한 번만 발송됨.
  async function maybeNotifyFullyVerified(userId: string) {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('is_verified, verified_by_referrer')
      .eq('id', userId)
      .single()
    if (data?.is_verified && data?.verified_by_referrer) {
      notifyUser({
        userId,
        templateKey: 'profile_approved',
        referenceId: userId,
        vars: {},
      }).catch(console.error)
    }
  }

  if ('approved' in body) {
    const { approved, note } = body as { approved: boolean; note?: string }
    const trimmedNote = note?.trim() ?? ''

    // 운영진 최종 승인/거절: is_verified + rejection_reason 직접 업데이트
    // rejection_reason sentinel: null = 검토 대기, '' = 거절(사유 없음), 'text' = 거절(사유 있음)
    const update = approved
      ? { is_verified: true, rejection_reason: null }
      : { is_verified: false, rejection_reason: trimmedNote }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(update)
      .eq('id', id)
      .select('*')
      .single()
    if (error) return Response.json({ error: error.message }, { status: 500 })

    if (approved) {
      // 양쪽 검증 완료 시에만 SMS 발송
      await maybeNotifyFullyVerified(id)
    } else {
      // 거절 SMS는 즉시 발송
      notifyUser({
        userId: id,
        templateKey: 'profile_rejected',
        referenceId: id,
        vars: trimmedNote ? { reason: trimmedNote } : {},
      }).catch(console.error)
    }

    return Response.json(data)
  }

  // 친구 검증 — 어드민이 대신 처리
  if ('friend_approved' in body) {
    const { friend_approved } = body as { friend_approved: boolean }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update({ verified_by_referrer: friend_approved })
      .eq('id', id)
      .select('*')
      .single()
    if (error) return Response.json({ error: error.message }, { status: 500 })

    if (friend_approved) {
      await maybeNotifyFullyVerified(id)
    }

    return Response.json(data)
  }

  const { is_active } = body
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ is_active })
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
