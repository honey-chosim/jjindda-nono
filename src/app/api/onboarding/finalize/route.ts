import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerSupabaseClient } from '@/lib/supabase-server'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// 프로필 생성 + invite_codes.used_by 업데이트를 단일 트랜잭션으로 실행.
// 시행착오: 브라우저에서 createProfile() + consumeInviteCode() 두 번 호출하면
// 두 번째가 실패할 때 invite_code 추적이 누락됨. profiles에 invite_code_used /
// referrer_id 컬럼을 추가해서 source-of-truth를 옮기고, 둘을 RPC로 묶어 atomic
// 으로 처리한다.
export async function POST(request: NextRequest) {
  const supabaseAuth = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
  if (authError || !user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { profile?: Record<string, unknown>; inviteCode?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: '잘못된 요청입니다' }, { status: 400 })
  }

  const profile = body.profile
  const inviteCodeRaw = body.inviteCode
  if (!profile || typeof profile !== 'object') {
    return Response.json({ error: '프로필 정보가 없습니다' }, { status: 400 })
  }

  const inviteCode = (inviteCodeRaw ?? '').toUpperCase().trim()
  if (inviteCode.length !== 8) {
    return Response.json({ error: '유효하지 않은 초대 코드입니다' }, { status: 400 })
  }

  const supabaseAdmin = getAdminClient()

  // 본인 id 강제 (클라이언트가 다른 user.id 보낸다 한들 무시)
  const profilePayload = { ...profile, id: user.id }

  const { data, error } = await supabaseAdmin.rpc('finalize_onboarding', {
    p_user_id: user.id,
    p_invite_code: inviteCode,
    p_profile: profilePayload,
  })

  if (error) {
    console.error('finalize_onboarding RPC error:', error)
    if (error.code === 'P0002') {
      return Response.json(
        { error: '유효하지 않거나 이미 사용된 코드입니다' },
        { status: 400 }
      )
    }
    if (error.code === 'P0001') {
      return Response.json({ error: '유효하지 않은 초대 코드입니다' }, { status: 400 })
    }
    if (error.code === '23505') {
      return Response.json({ error: '이미 프로필이 존재합니다' }, { status: 409 })
    }
    return Response.json(
      { error: error.message ?? '프로필 저장에 실패했습니다' },
      { status: 500 }
    )
  }

  return Response.json({ ok: true, profileId: data ?? user.id })
}
