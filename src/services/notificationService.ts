/**
 * 알림 발송 서비스 레이어 — 서버 전용.
 *
 * API routes / server actions에서만 import. `src/lib/sms.ts` 래퍼.
 */

import { sendSmsNotification, type SmsTemplateKey } from '@/lib/sms'
import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * userId를 받아 phone을 조회한 뒤 SMS 발송.
 * referenceId 동일하면 중복 스킵.
 */
export async function notifyUser(args: {
  userId: string
  templateKey: SmsTemplateKey
  referenceId?: string
  vars: Record<string, string | number | undefined>
  forceCritical?: boolean
}): Promise<void> {
  const supabase = getAdminClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('phone, marketing_sms')
    .eq('id', args.userId)
    .single()

  if (!profile?.phone) return

  // 광고성 알림은 opt-in 유저에게만
  const adOnly: SmsTemplateKey[] = ['daily_quota_reset', 'dormant_d7', 'dormant_d14', 'dormant_d30']
  if (adOnly.includes(args.templateKey) && !profile.marketing_sms) return

  await sendSmsNotification({
    userId: args.userId,
    templateKey: args.templateKey,
    referenceId: args.referenceId,
    vars: args.vars,
    phone: profile.phone,
    forceCritical: args.forceCritical,
  })
}
