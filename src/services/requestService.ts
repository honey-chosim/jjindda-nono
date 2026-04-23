import { getRawSupabaseClient } from '@/lib/supabase'
import type { DatingRequest, RequestWithRequester } from '@/types/database'

/**
 * v2 (Phase 1 RPC 기반): 3-slot + 송신권 정책을 RPC에서 enforce.
 * 브라우저는 무조건 /api/requests/send 경유 — RPC 직접 호출하면 SMS/감사로그 누락 (CLAUDE.md 정책 #19).
 * 기존 sendDatingRequest()는 호환성 유지를 위해 남겨둠. 신규 코드는 sendDatingRequestV2 사용.
 */
export async function sendDatingRequestV2(
  _requesterId: string,
  targetId: string
): Promise<string> {
  void _requesterId  // server derives from session
  const res = await fetch('/api/requests/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ targetId }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(json?.error ?? 'send failed')
  }
  return json.requestId as string
}

export async function cancelRequestV2(requestId: string): Promise<void> {
  const res = await fetch('/api/requests/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId }),
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: 'cancel failed' }))
    throw new Error(error ?? 'cancel failed')
  }
}

export async function acceptRequestV2(requestId: string): Promise<string> {
  const res = await fetch('/api/requests/accept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(json?.error ?? 'accept failed')
  }
  return json.matchId as string
}

/**
 * @deprecated Reads from legacy `daily_request_limits` table that the V2 RPC never
 * populates. Use `getMyQuota(userId).remainingSend === 0` from `@/services/quotaService`
 * instead — that's the policy-compliant "is the user out of today's send quota" check.
 *
 * Kept temporarily as a thin shim over getMyQuota for any straggler imports.
 */
export async function hasUsedRequestToday(userId: string): Promise<boolean> {
  const { getMyQuota } = await import('./quotaService')
  const q = await getMyQuota(userId)
  return q.remainingSend === 0
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

type CardTargetProfile = {
  id: string
  name: string
  photos: string[] | null
  birth_year: number | null
  job_title: string | null
  residence_city: string | null
  residence_district: string | null
}

type MatchInfo = { payment_expires_at: string | null; payment_status: string }

function normalizeMatch<T extends { matches?: MatchInfo | MatchInfo[] | null }>(row: T): T & { match: MatchInfo | null } {
  const m = row.matches
  const match = Array.isArray(m) ? (m[0] ?? null) : (m ?? null)
  return { ...row, match }
}

export async function getSentRequests(userId: string) {
  const supabase = getRawSupabaseClient()
  const { data, error } = await supabase
    .from('dating_requests')
    .select(`*, target:profiles!dating_requests_target_id_fkey(id, name, photos, birth_year, job_title, residence_city, residence_district), matches(payment_expires_at, payment_status)`)
    .eq('requester_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return ((data ?? []) as (DatingRequest & { target: CardTargetProfile | null; matches?: MatchInfo | MatchInfo[] | null })[])
    .map(normalizeMatch)
}

export async function getReceivedRequests(userId: string): Promise<(RequestWithRequester & { match: MatchInfo | null })[]> {
  const supabase = getRawSupabaseClient()
  const { data, error } = await supabase
    .from('dating_requests')
    .select(`
      *,
      requester:profiles!dating_requests_requester_id_fkey(*),
      matches(payment_expires_at, payment_status)
    `)
    .eq('target_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return ((data ?? []) as (RequestWithRequester & { matches?: MatchInfo | MatchInfo[] | null })[])
    .filter((r) => r.requester != null)
    .map(normalizeMatch)
}

// REMOVED: legacy `acceptRequest()` direct-update path.
// It set status='accepted' and inserted a match WITHOUT payer_id / payment_expires_at /
// payment_status — `payer_id` is NOT NULL post-Phase-1, so every call would 23502.
// All call sites now use `acceptRequestV2()` (RPC) or POST /api/requests/accept.

/**
 * Reject a received dating request.
 *
 * Per CLAUDE.md SMS policy (template #13): rejection SMS to the requester is FORBIDDEN
 * — in-app notification only. The API route enforces target_id == auth.uid() so a
 * non-target cannot reject someone else's request.
 *
 * @param requestId — the dating_request to reject
 * @param _targetId — kept for backwards-compatible signature; the server derives
 *                    target_id from the authenticated session and ignores this value.
 */
export async function rejectRequest(requestId: string, _targetId?: string): Promise<void> {
  void _targetId
  const res = await fetch('/api/requests/reject', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId }),
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: 'reject failed' }))
    throw new Error(error ?? 'reject failed')
  }
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

/**
 * @deprecated Use `getMyQuota` from `@/services/quotaService` for the full status.
 * Retained for existing UI. Delegates to policy-compliant getMyQuota (KST 08:00 boundary + payer-aware slots).
 */
export async function getRequestQuota(userId: string): Promise<RequestQuota> {
  const { getMyQuota } = await import('./quotaService')
  const q = await getMyQuota(userId)
  return { available: q.remainingSend, activeSlots: q.activeSlotsUsed }
}
