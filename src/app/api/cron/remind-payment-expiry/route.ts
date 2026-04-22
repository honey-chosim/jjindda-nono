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

  // SMS #4: use Phase 1 RPC that already checks payment_expires_at window + dedup via sms_notifications
  const { data: rows, error } = await supabase.rpc('list_pending_payment_reminders')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let sent = 0
  for (const row of (rows ?? []) as { match_id: string; payer_id: string; payer_phone: string; other_name: string; payment_expires_at: string }[]) {
    const ok = await notifyUser({
      userId: row.payer_id,
      templateKey: 'payment_expiry_reminder',
      referenceId: row.match_id,
      vars: { target_name: row.other_name, match_id: row.match_id },
    }).then(() => true).catch(() => false)
    if (ok) sent++
  }

  return NextResponse.json({ checked: rows?.length ?? 0, sent })
}

export const GET = handler
export const POST = handler
