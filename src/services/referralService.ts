/**
 * 레퍼럴 적립 / 지급 신청 / 프로필 검증.
 *
 * - earnings 적립은 admin_verify_profile RPC가 append (Phase 1 migration).
 * - 지급 신청은 유저가 직접 insert; 관리자가 update.
 * - verify는 verify_referral_profile RPC 호출.
 */

import { getRawSupabaseClient } from '@/lib/supabase'
import type { ReferralPayout, Profile } from '@/types/database'

export interface ReferralBalance {
  totalEarned: number
  paid: number
  pending: number
  countMale: number
  countFemale: number
}

export async function getMyReferralBalance(userId: string): Promise<ReferralBalance> {
  const supabase = getRawSupabaseClient()
  const { data, error } = await supabase
    .from('referral_earnings')
    .select('amount, invitee_gender, paid_payout_id')
    .eq('referrer_id', userId)

  if (error) throw error

  const rows = (data ?? []) as { amount: number; invitee_gender: 'male' | 'female'; paid_payout_id: string | null }[]

  let totalEarned = 0
  let paid = 0
  let countMale = 0
  let countFemale = 0

  for (const r of rows) {
    totalEarned += r.amount
    if (r.paid_payout_id) paid += r.amount
    if (r.invitee_gender === 'male') countMale++
    else countFemale++
  }

  return {
    totalEarned,
    paid,
    pending: totalEarned - paid,
    countMale,
    countFemale,
  }
}

export async function submitReferralPayoutRequest(args: {
  userId: string
  amount: number
  bankName: string
  bankAccount: string
  accountHolder: string
}): Promise<ReferralPayout> {
  const supabase = getRawSupabaseClient()
  const { data, error } = await supabase
    .from('referral_payouts')
    .insert({
      user_id: args.userId,
      amount_requested: args.amount,
      bank_name: args.bankName,
      bank_account: args.bankAccount,
      account_holder: args.accountHolder,
    })
    .select()
    .single()

  if (error) throw error
  return data as ReferralPayout
}

export async function getMyPayoutRequests(userId: string): Promise<ReferralPayout[]> {
  const supabase = getRawSupabaseClient()
  const { data, error } = await supabase
    .from('referral_payouts')
    .select('*')
    .eq('user_id', userId)
    .order('requested_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as ReferralPayout[]
}

export async function verifyReferralProfile(args: {
  inviteeId: string
  approved: boolean
  note?: string
  referrerComment?: string
}): Promise<void> {
  const res = await fetch('/api/referral/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  })
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: 'verify failed' }))
    throw new Error(error)
  }
}

/**
 * 내가 레퍼럴한 친구 전부 (검증 상태 무관).
 * 각 항목은 my_verified 플래그(=verified_by_referrer)를 포함하여 UI 에서 분기 가능.
 *
 * 2-step 쿼리: invite_codes.used_by 가 auth.users 를 가리키므로 PostgREST relationship 사용 불가.
 */
export async function getMyReferredUsers(
  referrerId: string,
): Promise<Array<Profile & { my_verified: boolean }>> {
  const supabase = getRawSupabaseClient()

  const { data: codes, error: codesErr } = await supabase
    .from('invite_codes')
    .select('used_by')
    .eq('created_by', referrerId)
    .not('used_by', 'is', null)

  if (codesErr) throw codesErr

  const inviteeIds = ((codes ?? []) as { used_by: string | null }[])
    .map((c) => c.used_by)
    .filter((id): id is string => !!id)
  if (inviteeIds.length === 0) return []

  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('*')
    .in('id', inviteeIds)

  if (profErr) throw profErr
  return ((profiles ?? []) as Profile[]).map((p) => ({
    ...p,
    my_verified: !!p.verified_by_referrer,
  }))
}

/**
 * 내가 레퍼럴한 사람 중 아직 내가 검증하지 않은 (또는 재검증 필요한) invitee 목록.
 * invite_codes.created_by = me AND invite_codes.used_by 채워짐.
 */
export async function getReferredUsersToVerify(referrerId: string): Promise<Profile[]> {
  const supabase = getRawSupabaseClient()

  // Step 1: 내가 만든 초대코드 중 used_by가 있는 것들
  const { data: codes, error: codesErr } = await supabase
    .from('invite_codes')
    .select('used_by')
    .eq('created_by', referrerId)
    .not('used_by', 'is', null)

  if (codesErr) throw codesErr

  const inviteeIds = ((codes ?? []) as { used_by: string | null }[])
    .map((c) => c.used_by)
    .filter((id): id is string => !!id)
  if (inviteeIds.length === 0) return []

  // Step 2: 해당 invitee들의 profile
  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('*')
    .in('id', inviteeIds)

  if (profErr) throw profErr
  const invitees = (profiles ?? []) as Profile[]
  if (invitees.length === 0) return []

  // Step 3: 이미 처리된 invitee 제외 (referral_verifications에 record 있으면 done)
  const { data: verified } = await supabase
    .from('referral_verifications')
    .select('invitee_id')
    .eq('referrer_id', referrerId)
    .in('invitee_id', invitees.map((p) => p.id))

  const verifiedSet = new Set((verified ?? []).map((r) => r.invitee_id))
  return invitees.filter((p) => !verifiedSet.has(p.id))
}
