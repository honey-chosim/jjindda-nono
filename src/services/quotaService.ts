/**
 * 송신권 / 활성 슬롯 쿼터 — 실시간 계산 (08:00 KST 경계).
 *
 * 정책:
 *  - 동시 active 슬롯 최대 3 (송+수신 합산, pending + accepted-unpaid)
 *  - 일일 송신권 = 기본 1 + 오늘(08:00 KST~) 받은 요청 수
 *  - 쿼터는 실시간 계산. request_quotas 테이블은 opt-in SMS 대상 추적용.
 */

import { getRawSupabaseClient } from '@/lib/supabase'
import { MAX_ACTIVE_SLOTS, BASE_DAILY_SEND_QUOTA } from '@/lib/pricing'

export interface QuotaStatus {
  sentToday: number
  receivedToday: number
  activeSlotsUsed: number
  sendLimit: number
  remainingSend: number
  maxActiveSlots: number
}

/** KST 08:00 기준 오늘의 시작 시각 (UTC timestamptz). */
function kstQuotaStart(now: Date = new Date()): Date {
  const kstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }))
  const kstYear = kstNow.getFullYear()
  const kstMonth = kstNow.getMonth()
  const kstDate = kstNow.getDate()
  const kstHour = kstNow.getHours()

  // 08:00 이전이면 어제 08:00 KST, 이후면 오늘 08:00 KST
  // Use Date.UTC with -9h offset to express KST local time
  if (kstHour < 8) {
    return new Date(Date.UTC(kstYear, kstMonth, kstDate - 1, 8 - 9, 0, 0))
  }
  return new Date(Date.UTC(kstYear, kstMonth, kstDate, 8 - 9, 0, 0))
}

export async function getMyQuota(userId: string): Promise<QuotaStatus> {
  const supabase = getRawSupabaseClient()
  const since = kstQuotaStart().toISOString()

  const [sentTodayRes, receivedTodayRes, activeSentRes, activeReceivedRes] = await Promise.all([
    supabase
      .from('dating_requests')
      .select('id', { count: 'exact', head: true })
      .eq('requester_id', userId)
      .gte('created_at', since),
    supabase
      .from('dating_requests')
      .select('id', { count: 'exact', head: true })
      .eq('target_id', userId)
      .gte('created_at', since),
    // active sent: pending OR (accepted AND payment not paid/expired)
    supabase
      .from('dating_requests')
      .select('id, matches(payment_status)', { count: 'exact', head: false })
      .eq('requester_id', userId)
      .in('status', ['pending', 'accepted']),
    supabase
      .from('dating_requests')
      .select('id, matches(payment_status)', { count: 'exact', head: false })
      .eq('target_id', userId)
      .in('status', ['pending', 'accepted']),
  ])

  const sentToday = sentTodayRes.count ?? 0
  const receivedToday = receivedTodayRes.count ?? 0

  // Count active: pending OR (accepted AND payment_status in pending|pending_confirmation)
  type Row = { matches: { payment_status: string }[] | null }
  const countActive = (data: Row[] | null) =>
    (data ?? []).filter((r) => {
      const match = r.matches?.[0]
      // pending (no match yet) — active. accepted with paid/expired — not active.
      if (!match) return true
      return match.payment_status === 'pending' || match.payment_status === 'pending_confirmation'
    }).length

  const activeSent = countActive(activeSentRes.data as Row[] | null)
  const activeReceived = countActive(activeReceivedRes.data as Row[] | null)
  const activeSlotsUsed = activeSent + activeReceived

  const sendLimit = BASE_DAILY_SEND_QUOTA + receivedToday
  const remainingSend = Math.max(0, sendLimit - sentToday)

  return {
    sentToday,
    receivedToday,
    activeSlotsUsed,
    sendLimit,
    remainingSend,
    maxActiveSlots: MAX_ACTIVE_SLOTS,
  }
}
