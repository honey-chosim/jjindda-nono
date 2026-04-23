import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

/**
 * "그냥 내가 결제하고 연락하기!" — 비결제자가 결제 주체를 본인으로 swap.
 * 정책: payment_status='pending'인 동안만 가능. paid/expired/pending_confirmation 후에는 거부.
 * payment_expires_at은 새로 24h 부여.
 */
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { matchId } = await req.json()
  if (!matchId) return NextResponse.json({ error: 'matchId required' }, { status: 400 })

  const admin = getAdminClient()
  const { data: match, error: fetchErr } = await admin
    .from('matches')
    .select('id, user1_id, user2_id, payer_id, payment_status')
    .eq('id', matchId)
    .single()

  if (fetchErr || !match) return NextResponse.json({ error: '매칭을 찾을 수 없습니다' }, { status: 404 })
  if (match.user1_id !== user.id && match.user2_id !== user.id) {
    return NextResponse.json({ error: '본인 매칭이 아닙니다' }, { status: 403 })
  }
  if (match.payer_id === user.id) {
    return NextResponse.json({ error: '이미 본인이 결제자입니다' }, { status: 409 })
  }
  if (match.payment_status !== 'pending') {
    return NextResponse.json({ error: '이미 결제가 진행 중이거나 종료된 매칭입니다' }, { status: 409 })
  }

  const newExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  const { error: updErr } = await admin
    .from('matches')
    .update({ payer_id: user.id, payment_expires_at: newExpiry })
    .eq('id', matchId)

  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
