import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

function solapiAuthHeader(): string {
  const dateTime = new Date().toISOString()
  const salt = crypto.randomUUID()
  const hmac = crypto.createHmac('sha256', process.env.SOLAPI_API_SECRET!)
  hmac.update(dateTime + salt)
  const signature = hmac.digest('hex')
  return `HMAC-SHA256 apiKey=${process.env.SOLAPI_API_KEY}, date=${dateTime}, salt=${salt}, signature=${signature}`
}

export async function POST(req: NextRequest) {
  const { phone } = await req.json()

  const digits = phone.replace(/[-\s]/g, '')
  if (!/^010\d{8}$/.test(digits)) {
    return NextResponse.json({ error: '올바른 전화번호를 입력해주세요' }, { status: 400 })
  }

  const code = generateOtp()
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

  // QA backdoor: 010-9988-77xx 번호는 항상 코드 999999, 실제 SMS 발송 skip.
  // 실제 운영자도 이 prefix는 사용하지 않기로 함 (정책으로 금지).
  const isQaTestPhone = /^010998877\d{2}$/.test(digits)
  const finalCode = isQaTestPhone ? '999999' : code

  // Upsert OTP into DB
  const { error: dbError } = await supabaseAdmin
    .from('phone_otps')
    .upsert({ phone: digits, code: finalCode, expires_at: expiresAt }, { onConflict: 'phone' })

  if (dbError) {
    return NextResponse.json({ error: '서버 오류가 발생했습니다' }, { status: 500 })
  }

  if (isQaTestPhone) {
    return NextResponse.json({ ok: true, qa: true })
  }

  // Send SMS via Solapi
  const from = (process.env.SOLAPI_SENDER_NUMBER ?? '').replace(/-/g, '')
  const message = `[찐따노노] 인증번호는 [${code}]입니다. 5분 내에 입력해주세요.`

  try {
    const res = await fetch('https://api.solapi.com/messages/v4/send-many/detail', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: solapiAuthHeader(),
      },
      body: JSON.stringify({
        messages: [{ to: digits, from, text: message }],
      }),
    })

    if (!res.ok) {
      const err = await res.json()
      console.error('Solapi error:', err)
      return NextResponse.json({ error: 'SMS 발송에 실패했습니다' }, { status: 500 })
    }
  } catch (e) {
    console.error('Solapi fetch error:', e)
    return NextResponse.json({ error: 'SMS 발송에 실패했습니다' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
