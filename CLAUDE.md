@AGENTS.md

# 찐따노노 프로젝트 — 정책 + 시행착오 기록

## 📜 정책 원본 문서 (반드시 먼저 읽을 것)

- `/Users/simgh/SecondBrain/1_Project/소개팅/20260422_찐따노노_정책정리.md` — 매칭/결제/요청권/레퍼럴
- `/Users/simgh/SecondBrain/1_Project/소개팅/20260422_찐따노노_알림정책.md` — SMS 14종 매트릭스

---

## 🎯 핵심 비즈니스 정책

### 매칭 & 결제
- **매칭 가격**: **70,000원** 이체 (수동 확인, PG 연동 없음)
- **결제 주체**: `matches.payer_id` 기반
  - 일반 플로우: requester(A) = payer
  - "바로 수락하기" 플로우: target(B) = payer
- **카톡방 개설**: 운영진이 어드민에서 수동 URL 입력 → `matches.kakao_room_url`

### 요청권
- **송신 기본**: 하루 1개
- **수신 보너스**: 오늘 수신한 요청 수만큼 추가 송신 가능 (기본 1 + received_today)
- **동시 슬롯**: 송+수 합산 pending/accepted-미결제 **최대 3개**
- **일일 리셋**: **매일 오전 8시 KST** (실시간 계산 — `current_quota_date()` RPC)
- **재요청**: rejected/expired/cancelled 후 동일 대상에게 재요청 허용 (partial unique index)

### 타이머
- **수락 대기**: 24h (`dating_requests.expires_at` generated column)
- **결제 대기**: 24h (`matches.payment_expires_at`)
- **만료 배치**: `/api/cron/expire-requests`, `/api/cron/expire-payments` (10분 주기)
- **1h 리마인더**: `/api/cron/remind-*` (10분 주기)

### 레퍼럴
- **이중 검증**: 친구(`verified_by_referrer`) + 운영진(`is_verified`) **둘 다** 통과 필요
- **탐색 노출 조건**: `is_active AND onboarding_completed AND is_verified AND verified_by_referrer`
- **지급 단가**: 남자 소개 **5,000원** / 여자 소개 **15,000원** (invitee.gender 기준)
- **지급 방식**: 유저 신청 → 어드민 수동 지급 (자동 아님)

### SMS 알림 (14종)
- 필수(🔴): #1 요청수신 / #2 수락만료1h전 / #3 수락완료 / #4 결제만료1h전 / #5 결제완료
- 권장(🟡): #6 승인 / #7 반려 / #8 레퍼럴가입 / #9 검증대기 / #10 정산완료
- Opt-in(🟢): #11 일일초기화 / #12 휴면재소환 — `marketing_sms=true` 유저만
- **금지**: #13 요청거절/만료 / #14 결제만료취소 (인앱만)
- **야간 가드**: 22~08시 KST — critical 외 차단 (정보통신망법)

---

## 🚨 시행착오 — 반드시 피할 패턴

### 1. Server API Routes는 `createServerSupabaseClient` 필수
`getSupabaseClient()` / `getRawSupabaseClient()` 는 **브라우저 전용** (`createBrowserClient`). API 라우트에서 쓰면 **쿠키 못 읽어 401**.

```ts
// ❌ 금지 (API route)
const supabase = getSupabaseClient()
const { data: { user } } = await supabase.auth.getUser() // null!

// ✅ 올바른
import { createServerSupabaseClient } from '@/lib/supabase-server'
const supabase = await createServerSupabaseClient()
```

### 2. Serverless 응답 직후 종료 → fire-and-forget 금지
Vercel은 `Response.json()` 반환 후 함수 종료. `.catch(console.error)` 만 달면 **SMS promise가 잘림 → 발송 안 됨**. sms_notifications 로그도 안 남음.

```ts
// ❌ 금지
notifyUser({...}).catch(console.error)

// ✅ 올바른
try { await notifyUser({...}) } catch (e) { console.error(e) }
```

**발견 경로**: "왜 SMS 안오지?" → DB 확인했더니 sms_notifications 테이블 비어있음 → promise 자체가 실행 안 됐다는 증거.

### 3. 클라이언트 Supabase singleton 세션 동기화 이슈
`getRawSupabaseClient()` 싱글톤이 간헐적으로 세션을 못 물어와서 RLS의 `id = auth.uid()` 가 매칭 안 됨. 결과:
- `getMyProfile` null 반환 → "프로필을 불러올 수 없습니다"
- `getProfiles` gender self-lookup 실패 → 성별 필터 누락 → **동성 프로필 노출** (심각)

**대응**: 세션 기반 본인 조회는 **모두 서버 API로** (`/api/me`, `/api/profiles` 등) — service_role 경유로 확실하게.

### 4. 필터는 fail-closed
조건부 필터 적용 금지:
```ts
// ❌ 위험
if (me?.gender) query = query.neq('gender', me.gender)
// self-lookup 실패하면 필터 빠짐 → 동성 노출

// ✅ 안전 (fail-closed)
if (!me?.gender) return []
query = query.neq('gender', me.gender)
```

### 5. `invite_codes.used_by` / `created_by` → `auth.users` 참조
PostgREST relationship syntax `profiles!invite_codes_used_by_fkey(*)` **400 Bad Request**. FK가 profiles가 아닌 auth.users를 가리킴.

```ts
// ❌ 금지
.select('used_by, invitee:profiles!invite_codes_used_by_fkey(*)')

// ✅ 2-step 쿼리
const { data: codes } = await supabase.from('invite_codes').select('used_by')...
const { data: profiles } = await supabase.from('profiles').select('*').in('id', codes.map(c => c.used_by))
```

### 6. `.single()` → 406 발생 가능
0 rows 반환 시 `.single()`은 PGRST116 에러 + HTTP 406. 본인 프로필 쿼리처럼 0 rows가 정상인 케이스에는 `.maybeSingle()` 사용 + 명시적 null 핸들링.

### 7. SMS dedup 설계 규칙
`sms_notifications` (user_id + template_key + reference_id + status='sent') 조합으로 중복 방지. 상태 번복 시:
- **승인 시**: 이전 approved + rejected 이력 **둘 다 삭제** (새 라운드)
- **거절 시**: 이전 approved 이력만 삭제, rejected dedup 유지 → **운영진+친구 양쪽 거절해도 1회만**
- **재승인/재거절**: 이력 삭제됐으니 dedup 통과 → 새로 발송

### 8. 양쪽 검증 시점에 SMS 발송
정책상 양쪽 검증이 끝나야 탐색 노출됨. SMS도 동일하게:
```ts
async function maybeNotifyFullyVerified(userId) {
  const { data } = await admin.from('profiles').select('is_verified, verified_by_referrer').eq('id', userId).single()
  if (data?.is_verified && data?.verified_by_referrer) {
    await notifyUser({ templateKey: 'profile_approved', referenceId: userId, ... })
  }
}
```
어느 쪽이 마지막이든 둘 다 true가 되는 순간 1회 발송 (dedup으로 보장).

### 9. `profile_approved` / `profile_rejected` 는 critical
정책상 야간 허용 X였지만, 검증 결과 피드백은 즉시 전달돼야 UX가 좋음. 초기 운영 편의상 `CRITICAL_TEMPLATES` 포함 → 24시간 발송.

### 10. SOLAPI_SENDER_NUMBER 자기 자신 발송 OK
발신자 `01051751360`. 같은 번호로 테스트해도 SMS 수신 됨. "왜 안 와?" 할 때 발신/수신 번호 중복보단 다른 원인 먼저 의심.

---

## 📁 주요 서버 API 라우트

| 라우트 | 용도 | 인증 |
|--------|------|------|
| `/api/me` | 본인 프로필 | user session |
| `/api/profiles` | 탐색 리스트 (성별/검증 필터) | user session |
| `/api/requests/send` | 요청 전송 + SMS #1 | user session |
| `/api/requests/accept` | 수락 + SMS #3 | user session |
| `/api/referral/verify` | 친구 검증 (RPC) + SMS trigger | user session |
| `/api/referral/payouts` | 레퍼럴 잔액/신청 | user session |
| `/api/admin/*` | 어드민 전용 | admin_session cookie |
| `/api/cron/*` | Vercel Cron | `x-cron-secret` 헤더 |

## 🗄 주요 테이블 (Phase 1 스키마)

- `profiles` — 본인 프로필 (is_verified, verified_by_referrer, rejection_reason, marketing_sms, bank_* 등)
- `dating_requests` — 요청 (expires_at generated, status enum 확장)
- `matches` — 매칭 (**payer_id 필수**, payment_expires_at, payment_status 4-state)
- `sms_notifications` — SMS 발송 이력 (dedup + 야간 로그)
- `referral_earnings` — 레퍼럴 수익 (FK on delete SET NULL로 이력 보존)
- `referral_payouts` — 지급 신청 (status: pending/approved/paid/rejected)
- `referral_verifications` — 친구 검증 감사 로그
- `request_quotas` — 일별 쿼터 스냅샷 (opt-in SMS 트래킹용)

## ⚙️ 환경변수

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — 서버 API service_role 사용
- `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`, `SOLAPI_SENDER_NUMBER` — SMS 발송
- `ADMIN_PASSWORD` — 어드민 로그인
- `CRON_SECRET` — Vercel Cron 인증

Vercel 대시보드에서 **All Environments** (Production + Preview + Development) 로 설정 필수.
