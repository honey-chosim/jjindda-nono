/**
 * Solapi SMS 발송 + sms_notifications 로깅 + 야간 가드 + 중복 방지
 *
 * 서버 전용 (Node crypto 사용, service_role 접근).
 * OTP 발송은 기존대로 src/app/api/auth/send-otp/route.ts 에서 직접 발송.
 * 정책 기반 알림(매칭/결제/레퍼럴)은 `sendSmsNotification()` 사용.
 */

import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import type { SmsStatus } from '@/types/database'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export function solapiAuthHeader(): string {
  const dateTime = new Date().toISOString()
  const salt = crypto.randomUUID()
  const hmac = crypto.createHmac('sha256', process.env.SOLAPI_API_SECRET!)
  hmac.update(dateTime + salt)
  const signature = hmac.digest('hex')
  return `HMAC-SHA256 apiKey=${process.env.SOLAPI_API_KEY}, date=${dateTime}, salt=${salt}, signature=${signature}`
}

export async function sendSms(args: {
  to: string
  text: string
}): Promise<{ ok: boolean; messageId?: string; error?: string }> {
  const to = args.to.replace(/[-\s]/g, '')
  const from = (process.env.SOLAPI_SENDER_NUMBER ?? '').replace(/-/g, '')

  try {
    const res = await fetch('https://api.solapi.com/messages/v4/send-many/detail', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: solapiAuthHeader(),
      },
      body: JSON.stringify({ messages: [{ to, from, text: args.text }] }),
    })

    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return { ok: false, error: JSON.stringify(err) }
    }

    const data = await res.json().catch(() => null) as { messageId?: string } | null
    return { ok: true, messageId: data?.messageId }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

/**
 * KST 기준 야간(22:00~07:59)인지 체크.
 * critical 알림은 야간에도 발송; 그 외는 skip + sms_notifications에 'skipped_night' 로깅.
 */
export function isNightTimeKst(date: Date = new Date()): boolean {
  const hour = Number(
    date.toLocaleString('en-US', {
      timeZone: 'Asia/Seoul',
      hour: '2-digit',
      hour12: false,
    })
  )
  return hour >= 22 || hour < 8
}

// ============================================================
// 템플릿
// ============================================================

export type SmsTemplateKey =
  | 'request_received'          // #1 — B에게
  | 'request_expiry_reminder'   // #2 — B에게 (1h 전)
  | 'match_accepted'            // #3 — A에게
  | 'payment_expiry_reminder'   // #4 — A에게 (1h 전)
  | 'match_paid'                // #5 — 양측
  | 'profile_approved'          // #6
  | 'profile_rejected'          // #7
  | 'referral_signup'           // #8
  | 'referral_verify_reminder'  // #9
  | 'referral_payout_paid'      // #10
  | 'daily_quota_reset'         // #11 opt-in
  | 'dormant_d7'                // #12a
  | 'dormant_d14'               // #12b
  | 'dormant_d30'               // #12c

const CRITICAL_TEMPLATES: Set<SmsTemplateKey> = new Set([
  'request_received',
  'request_expiry_reminder',
  'match_accepted',
  'payment_expiry_reminder',
  'match_paid',
  // 초기 운영 편의상 24시간 발송 (정책상 X였으나 사용자 지시)
  'profile_approved',
  'profile_rejected',
])

const AD_TEMPLATES: Set<SmsTemplateKey> = new Set([
  'daily_quota_reset',
  'dormant_d7',
  'dormant_d14',
  'dormant_d30',
])

function appUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'https://jjindda-nono.vercel.app'
  return `${base}${path}`
}

export function renderTemplate(
  key: SmsTemplateKey,
  vars: Record<string, string | number | undefined>
): string {
  const prefix = AD_TEMPLATES.has(key) ? '[광고][찐따노노]' : '[찐따노노]'

  switch (key) {
    case 'request_received':
      return `${prefix} ${vars.requester_name}님으로부터 매칭 요청이 도착했어요.\n24시간 내 수락해주세요 → ${appUrl('/requests')}`
    case 'request_expiry_reminder':
      return `${prefix} ${vars.requester_name}님의 매칭 요청이 1시간 뒤 만료돼요.\n지금 확인 → ${appUrl('/requests')}`
    case 'match_accepted':
      return `${prefix} ${vars.target_name}님이 매칭을 수락했어요!\n24시간 내 7만원 결제 → ${appUrl(`/match/${vars.match_id}`)}`
    case 'payment_expiry_reminder':
      return `${prefix} ${vars.target_name}님과의 매칭 결제 마감 1시간 전!\n지금 결제 → ${appUrl(`/match/${vars.match_id}`)}`
    case 'match_paid':
      return `${prefix} 매칭이 성사되어 카톡방이 열렸어요!\n대화 시작 → ${appUrl(`/match/${vars.match_id}`)}`
    case 'profile_approved':
      return `${prefix} 프로필이 승인되었어요! 오늘의 인연을 찾아보세요 → ${appUrl('/profiles')}`
    case 'profile_rejected':
      return vars.reason
        ? `${prefix} 아쉽지만 프로필이 거절되었어요.\n사유: ${vars.reason}\n수정 후 다시 신청 가능해요 → ${appUrl('/my/edit')}`
        : `${prefix} 아쉽지만 프로필이 거절되었어요.\n수정 후 다시 신청 가능해요 → ${appUrl('/my/edit')}`
    case 'referral_signup':
      return `${prefix} 소개해준 ${vars.friend_name}님이 가입했어요.\n프로필 검증 → ${appUrl('/my')}`
    case 'referral_verify_reminder':
      return `${prefix} ${vars.friend_name}님의 프로필 검증이 대기 중이에요 → ${appUrl('/my')}`
    case 'referral_payout_paid':
      return `${prefix} 레퍼럴 보너스 ${vars.amount}원이 입금되었어요. 감사합니다!`
    case 'daily_quota_reset':
      return `${prefix} 오늘의 요청권이 도착했어요. 인연을 찾아보세요 → ${appUrl('/profiles')}\n수신거부: 내 정보 → 알림 설정`
    case 'dormant_d7':
      return `${prefix} 이번 주 새로운 프로필이 추가됐어요 → ${appUrl('/profiles')}\n수신거부: 내 정보 → 알림 설정`
    case 'dormant_d14':
      return `${prefix} ${vars.friend_name ?? '누군가'} 당신의 프로필을 궁금해해요 → ${appUrl('/profiles')}\n수신거부: 내 정보 → 알림 설정`
    case 'dormant_d30':
      return `${prefix} 돌아오시면 요청권 3개를 선물로 드려요 → ${appUrl('/profiles')}\n수신거부: 내 정보 → 알림 설정`
    default:
      throw new Error(`Unknown template: ${key}`)
  }
}

// ============================================================
// 메인 진입점
// ============================================================

export async function sendSmsNotification(args: {
  userId: string
  templateKey: SmsTemplateKey
  referenceId?: string
  vars: Record<string, string | number | undefined>
  phone: string
  /** 강제로 critical 지정 (기본은 템플릿 맵 기준) */
  forceCritical?: boolean
}): Promise<{ ok: boolean; status: SmsStatus; reason?: string }> {
  const { userId, templateKey, referenceId, vars, phone } = args
  const supabase = getAdminClient()
  const critical = args.forceCritical ?? CRITICAL_TEMPLATES.has(templateKey)

  // 1. 야간 가드 (critical 예외)
  if (!critical && isNightTimeKst()) {
    await supabase.from('sms_notifications').insert({
      user_id: userId,
      template_key: templateKey,
      reference_id: referenceId ?? null,
      phone,
      message: '',
      status: 'skipped_night',
    })
    return { ok: false, status: 'skipped_night', reason: 'night guard' }
  }

  // 2. 중복 발송 방지 — 같은 (user_id, template_key, reference_id) 성공 이력 있으면 skip
  if (referenceId) {
    const { data: dup } = await supabase
      .from('sms_notifications')
      .select('id')
      .eq('user_id', userId)
      .eq('template_key', templateKey)
      .eq('reference_id', referenceId)
      .eq('status', 'sent')
      .maybeSingle()

    if (dup) {
      await supabase.from('sms_notifications').insert({
        user_id: userId,
        template_key: templateKey,
        reference_id: referenceId,
        phone,
        message: '',
        status: 'skipped_duplicate',
      })
      return { ok: false, status: 'skipped_duplicate', reason: 'already sent' }
    }
  }

  // 3. 발송
  const message = renderTemplate(templateKey, vars)
  const { ok, messageId, error } = await sendSms({ to: phone, text: message })

  // 4. 로깅
  await supabase.from('sms_notifications').insert({
    user_id: userId,
    template_key: templateKey,
    reference_id: referenceId ?? null,
    phone,
    message,
    solapi_message_id: messageId ?? null,
    status: ok ? 'sent' : 'failed',
    error: error ?? null,
  })

  return { ok, status: ok ? 'sent' : 'failed', reason: error }
}
