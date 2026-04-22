import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { notifyUser } from '@/services/notificationService'
import type { DatingRequest } from '@/types/database'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  const supabase = getSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { requestId } = await req.json()
  if (!requestId) return NextResponse.json({ error: 'requestId required' }, { status: 400 })

  const admin = getAdminClient()

  // Accept the request (target_id must match current user)
  const { data: request, error: reqError } = await admin
    .from('dating_requests')
    .update({ status: 'accepted' })
    .eq('id', requestId)
    .eq('target_id', user.id)
    .select()
    .single()

  if (reqError) return NextResponse.json({ error: reqError.message }, { status: 500 })

  const req2 = request as DatingRequest

  // Create match
  const { data: match, error: matchError } = await admin
    .from('matches')
    .upsert({
      request_id: requestId,
      user1_id: req2.requester_id,
      user2_id: req2.target_id,
    }, { onConflict: 'request_id', ignoreDuplicates: true })
    .select()
    .single()

  if (matchError) return NextResponse.json({ error: matchError.message }, { status: 500 })

  // Fetch names for notification vars
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, name')
    .in('id', [req2.requester_id, req2.target_id])

  const requesterProfile = profiles?.find((p) => p.id === req2.requester_id)
  const targetProfile = profiles?.find((p) => p.id === req2.target_id)

  // Fire notifications without blocking response
  const matchId = match?.id ?? requestId
  Promise.all([
    notifyUser({
      userId: req2.requester_id,
      templateKey: 'match_accepted',
      referenceId: matchId,
      vars: { target_name: targetProfile?.name ?? '상대방', match_id: matchId },
    }),
    notifyUser({
      userId: req2.target_id,
      templateKey: 'request_received',
      referenceId: requestId,
      vars: { requester_name: requesterProfile?.name ?? '상대방' },
    }),
  ]).catch(console.error)

  return NextResponse.json({ matchId })
}
