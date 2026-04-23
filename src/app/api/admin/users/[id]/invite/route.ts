import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

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

// 레거시 유저(invite_code_used / referrer_id 누락)를 어드민이 수동 보정.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkAuth())) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const { inviteCodeUsed, referrerId } = body as {
    inviteCodeUsed?: string | null
    referrerId?: string | null
  }

  const update: Record<string, unknown> = {}

  if (inviteCodeUsed !== undefined) {
    if (inviteCodeUsed === null || inviteCodeUsed === '') {
      update.invite_code_used = null
    } else {
      const code = String(inviteCodeUsed).toUpperCase().trim()
      if (code.length !== 8) {
        return Response.json(
          { error: '초대 코드는 8자입니다' },
          { status: 400 }
        )
      }
      update.invite_code_used = code
    }
  }

  if (referrerId !== undefined) {
    update.referrer_id = referrerId === '' ? null : referrerId
  }

  if (Object.keys(update).length === 0) {
    return Response.json({ error: '변경할 필드가 없습니다' }, { status: 400 })
  }

  const supabaseAdmin = getAdminClient()
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update(update)
    .eq('id', id)
    .select('*')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
