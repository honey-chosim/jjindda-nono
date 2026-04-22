import { getRawSupabaseClient } from '@/lib/supabase'
import type { DatingRequest, RequestWithRequester } from '@/types/database'

/**
 * v2 (Phase 1 RPC 기반): 3-slot + 송신권 정책을 RPC에서 enforce.
 * 기존 sendDatingRequest()는 호환성 유지를 위해 남겨둠. 신규 코드는 sendDatingRequestV2 사용.
 */
export async function sendDatingRequestV2(
  requesterId: string,
  targetId: string
): Promise<string> {
  const supabase = getRawSupabaseClient()
  const { data, error } = await supabase.rpc('send_dating_request', {
    p_requester_id: requesterId,
    p_target_id: targetId,
  })
  if (error) {
    const code = (error as { code?: string }).code
    if (code === 'P0001') throw new Error('동시 요청 최대 3개를 넘을 수 없어요.')
    if (code === 'P0002') throw new Error('오늘의 요청권을 모두 사용했어요. 내일 오전 8시에 초기화돼요.')
    if (code === '23505') throw new Error('이미 이 사람에게 보낸 요청이 있어요.')
    throw error
  }
  return data as string
}

export async function cancelRequestV2(requestId: string): Promise<void> {
  const supabase = getRawSupabaseClient()
  const { error } = await supabase.rpc('cancel_dating_request', {
    p_request_id: requestId,
  })
  if (error) throw error
}

export async function acceptRequestV2(requestId: string): Promise<string> {
  const supabase = getRawSupabaseClient()
  const { data, error } = await supabase.rpc('accept_dating_request', {
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

export async function hasUsedRequestToday(userId: string): Promise<boolean> {
  const supabase = getRawSupabaseClient()
  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('daily_request_limits')
    .select('id')
    .eq('user_id', userId)
    .eq('request_date', today)
    .maybeSingle()

  if (error) throw error
  return data !== null
}

/**
 * @deprecated legacy 경로가 3슬롯/수신보너스 정책을 우회할 수 있어서 V2 RPC로 완전 위임.
 */
export async function sendDatingRequest(
  requesterId: string,
  targetId: string
): Promise<DatingRequest> {
  const supabase = getRawSupabaseClient()
  const requestId = await sendDatingRequestV2(requesterId, targetId)

  const { data, error } = await supabase
    .from('dating_requests')
    .select('*')
    .eq('id', requestId)
    .single()

  if (error) throw error
  return data as DatingRequest
}

export async function getSentRequests(userId: string) {
  const supabase = getRawSupabaseClient()
  const { data, error } = await supabase
    .from('dating_requests')
    .select(`*, target:profiles!dating_requests_target_id_fkey(id, name)`)
    .eq('requester_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as (DatingRequest & { target: { id: string; name: string } | null })[]
}

export async function getReceivedRequests(userId: string): Promise<RequestWithRequester[]> {
  const supabase = getRawSupabaseClient()
  const { data, error } = await supabase
    .from('dating_requests')
    .select(`
      *,
      requester:profiles!dating_requests_requester_id_fkey(*)
    `)
    .eq('target_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return ((data ?? []) as RequestWithRequester[]).filter((r) => r.requester != null)
}

export async function acceptRequest(requestId: string, targetId: string): Promise<void> {
  const supabase = getRawSupabaseClient()

  const { data: request, error: reqError } = await supabase
    .from('dating_requests')
    .update({ status: 'accepted' })
    .eq('id', requestId)
    .eq('target_id', targetId)
    .select()
    .single()

  if (reqError) throw reqError

  const req = request as DatingRequest
  const { error: matchError } = await supabase
    .from('matches')
    .upsert({
      request_id: requestId,
      user1_id: req.requester_id,
      user2_id: req.target_id,
    }, { onConflict: 'request_id', ignoreDuplicates: true })

  if (matchError) throw matchError
}

export async function rejectRequest(requestId: string, targetId: string): Promise<void> {
  const supabase = getRawSupabaseClient()
  const { error } = await supabase
    .from('dating_requests')
    .update({ status: 'rejected' })
    .eq('id', requestId)
    .eq('target_id', targetId)

  if (error) throw error
}

export async function getAcceptedRequestId(requesterId: string, targetId: string): Promise<string | null> {
  const supabase = getRawSupabaseClient()
  const { data } = await supabase
    .from('dating_requests')
    .select('id')
    .eq('requester_id', requesterId)
    .eq('target_id', targetId)
    .eq('status', 'accepted')
    .maybeSingle()
  return data?.id ?? null
}

export async function getPendingRequestFrom(
  senderId: string,
  receiverId: string
): Promise<{ id: string } | null> {
  const supabase = getRawSupabaseClient()
  const { data } = await supabase
    .from('dating_requests')
    .select('id')
    .eq('requester_id', senderId)
    .eq('target_id', receiverId)
    .eq('status', 'pending')
    .maybeSingle()
  return data ?? null
}

export async function hasRequested(requesterId: string, targetId: string): Promise<boolean> {
  const supabase = getRawSupabaseClient()
  const { data, error } = await supabase
    .from('dating_requests')
    .select('id')
    .eq('requester_id', requesterId)
    .eq('target_id', targetId)
    .maybeSingle()

  if (error) throw error
  return data !== null
}

export interface RequestQuota {
  available: number
  activeSlots: number
}

export async function getRequestQuota(userId: string): Promise<RequestQuota> {
  const supabase = getRawSupabaseClient()

  const [sentRes, receivedRes] = await Promise.all([
    supabase
      .from('dating_requests')
      .select('id', { count: 'exact', head: true })
      .eq('requester_id', userId)
      .eq('status', 'pending'),
    supabase
      .from('dating_requests')
      .select('id', { count: 'exact', head: true })
      .eq('target_id', userId)
      .eq('status', 'pending'),
  ])

  const sentActive = sentRes.count ?? 0
  const receivedActive = receivedRes.count ?? 0
  const activeSlots = sentActive + receivedActive

  const today = new Date().toISOString().split('T')[0]
  const { data: limitRow } = await supabase
    .from('daily_request_limits')
    .select('id')
    .eq('user_id', userId)
    .eq('request_date', today)
    .maybeSingle()

  const usedToday = limitRow !== null ? 1 : 0
  const totalSendQuota = 1 + receivedActive
  const available = Math.max(0, totalSendQuota - usedToday)

  return { available, activeSlots }
}
