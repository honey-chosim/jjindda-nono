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
  // notifyUser handles dedup via sms_notifications (reference_id = invite code id).
  //
  // NOTE: invite_codes.created_by / used_by reference auth.users (NOT profiles).
  // PostgREST embedded selects against `profiles!invite_codes_*_fkey` fail with PGRST200.
  // Use 2-step query (same pattern as referralService.getReferredUsersToVerify).

  // Step 1 — invite_codes that have been used by someone
  const { data: codes, error: codesErr } = await supabase
    .from('invite_codes')
    .select('id, created_by, used_by')
    .not('used_by', 'is', null)
    .not('created_by', 'is', null)

  if (codesErr) return NextResponse.json({ error: codesErr.message }, { status: 500 })

  const rows = (codes ?? []) as { id: string; created_by: string; used_by: string }[]
  if (rows.length === 0) return NextResponse.json({ checked: 0, sent: 0 })

  const profileIds = Array.from(
    new Set(rows.flatMap((r) => [r.created_by, r.used_by]).filter((id): id is string => !!id))
  )

  // Step 2 — fetch profiles. C11: filter out invitees with onboarding_completed=false (ghost signups).
  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('id, name, onboarding_completed')
    .in('id', profileIds)

  if (profErr) return NextResponse.json({ error: profErr.message }, { status: 500 })

  const profileMap = new Map(
    ((profiles ?? []) as { id: string; name: string; onboarding_completed: boolean }[]).map((p) => [p.id, p])
  )

  let sent = 0
  let skippedGhost = 0
  for (const code of rows) {
    const referrer = profileMap.get(code.created_by)
    const invitee = profileMap.get(code.used_by)
    if (!referrer || !invitee) continue

    // C11: skip ghost signups (invitee never finished onboarding)
    if (!invitee.onboarding_completed) {
      skippedGhost++
      continue
    }

    try {
      await notifyUser({
        userId: referrer.id,
        templateKey: 'referral_signup',
        referenceId: code.id,
        vars: { friend_name: invitee.name, new_user_id: invitee.id },
      })
      sent++
    } catch (e) {
      console.error('referral_signup SMS failed:', e)
    }
  }

  return NextResponse.json({ checked: rows.length, sent, skippedGhost })
}

export const GET = handler
export const POST = handler
