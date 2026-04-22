import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { notifyUser } from '@/services/notificationService'

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

export async function GET() {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = getAdminClient()
  const { data, error } = await supabase
    .from('referral_payouts')
    .select('*, user:profiles!referral_payouts_user_id_fkey(id, name, phone)')
    .order('requested_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

const ALLOWED: Record<string, string[]> = {
  pending: ['approved', 'rejected'],
  approved: ['paid'],
  paid: [],
  rejected: [],
}

export async function PATCH(req: NextRequest) {
  if (!(await checkAuth())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, status, admin_note } = await req.json()
  if (!id || !status) return NextResponse.json({ error: 'id and status required' }, { status: 400 })

  const supabase = getAdminClient()

  const { data: current, error: fetchErr } = await supabase
    .from('referral_payouts')
    .select('status')
    .eq('id', id)
    .single()

  if (fetchErr || !current) return NextResponse.json({ error: 'Payout not found' }, { status: 404 })

  const allowed = ALLOWED[current.status] ?? []
  if (!allowed.includes(status)) {
    return NextResponse.json(
      { error: `Invalid transition: ${current.status} → ${status}` },
      { status: 400 }
    )
  }

  const { data, error } = await supabase
    .from('referral_payouts')
    .update({ status, admin_note: admin_note ?? null, processed_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (status === 'paid' && data) {
    notifyUser({
      userId: data.user_id,
      templateKey: 'referral_payout_paid',
      referenceId: id,
      vars: { amount: data.amount_requested },
    }).catch(console.error)
  }

  return NextResponse.json(data)
}
