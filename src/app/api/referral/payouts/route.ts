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

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = getAdminClient()
  const [earningsRes, payoutsRes] = await Promise.all([
    admin.from('referral_earnings').select('amount, invitee_gender, paid_payout_id').eq('referrer_id', user.id),
    admin.from('referral_payouts').select('*').eq('user_id', user.id).order('requested_at', { ascending: false }),
  ])

  if (earningsRes.error) return NextResponse.json({ error: earningsRes.error.message }, { status: 500 })
  if (payoutsRes.error) return NextResponse.json({ error: payoutsRes.error.message }, { status: 500 })

  const rows = (earningsRes.data ?? []) as { amount: number; invitee_gender: string; paid_payout_id: string | null }[]
  let totalEarned = 0, paid = 0, countMale = 0, countFemale = 0
  for (const r of rows) {
    totalEarned += r.amount
    if (r.paid_payout_id) paid += r.amount
    if (r.invitee_gender === 'male') countMale++
    else countFemale++
  }

  return NextResponse.json({
    balance: { totalEarned, paid, pending: totalEarned - paid, countMale, countFemale },
    payouts: payoutsRes.data ?? [],
  })
}

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { amount, bankName, bankAccount, accountHolder } = await req.json()
  if (!amount || !bankName || !bankAccount || !accountHolder) {
    return NextResponse.json({ error: '필수 항목을 입력해주세요' }, { status: 400 })
  }

  const admin = getAdminClient()

  // Validate amount against actual pending balance
  const { data: earningsData, error: earningsErr } = await admin
    .from('referral_earnings')
    .select('amount, paid_payout_id')
    .eq('referrer_id', user.id)
  if (earningsErr) return NextResponse.json({ error: earningsErr.message }, { status: 500 })

  type EarningRow = { amount: number; paid_payout_id: string | null }
  const earnings = (earningsData ?? []) as EarningRow[]
  const totalEarned = earnings.reduce((s, r) => s + r.amount, 0)
  const paidOut = earnings.filter((r) => r.paid_payout_id).reduce((s, r) => s + r.amount, 0)
  const pending = totalEarned - paidOut

  if (amount > pending) {
    return NextResponse.json({ error: `출금 가능 금액(${pending.toLocaleString()}원)을 초과할 수 없습니다` }, { status: 400 })
  }

  const { data, error } = await admin
    .from('referral_payouts')
    .insert({ user_id: user.id, amount_requested: amount, bank_name: bankName, bank_account: bankAccount, account_holder: accountHolder })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
