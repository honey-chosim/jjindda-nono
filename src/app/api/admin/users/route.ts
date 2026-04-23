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

  // 각 유저가 사용한 초대코드 + 레퍼럴(created_by 프로필) 정보 병합.
  //
  // NOTE: invite_codes.created_by/used_by reference auth.users — NOT profiles.
  // Embedded select `profiles!invite_codes_created_by_fkey(...)` fails with PGRST200.
  // Use 2-step query.

  type ReferrerProfile = { id: string; name: string; real_name: string | null }
  type InviteRow = {
    code: string
    label: string | null
    used_by: string | null
    created_by: string | null
    referrer: ReferrerProfile | null
  }

  const userIds = (profiles ?? []).map((p) => p.id)

  // Step 1 — fetch invite_codes for these users (no embedded join)
  const { data: rawInvites } = userIds.length > 0
    ? await supabaseAdmin
        .from('invite_codes')
        .select('code, label, used_by, created_by')
        .in('used_by', userIds)
    : { data: [] }

  const invites = (rawInvites ?? []) as Omit<InviteRow, 'referrer'>[]

  // Step 2 — fetch referrer profiles (created_by → profiles)
  const referrerIds = Array.from(
    new Set(invites.map((i) => i.created_by).filter((id): id is string => !!id))
  )

  const referrerMap = new Map<string, ReferrerProfile>()
  if (referrerIds.length > 0) {
    const { data: referrers } = await supabaseAdmin
      .from('profiles')
      .select('id, name, real_name')
      .in('id', referrerIds)
    for (const r of ((referrers ?? []) as ReferrerProfile[])) {
      referrerMap.set(r.id, r)
    }
  }

  const inviteMap = new Map<string, InviteRow>()
  for (const row of invites) {
    if (!row.used_by) continue
    inviteMap.set(row.used_by, {
      ...row,
      referrer: row.created_by ? referrerMap.get(row.created_by) ?? null : null,
    })
  }

  const result = (profiles ?? []).map((p) => ({
    ...p,
    invite: inviteMap.get(p.id) ?? null,
  }))

  return Response.json(result)
}
