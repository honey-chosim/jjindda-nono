import { getRawSupabaseClient } from '@/lib/supabase'
import type { DatingRequest, RequestWithRequester } from '@/types/database'

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

export async function sendDatingRequest(
  requesterId: string,
  targetId: string
): Promise<DatingRequest> {
  const supabase = getRawSupabaseClient()

  const today = new Date().toISOString().split('T')[0]
  const { error: limitError } = await supabase
    .from('daily_request_limits')
    .insert({ user_id: requesterId, request_date: today })

  if (limitError) {
    if (limitError.code === '23505') {
      throw new Error('오늘 이미 소개팅 신청을 하셨습니다. 내일 다시 시도해주세요.')
    }
    throw limitError
  }

  const { data, error } = await supabase
    .from('dating_requests')
    .insert({ requester_id: requesterId, target_id: targetId })
    .select()
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
  return (data ?? []) as RequestWithRequester[]
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
    .insert({
      request_id: requestId,
      user1_id: req.requester_id,
      user2_id: req.target_id,
    })

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
