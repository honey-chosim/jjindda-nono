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
}): Promise<void> {
  const supabase = getRawSupabaseClient()
  const { error } = await supabase.rpc('verify_referral_profile', {
    p_invitee_id: args.inviteeId,
    p_approved: args.approved,
    p_note: args.note ?? null,
  })
  if (error) throw error
}

/**
 * 내가 레퍼럴한 사람 중 아직 내가 검증하지 않은 (또는 재검증 필요한) invitee 목록.
 * invite_codes.created_by = me AND invite_codes.used_by 채워짐.
 */
export async function getReferredUsersToVerify(referrerId: string): Promise<Profile[]> {
  const supabase = getRawSupabaseClient()
  const { data, error } = await supabase
    .from('invite_codes')
    .select('used_by, invitee:profiles!invite_codes_used_by_fkey(*)')
    .eq('created_by', referrerId)
    .not('used_by', 'is', null)

  if (error) throw error

  type Row = { used_by: string | null; invitee: Profile | null }
  const rows = (data ?? []) as unknown as Row[]
  return rows
    .map((r) => r.invitee)
    .filter((p): p is Profile => p != null)
}
