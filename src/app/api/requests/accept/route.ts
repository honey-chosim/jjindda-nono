import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { notifyUser } from '@/services/notificationService'

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

  // Use Phase 1 RPC: validates status, grants receive-bonus quota, creates match atomically
  const { data: matchId, error: rpcError } = await admin
    .rpc('accept_dating_request', { p_request_id: requestId })

  if (rpcError) return NextResponse.json({ error: rpcError.message }, { status: 500 })

  // Fetch request + profiles for notification
  const { data: drRow } = await admin
    .from('dating_requests')
    .select('requester_id, target_id')
    .eq('id', requestId)
    .single()

  if (drRow) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, name')
      .in('id', [drRow.requester_id, drRow.target_id])

    const targetProfile = profiles?.find((p) => p.id === drRow.target_id)

    // Notify requester (A) that B accepted — SMS #3
    try {
      await notifyUser({
        userId: drRow.requester_id,
        templateKey: 'match_accepted',
        referenceId: matchId,
        vars: { target_name: targetProfile?.name ?? '상대방', match_id: matchId },
      })
    } catch (e) { console.error('match_accepted SMS failed:', e) }
  }

  return NextResponse.json({ matchId })
}
