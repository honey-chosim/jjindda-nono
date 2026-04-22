import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase'
import { createClient } from '@supabase/supabase-js'
import { sendDatingRequestV2 } from '@/services/requestService'
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

  const { targetId } = await req.json()
  if (!targetId) return NextResponse.json({ error: 'targetId required' }, { status: 400 })

  // Use V2 RPC — enforces 3-slot + quota policy
  const requestId = await sendDatingRequestV2(user.id, targetId)

  // SMS #1: notify B (target) about incoming request
  const admin = getAdminClient()
  const { data: profiles } = await admin
    .from('profiles')
    .select('id, name')
    .in('id', [user.id, targetId])

  const requesterName = profiles?.find((p) => p.id === user.id)?.name ?? '상대방'

  notifyUser({
    userId: targetId,
    templateKey: 'request_received',
    referenceId: requestId,
    vars: { requester_name: requesterName, request_id: requestId },
  }).catch(console.error)

  return NextResponse.json({ requestId })
}
