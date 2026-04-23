import { getRawSupabaseClient } from '@/lib/supabase'
import type { MatchWithProfiles } from '@/types/database'

export async function getMatchById(matchId: string): Promise<MatchWithProfiles | null> {
  const supabase = getRawSupabaseClient()
  const { data, error } = await supabase
    .from('matches')
    .select(`
      *,
      user1:profiles!matches_user1_id_fkey(*),
      user2:profiles!matches_user2_id_fkey(*),
      request:dating_requests(*)
    `)
    .eq('id', matchId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data as MatchWithProfiles
}

export async function getMatchByRequestId(requestId: string): Promise<MatchWithProfiles | null> {
  const supabase = getRawSupabaseClient()
  const { data, error } = await supabase
    .from('matches')
    .select(`
      *,
      user1:profiles!matches_user1_id_fkey(*),
      user2:profiles!matches_user2_id_fkey(*),
      request:dating_requests(*)
    `)
    .eq('request_id', requestId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data as MatchWithProfiles
}

/**
 * 유저 "입금 완료 알리기" — 4-state 정책 준수.
 * pending → pending_confirmation 으로 전환 (admin이 paid로 최종 확정).
 * 직접 update 금지 — confirm_payment_transfer RPC 경유.
 */
export async function markPaymentComplete(matchId: string, _userId?: string): Promise<void> {
  void _userId
  await confirmPaymentTransfer(matchId)
}

/**
 * v2 (Phase 1): "바로 수락하기" — B가 즉시 수락 + 결제 타이머 시작.
 * 브라우저에서 직접 RPC 호출 금지 — 무조건 API route 경유 (CLAUDE.md 정책 #19).
 */
export async function instantAcceptAndPay(requestId: string): Promise<string> {
  const res = await fetch('/api/requests/instant-accept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(json?.error ?? 'instant-accept failed')
  }
  return json.matchId as string
}

/**
 * 유저가 "이체 완료" 클릭 — pending_confirmation 으로 전환.
 * 관리자 확인 후 admin_mark_payment_paid RPC가 paid로 최종 전환.
 * API route 경유 — RPC 가 auth.uid() == payer_id 체크.
 */
export async function confirmPaymentTransfer(matchId: string): Promise<void> {
  const res = await fetch('/api/match/confirm-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ matchId }),
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: 'confirm payment failed' }))
    throw new Error(error ?? 'confirm payment failed')
  }
}

export function getPaymentDeadline(match: { payment_expires_at: string | null; created_at: string }): Date {
  if (match.payment_expires_at) return new Date(match.payment_expires_at)
  const created = new Date(match.created_at).getTime()
  return new Date(created + 24 * 60 * 60 * 1000)
}

export async function getMyMatches(userId: string): Promise<MatchWithProfiles[]> {
  const supabase = getRawSupabaseClient()
  const { data, error } = await supabase
    .from('matches')
    .select(`
      *,
      user1:profiles!matches_user1_id_fkey(*),
      user2:profiles!matches_user2_id_fkey(*),
      request:dating_requests(*)
    `)
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as MatchWithProfiles[]
}
