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

  // SMS #8: invite_codes that were recently used, where referrer hasn't received a signup SMS yet.
  // Check sms_notifications for dedup (template_key='referral_signup', reference_id=invite_code.id).
  const { data: codes, error } = await supabase
    .from('invite_codes')
    .select(`
      id,
      created_by,
      used_by,
      referrer:profiles!invite_codes_created_by_fkey(id, name),
      invitee:profiles!invite_codes_used_by_fkey(id, name)
    `)
    .not('used_by', 'is', null)
    .not('created_by', 'is', null)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let sent = 0
  for (const code of (codes ?? [])) {
    const referrer = (code.referrer as unknown as { id: string; name: string } | null)
    const invitee = (code.invitee as unknown as { id: string; name: string } | null)
    if (!referrer || !invitee || !code.created_by) continue

    // notifyUser handles dedup via sms_notifications (reference_id = invite code id)
    const ok = await notifyUser({
      userId: referrer.id,
      templateKey: 'referral_signup',
      referenceId: code.id,
      vars: { friend_name: invitee.name, new_user_id: invitee.id },
    }).then(() => true).catch(() => false)
    if (ok) sent++
  }

  return NextResponse.json({ checked: codes?.length ?? 0, sent })
}

export const GET = handler
export const POST = handler
