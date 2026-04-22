/**
 * 찐따노노 가격/단가 상수
 *
 * 단일 진입점 — 모든 금액은 여기서만 참조.
 * 변경 시 admin UI, frontend 결제 페이지, SMS 템플릿에 자동 반영.
 */

/** 매칭 성사 시 요청자가 이체하는 금액 (수동 이체) */
export const MATCH_PRICE_KRW = 70_000

/** 남자 레퍼럴 단가 — invitee.gender === 'male' */
export const REFERRAL_MALE_KRW = 5_000

/** 여자 레퍼럴 단가 — invitee.gender === 'female' */
export const REFERRAL_FEMALE_KRW = 15_000

/** 타이머: 요청 수락 대기 */
export const ACCEPT_DEADLINE_HOURS = 24

/** 타이머: 결제 대기 */
export const PAYMENT_DEADLINE_HOURS = 24

/** 동시 active 요청(송+수신 합산) 최대 */
export const MAX_ACTIVE_SLOTS = 3

/** 기본 일일 송신권 (수신 보너스 제외) */
export const BASE_DAILY_SEND_QUOTA = 1

export function referralAmountFor(gender: 'male' | 'female'): number {
  return gender === 'male' ? REFERRAL_MALE_KRW : REFERRAL_FEMALE_KRW
}
