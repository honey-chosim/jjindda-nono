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

  if ('approved' in body) {
    const { approved, note } = body as { approved: boolean; note?: string }

    // 운영진 최종 승인/거절: is_verified + rejection_reason 직접 업데이트
    const update = approved
      ? { is_verified: true, rejection_reason: null }
      : { is_verified: false, rejection_reason: note ?? '운영진 검토 결과 미승인' }

    const { data, error } = await supabaseAdmin
      .from('profiles')
      .update(update)
      .eq('id', id)
      .select('*')
      .single()
    if (error) return Response.json({ error: error.message }, { status: 500 })

    notifyUser({
      userId: id,
      templateKey: approved ? 'profile_approved' : 'profile_rejected',
      referenceId: id,
      vars: { reason: note },
    }).catch(console.error)

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
