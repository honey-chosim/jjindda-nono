import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(_request: NextRequest) {
  const cookieStore = await cookies()
  if (cookieStore.get('admin_session')?.value !== 'authenticated') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = getAdminClient()
  const { data: profiles, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  // 각 유저가 사용한 초대코드 + 레퍼럴(created_by 프로필) 정보 병합
  type InviteRow = {
    code: string
    label: string | null
    used_by: string | null
    created_by: string | null
    referrer: { id: string; name: string; real_name: string | null } | null
  }

  const userIds = (profiles ?? []).map((p) => p.id)
  const { data: invites } = userIds.length > 0
    ? await supabaseAdmin
        .from('invite_codes')
        .select('code, label, used_by, created_by, referrer:profiles!invite_codes_created_by_fkey(id, name, real_name)')
        .in('used_by', userIds)
    : { data: [] }

  const inviteMap = new Map<string, InviteRow>()
  for (const row of ((invites ?? []) as unknown as InviteRow[])) {
    if (row.used_by) inviteMap.set(row.used_by, row)
  }

  const result = (profiles ?? []).map((p) => ({
    ...p,
    invite: inviteMap.get(p.id) ?? null,
  }))

  return Response.json(result)
}
