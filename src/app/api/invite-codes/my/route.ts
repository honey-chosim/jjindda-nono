import { NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function getAuthUser(request: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// GET: 내 활성 초대코드 (보통 1개). 재사용 가능한 코드라 한 행이 여러 invitee 에게 공유됨.
//      비활성(이미 rotate 된) 코드는 referral history 보존을 위해 유지하지만 응답에는 포함 X.
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('invite_codes')
    .select('*')
    .eq('created_by', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

// POST: 코드 재발급 — 기존 활성 코드를 모두 비활성화하고 새 코드 발급.
//       기존 invite_codes 행은 절대 DELETE 하지 않는다 (referral history 보존).
//       profiles.invite_code_used / profiles.referrer_id 는 그대로 유지되므로
//       "내가 초대한 친구" 리스트는 깨지지 않는다.
export async function POST(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // 1. 본인의 모든 활성 코드를 비활성화 (history 보존을 위해 row 는 남김)
  const { error: deactivateErr } = await supabaseAdmin
    .from('invite_codes')
    .update({ is_active: false })
    .eq('created_by', user.id)
    .eq('is_active', true)

  if (deactivateErr) return Response.json({ error: deactivateErr.message }, { status: 500 })

  // 2. 새 8자 코드 발급
  const code = generateCode()
  const { data, error } = await supabaseAdmin
    .from('invite_codes')
    .insert({ code, created_by: user.id, is_active: true })
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}
