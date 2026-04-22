import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { notifyUser } from '@/services/notificationService'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

async function handler(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getAdminClient()

  // SMS #2: pending requests with expires_at between now+0h and now+1h (i.e., 23h elapsed)
  const { data: rows, error } = await supabase
    .from('dating_requests')
    .select(`
      id,
      target_id,
      expires_at,
      requester:profiles!dating_requests_requester_id_fkey(name)
    `)
    .eq('status', 'pending')
    .gte('expires_at', new Date().toISOString())
    .lte('expires_at', new Date(Date.now() + 60 * 60 * 1000).toISOString())

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let sent = 0
  for (const row of (rows ?? [])) {
    const requesterName = (row.requester as unknown as { name: string } | null)?.name ?? '상대방'
    const ok = await notifyUser({
      userId: row.target_id,
      templateKey: 'request_expiry_reminder',
      referenceId: row.id,
      vars: { requester_name: requesterName, request_id: row.id },
    }).then(() => true).catch(() => false)
    if (ok) sent++
  }

  return NextResponse.json({ checked: rows?.length ?? 0, sent })
}

export const GET = handler
export const POST = handler
