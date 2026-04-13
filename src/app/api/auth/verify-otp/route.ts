import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { phone, code } = await req.json()
  const digits = phone.replace(/[-\s]/g, '')

  // 1. Verify OTP
  const { data: otpRow, error: fetchError } = await supabaseAdmin
    .from('phone_otps')
    .select('code, expires_at')
    .eq('phone', digits)
    .single()

  if (fetchError || !otpRow) {
    return NextResponse.json({ error: '인증번호를 먼저 요청해주세요' }, { status: 400 })
  }
  if (new Date(otpRow.expires_at) < new Date()) {
    return NextResponse.json({ error: '인증번호가 만료됐습니다. 다시 요청해주세요' }, { status: 400 })
  }
  if (otpRow.code !== code) {
    return NextResponse.json({ error: '인증번호가 올바르지 않습니다' }, { status: 400 })
  }

  // 2. Consume OTP
  await supabaseAdmin.from('phone_otps').delete().eq('phone', digits)

  // 3. Find or create user — phone stored as synthetic email
  const syntheticEmail = `${digits}@jjinda.nono`

  // Check profiles table first (fastest lookup, no full user list scan)
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('phone', digits)
    .maybeSingle()

  let userId: string

  if (profile) {
    userId = profile.id
  } else {
    // New user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: syntheticEmail,
      email_confirm: true,
      user_metadata: { phone: digits },
    })
    if (createError || !newUser.user) {
      return NextResponse.json({ error: '계정 생성에 실패했습니다' }, { status: 500 })
    }
    userId = newUser.user.id
  }

  // 4. Generate sign-in token for this user
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink',
    email: syntheticEmail,
  })
  if (linkError || !linkData) {
    return NextResponse.json({ error: '세션 생성에 실패했습니다' }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    userId,
    tokenHash: linkData.properties.hashed_token,
  })
}
