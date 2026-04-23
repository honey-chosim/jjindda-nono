import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

function generateCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export async function GET(_request: NextRequest) {
  const cookieStore = await cookies()
  if (cookieStore.get('admin_session')?.value !== 'authenticated') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseAdmin = getAdminClient()
  // 시행착오 #5: invite_codes.created_by FK는 auth.users 참조라 profiles 임베드 불가 → 2-step 쿼리.
  const { data: codes, error } = await supabaseAdmin
    .from('invite_codes')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  type CodeRow = { created_by: string | null }
  const referrerIds = Array.from(
    new Set(((codes ?? []) as CodeRow[]).map((c) => c.created_by).filter((x): x is string => !!x))
  )

  let referrerMap: Record<string, { id: string; name: string; real_name: string | null }> = {}
  if (referrerIds.length > 0) {
    const { data: referrers } = await supabaseAdmin
      .from('profiles')
      .select('id, name, real_name')
      .in('id', referrerIds)
    referrerMap = Object.fromEntries(
      ((referrers ?? []) as { id: string; name: string; real_name: string | null }[]).map((p) => [p.id, p])
    )
  }

  const enriched = (codes ?? []).map((c) => ({
    ...c,
    referrer: c.created_by ? referrerMap[c.created_by] ?? null : null,
  }))

  return Response.json(enriched)
}

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  if (cookieStore.get('admin_session')?.value !== 'authenticated') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { count, label } = await request.json()
  const codeCount = Math.min(Math.max(1, count || 1), 20)

  const supabaseAdmin = getAdminClient()
  const codes = Array.from({ length: codeCount }, () => ({
    code: generateCode(),
    is_active: true,
    label: label?.trim() || null,
  }))

  const { data, error } = await supabaseAdmin
    .from('invite_codes')
    .insert(codes)
    .select()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json(data)
}
