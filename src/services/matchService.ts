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

export async function markPaymentComplete(matchId: string, userId: string): Promise<void> {
  const supabase = getRawSupabaseClient()
  const { error } = await supabase
    .from('matches')
    .update({ payment_status: 'paid' })
    .eq('id', matchId)
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)

  if (error) throw error
}

/**
 * v2 (Phase 1): "바로 수락하기" — B가 즉시 수락 + 결제 타이머 시작.
 */
export async function instantAcceptAndPay(requestId: string): Promise<string> {
  const supabase = getRawSupabaseClient()
  const { data, error } = await supabase.rpc('instant_accept_match', {
    p_request_id: requestId,
  })
  if (error) {
    const code = (error as { code?: string }).code
    if (code === 'P0004') throw new Error('이미 응답한 요청이에요.')
    if (code === 'P0005') throw new Error('만료된 요청이에요.')
    throw error
  }
  return data as string
}

/**
 * 유저가 "이체 완료" 클릭 — pending_confirmation 으로 전환.
 * 관리자 확인 후 admin_mark_payment_paid RPC가 paid로 최종 전환.
 */
export async function confirmPaymentTransfer(matchId: string): Promise<void> {
  const supabase = getRawSupabaseClient()
  const { error } = await supabase.rpc('confirm_payment_transfer', {
    p_match_id: matchId,
  })
  if (error) throw error
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
