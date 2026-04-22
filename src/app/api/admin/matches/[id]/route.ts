import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import type { PaymentStatus } from '@/types/database'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// Whitelist: which transitions are allowed for admin PATCH
const ALLOWED: Record<PaymentStatus, PaymentStatus[]> = {
  pending: ['pending_confirmation', 'paid', 'expired'],
  pending_confirmation: ['pending', 'paid', 'expired'], // pending ↩ allows admin to reject user's claim
  paid: [],           // terminal — no reverse transitions
  expired: [],        // terminal
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies()
  if (cookieStore.get('admin_session')?.value !== 'authenticated') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const supabaseAdmin = getAdminClient()

  // If payment_status is being updated, validate the transition + route through RPC for paid
  if (body.payment_status !== undefined) {
    const nextStatus = body.payment_status as PaymentStatus

    const { data: current, error: fetchErr } = await supabaseAdmin
      .from('matches')
      .select('payment_status')
      .eq('id', id)
      .single()

    if (fetchErr || !current) {
      return Response.json({ error: 'Match not found' }, { status: 404 })
    }

    const currentStatus = current.payment_status as PaymentStatus
    const allowed = ALLOWED[currentStatus] ?? []
    if (!allowed.includes(nextStatus)) {
      return Response.json(
        { error: `Invalid transition: ${currentStatus} → ${nextStatus}` },
        { status: 400 }
      )
    }

    // Route 'paid' through the whitelisted RPC so paid_at + kakao_room_url get set
    if (nextStatus === 'paid') {
      const { error: rpcError } = await supabaseAdmin.rpc('admin_mark_payment_paid', {
        p_match_id: id,
        p_kakao_room_url: body.kakao_room_url ?? null,
      })
      if (rpcError) {
        return Response.json({ error: rpcError.message }, { status: 500 })
      }
    } else {
      // Simple enum transition
      const { error } = await supabaseAdmin
        .from('matches')
        .update({ payment_status: nextStatus })
        .eq('id', id)
      if (error) {
        return Response.json({ error: error.message }, { status: 500 })
      }
    }
  }

  // Separate update for kakao_group_created flag (independent of payment)
  if (body.kakao_group_created !== undefined) {
    const { error } = await supabaseAdmin
      .from('matches')
      .update({ kakao_group_created: body.kakao_group_created })
      .eq('id', id)
    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }
  }

  const { data: updated, error: readErr } = await supabaseAdmin
    .from('matches')
    .select('*')
    .eq('id', id)
    .single()

  if (readErr) {
    return Response.json({ error: readErr.message }, { status: 500 })
  }

  return Response.json(updated)
}
