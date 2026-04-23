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
      .select('id, status, matches(payment_status)')
      .eq('requester_id', userId)
      .in('status', ['pending', 'accepted']),
    supabase
      .from('dating_requests')
      .select('id, status, matches(payment_status)')
      .eq('target_id', userId)
      .in('status', ['pending', 'accepted']),
  ])

  const sentToday = sentTodayRes.count ?? 0
  const receivedToday = receivedTodayRes.count ?? 0

  // PostgREST returns one-to-one nested rows as a single object (not array) when the FK is unique.
  // matches.request_id is unique → `r.matches` is `{...} | null`, not `[{...}]`.
  type MatchRow = { payment_status: string }
  type Row = { status: 'pending' | 'accepted'; matches: MatchRow | MatchRow[] | null }
  const countActive = (data: Row[] | null) =>
    (data ?? []).filter((r) => {
      if (r.status === 'pending') return true
      // status === 'accepted': active only if a match exists with in-flight payment.
      // Orphan accepted (no match) = data corruption, treat as not active.
      const match = Array.isArray(r.matches) ? r.matches[0] : r.matches
      if (!match) return false
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
