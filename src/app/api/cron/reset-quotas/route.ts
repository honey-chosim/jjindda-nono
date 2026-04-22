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

/** KST 기준 오늘 08:00 UTC timestamp */
function kstTodayReset() {
  const now = new Date()
  const kst = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const kstDate = kst.getDate()
  const kstMonth = kst.getMonth()
  const kstYear = kst.getFullYear()
  return new Date(Date.UTC(kstYear, kstMonth, kstDate, 8 - 9, 0, 0)).toISOString()
}

async function handler(req: NextRequest) {
  const secret = req.headers.get('x-cron-secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = getAdminClient()
  const resetStart = kstTodayReset()

  // SMS #11: active opt-in users that haven't received daily_quota_reset today
  const { data: users, error } = await supabase
    .from('profiles')
    .select('id')
    .eq('is_active', true)
    .eq('onboarding_completed', true)
    .eq('marketing_sms', true)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Exclude users who already got the SMS since today's reset time
  const userIds = (users ?? []).map((u) => u.id)
  if (userIds.length === 0) return NextResponse.json({ notified: 0, sent: 0 })

  const { data: alreadySent } = await supabase
    .from('sms_notifications')
    .select('user_id')
    .in('user_id', userIds)
    .eq('template_key', 'daily_quota_reset')
    .eq('status', 'sent')
    .gte('sent_at', resetStart)

  const alreadySentSet = new Set((alreadySent ?? []).map((r) => r.user_id))
  const toNotify = userIds.filter((id) => !alreadySentSet.has(id))

  let sent = 0
  for (const userId of toNotify) {
    const ok = await notifyUser({
      userId,
      templateKey: 'daily_quota_reset',
      vars: {},
    }).then(() => true).catch(() => false)
    if (ok) sent++
  }

  return NextResponse.json({ notified: toNotify.length, sent })
}

export const GET = handler
export const POST = handler
