# 찐따노노 (jjindda-nono) QA 체크리스트

> 작성일: 2026-04-22
> 작성자: qa (팀 에이전트)
> 기준 문서:
> - `/Users/simgh/SecondBrain/1_Project/소개팅/20260422_찐따노노_정책정리.md`
> - `/Users/simgh/SecondBrain/1_Project/소개팅/20260422_찐따노노_알림정책.md`

본 체크리스트는 사용자가 **실제 기기/브라우저**에서 직접 검증해야 할 항목을 Phase별/화면별로 정리한 것. 자동 테스트로 커버되지 않는 수동 검증 포인트를 중심으로 작성됨.

---

## 사전 준비

- [ ] Vercel preview URL 확보 (또는 `npm run dev` 로컬 실행)
- [ ] 테스트 계정 2개 (요청자 A, 수신자 B) 준비
- [ ] 테스트 전화번호 2개 실제 SMS 수신 가능 (Solapi 비용 발생 주의)
- [ ] 어드민 계정 로그인 정보 확보
- [ ] Supabase 대시보드 접근 가능 (요청/매칭 레코드 직접 확인용)
- [ ] 테스트 시작 시각이 **매일 08:00 KST 리셋 타이머**를 피하는지 확인 (예: 07:30~08:30 직전/직후 테스트 시 요청권 리셋 이슈 주의)

---

## Phase 0 — 리네임 (jjinda → jjindda)

### 0.1 텍스트 검증
- [ ] 로그인 화면 타이틀/로고가 "찐따노노" 로 노출 (jjinda 잔재 없음)
- [ ] `<title>`, `<meta description>` 태그에 최신 브랜드명 반영
- [ ] 모든 SMS 문안에 `[찐따노노]` prefix 적용
- [ ] 약관/FAQ/이용안내 내부 링크에 구 브랜드명 없음
- [ ] 푸터/카피라이트 "© 2026 찐따노노" 등 업데이트

### 0.2 파일/경로
- [ ] 디렉토리명: `jjinda-nono` → `jjindda-nono` (Phase 0.5 인프라 포함 시)
- [ ] `package.json` name 필드 최신
- [ ] Vercel project 이름 / 도메인 연결 확인

---

## Phase 0.5 — 인프라 리네임 (선택적)

- [ ] Vercel 도메인 갱신 및 구 도메인 301 리다이렉트
- [ ] Supabase project slug (변경했다면) 확인
- [ ] `.env.production` / Vercel env에 신규 URL 반영
- [ ] GitHub repo rename 후 remote URL 재설정 확인

---

## Phase 1 — DB 스키마 + RPC

### 1.1 테이블 존재 확인 (Supabase SQL Editor 또는 Table Editor)
- [ ] `profiles` - 컬럼: `id, phone, real_name, nickname, gender, marketing_sms, last_active_at, onboarding_completed, is_verified, rejection_reason, bank_name, bank_account, bank_holder` 등
- [ ] `dating_requests` - 컬럼: `id, requester_id, target_id, status, created_at, expires_at` (status: pending/accepted/rejected/expired/cancelled)
- [ ] `matches` - 컬럼: `id, request_id, requester_id, target_id, payment_status, payment_expires_at, kakao_open_url`
- [ ] `invite_codes` - 컬럼: `code, created_by, used_by, verified_by_referrer, verified_by_admin`
- [ ] `referral_payouts` - 컬럼: `id, user_id, amount, status, bank_snapshot, requested_at`
- [ ] `sms_notifications` - 로깅 + 중복 방지용

### 1.2 RPC / 비즈니스 로직
- [ ] `create_dating_request(target_id)` — 하루 1개 한도 enforce
- [ ] `accept_dating_request(request_id)` — matches row 생성, payment_expires_at = now + 24h
- [ ] `reject_dating_request(request_id)` — status='rejected', 슬롯 해제
- [ ] `cancel_dating_request(request_id)` — 발신자 취소, 슬롯 해제
- [ ] `reset_daily_quota()` — 매일 08:00 KST 배치 (pg_cron)
- [ ] 요청권 카운터 로직: 기본 1 + 수신한 pending 수, 송+수 합산 3개 초과 시 블록

### 1.3 RLS (Row Level Security)
- [ ] 본인 `profiles` 만 UPDATE 가능
- [ ] 본인이 관여한 `dating_requests` 만 SELECT 가능
- [ ] 본인이 관여한 `matches` 만 SELECT 가능
- [ ] 어드민 서비스 role 우회 경로 확인

---

## Phase 2 — 타이머 + 요청권 UI

### 2.1 요청권 뱃지 (`/profiles` 탐색 화면)
- [ ] 상단에 "오늘 요청권 X/3" 형태 뱃지 노출
- [ ] 기본 상태: "1/3" (당일 송신 0건, 수신 0건)
- [ ] 수신 1건 있을 때: "2/3"
- [ ] 송신 1건 이미 보낸 상태: "0/3" 또는 "사용 가능 0"
- [ ] 동시 3개 모두 찬 경우: "요청권 소진" 배지 + 버튼 disabled
- [ ] 08:00 KST 전후 배지 자동 갱신 (새로고침 필요 여부 명시)

### 2.2 1차 타이머 — 수락 대기 (수신자 B 화면)
- [ ] `/requests` 목록 또는 `/requests/[id]` 상세에 카운트다운 노출
- [ ] 형식: "23:59:42" 또는 "23시간 59분" 가독성
- [ ] 만료 시점 초과 시 자동 "만료" 상태 전환 (새로고침 없이도)
- [ ] 만료된 요청: 수락/거절 버튼 비활성화, UI 색상 변경

### 2.3 2차 타이머 — 결제 대기 (요청자 A 화면)
- [ ] `/match/[id]/payment` (또는 요청자 쪽 매칭 화면)에 카운트다운 노출
- [ ] B가 수락한 직후 24:00:00 에서 시작
- [ ] 만료 시 "결제 시간 만료" 상태 + 다시 요청 가능
- [ ] 만료된 매칭은 B에게 알림 없음 (정책 확정 사항)

### 2.4 엣지 케이스
- [ ] 디바이스 시간 변경해도 서버 기준 타이머 정확 (클라이언트 시계 조작 방어)
- [ ] 새로고침 시 카운트다운 resume
- [ ] 백그라운드 탭 → 포그라운드 복귀 시 즉시 갱신

---

## Phase 3 — 7만원 결제 + 바로 수락하기

### 3.1 일반 결제 플로우 (A 결제)
- [ ] B 수락 직후 A에게 SMS #3 발송 + 인앱 배지
- [ ] A가 `/match/[id]/payment` 진입 시 이체 안내 노출
  - [ ] 금액 70,000원 명시
  - [ ] 입금 계좌 (심제혁 운영자 계좌) 명시
  - [ ] 입금자명 안내 (고유 식별 문자열 제공)
  - [ ] 복사 버튼 동작
- [ ] 이체 완료 후 "이체 완료 신고" 버튼 → 어드민 수동 확인 대기 상태 전환
- [ ] 관리자 승인 시 `payment_status='paid'` → 카톡방 URL 공개
- [ ] 결제 24h 미완료 시 자동 만료 배치 동작

### 3.2 "바로 수락하기" (B 즉시 결제)
- [ ] B 수신 화면에 "바로 수락하기" 버튼 별도 제공 (일반 수락과 분리)
- [ ] 클릭 시 A가 아닌 **B가** 결제 플로우로 진입
- [ ] 결제 금액/계좌 동일
- [ ] 결제 완료 즉시 카톡방 오픈 (A의 결제 대기 스텝 skip)
- [ ] **정책 검증**: "바로 수락하기는 결제 24h 타이머 내에서만 가능" — 일반 수락 후 24h 지난 상태에서 B가 바로 결제 전환 가능한지 확인

### 3.3 카톡방 오픈
- [ ] `matches.kakao_open_url` 어드민이 수동 입력 가능
- [ ] A, B 양측에 SMS #5 발송 (`/match/[id]/kakao` 딥링크)
- [ ] 링크 클릭 → 실제 오픈카톡방으로 redirect 동작

---

## Phase 4 — 프로필 2단계 검증

### 4.1 레퍼럴 친구 검증 (`/my` 탭 내 검증 섹션)
- [ ] 내가 레퍼럴한 친구 목록 노출
- [ ] 각 친구 프로필 상세 진입 가능
- [ ] "검증 완료" / "반려" 버튼 동작
- [ ] 검증 완료 시 `invite_codes.verified_by_referrer=true`
- [ ] 검증 전 친구는 탐색(`/profiles`)에 노출되지 않음
- [ ] SMS #8 (레퍼럴한 친구 가입) 수신 확인
- [ ] SMS #9 (24h 후 미검증 시 리마인더) 수신 확인

### 4.2 어드민 운영진 심사 (`/admin/users`)
- [ ] 심사 대기 유저 목록 조회
- [ ] 프로필 상세 (사진/닉네임/성별/실명/전화) 열람
- [ ] 승인 버튼: `is_verified=true`, SMS #6 발송
- [ ] 반려 버튼: 사유 입력 → `rejection_reason` 저장, SMS #7 발송
- [ ] 반려 유저가 `/my/edit` 에서 사유 확인 + 재제출 가능

---

## Phase 5 — 레퍼럴 지급 신청

### 5.1 프로필 탭 은행 정보
- [ ] `/my` 또는 `/my/edit` 에 은행 정보 섹션
- [ ] 은행명, 계좌번호, 예금주 입력
- [ ] 저장 후 마스킹 노출 (예: 국민 `****1234`)

### 5.2 적립 이력
- [ ] 내가 레퍼럴한 친구들 + 지급 대상 여부 리스트
- [ ] 성별별 단가 표시: 남자 5,000 / 여자 15,000
- [ ] 합계 적립 금액 노출

### 5.3 지급 신청
- [ ] "지급 신청" 버튼 동작 → `referral_payouts` row 생성 (`status='requested'`)
- [ ] 은행 정보 미입력 시 신청 막힘
- [ ] 신청 후 재신청 중복 방지
- [ ] 어드민 `/admin/payments` 에서 승인/반려 처리
- [ ] 승인 완료 시 SMS #10 발송

---

## Phase 6 — SMS 알림 시스템

### 6.1 매칭 플로우 Critical SMS
- [ ] #1 요청 수신 (B에게) — 즉시
- [ ] #2 수락 만료 1h 전 (B) — 23시간 경과 시점
- [ ] #3 수락 완료 (A에게) — 즉시
- [ ] #4 결제 만료 1h 전 (A) — 23시간 경과 시점
- [ ] #5 카톡방 오픈 (A, B 양측) — 즉시

### 6.2 검증/가입 SMS
- [ ] #6 프로필 승인 (가입자)
- [ ] #7 프로필 반려 (가입자)
- [ ] #8 레퍼럴 친구 가입 (레퍼럴 유저)
- [ ] #9 프로필 검증 대기 (레퍼럴 유저, D+1)
- [ ] #10 레퍼럴 지급 완료 (신청자)

### 6.3 발송 금지 (발송 안 되는 것 확인)
- [ ] #13 요청 거절/만료 → A에게 SMS 안 보내짐 (인앱 배지만)
- [ ] #14 결제 만료 → B에게 SMS 안 보내짐

### 6.4 가드 & 안정성
- [ ] 야간 가드 22:00 ~ 08:00 사이 non-critical SMS 발송 차단
- [ ] 크리티컬 SMS (#2, #4) 는 야간에도 발송됨
- [ ] 같은 user_id + template_key + reference_id 조합 중복 발송 차단
- [ ] `sms_notifications` 테이블에 발송 이력 전부 기록됨
- [ ] Solapi 실패 시 `status='failed'` + `error` 로깅
- [ ] 딥링크가 실제 딥링크 구조로 동작 (`/requests/{id}`, `/match/{id}/payment`, `/match/{id}/kakao`)
- [ ] [광고] prefix는 #11 opt-in 마케팅 SMS에만 적용 (critical은 정보성 → prefix 불필요)

### 6.5 opt-in 마케팅 SMS
- [ ] `/my/edit` 에 "알림 수신 동의" 토글 (기본 OFF)
- [ ] #11 08:00 리셋 알림이 opt-in 한 유저에게만 발송
- [ ] opt-out 후 즉시 반영

---

## Phase 7 — 빌드/배포 종합

### 7.1 빌드
- [ ] `npm run build` 경고 없이 성공
- [ ] TypeScript 컴파일 에러 0
- [ ] ESLint 에러 0 (경고는 허용)

### 7.2 Vercel 배포
- [ ] production 배포 상태 "Ready"
- [ ] 커스텀 도메인 HTTPS 인증서 유효
- [ ] 환경 변수 모두 세팅됨
  - [ ] `NEXT_PUBLIC_SUPABASE_URL`
  - [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - [ ] `SUPABASE_SERVICE_ROLE_KEY`
  - [ ] `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`, `SOLAPI_SENDER`
  - [ ] 기타 도메인/시크릿

### 7.3 Supabase migration
- [ ] 모든 migration 파일 production DB에 적용 완료
  - [ ] `20260413000000_initial_schema.sql`
  - [ ] `20260414000000_phone_otps.sql`
  - [ ] `20260414000001_add_real_name.sql`
  - [ ] Phase 1 신규 migration (요청/매칭/SMS 테이블)
- [ ] pg_cron job 등록: `reset_daily_quota()` 매일 08:00 KST
- [ ] pg_cron job 등록: `expire_pending_requests()`, `expire_pending_payments()` (10분마다)

---

## 크리티컬 엣지 케이스 (반드시 실제 기기 테스트)

### E.1 요청권 한도 경계
- [ ] A가 하루 요청 1건 이미 보낸 상태 + B로부터 수신 1건 → 보너스로 추가 1건 가능, 총 2건 송신
- [ ] A가 송신 1 + 수신 1 + 이미 매칭 진행 중 1 = 3건 → 4번째 송신 시도 시 에러 메시지 명확
- [ ] B가 수신 3건 찬 상태 → 새 요청 수신 시 어떤 동작? (정책: 받을 수 없음 → 발신자 A에게 뭐라고 표시?)
- [ ] 거절 시 슬롯 즉시 해제, 새 요청 받기 가능
- [ ] 취소 시 슬롯 즉시 해제

### E.2 08:00 KST 리셋
- [ ] 07:59 에 송신 1건 사용 완료 → 08:00 에 뱃지가 "1/3" 으로 자동 리셋
- [ ] 리셋 시 **기존 pending 요청은 남아있고** 송신권만 초기화 됨 확인
- [ ] 수신 보너스도 같이 리셋되는지 확인 (정책: 모두 초기화, 기본 1개로)

### E.3 24h 타이머 경계
- [ ] 수락 23:59:59 에 수락 → 정상 매칭 성사
- [ ] 수락 24:00:01 에 수락 시도 → 거절됨 (이미 만료)
- [ ] 결제 23h 시점 리마인더 SMS 정확히 1회만
- [ ] 결제 완료 후 타이머 정지

### E.4 동시성
- [ ] A, B 둘 다 동시에 수락/거절 탭 → race condition 없음
- [ ] 동일 요청 중복 수락 시도 → 한쪽만 성공
- [ ] 매칭 성사 직후 "바로 수락하기" 재시도 → 이미 진행 중 에러

### E.5 권한
- [ ] 로그아웃 상태에서 `/profiles`, `/requests` 직접 접근 → 로그인 리다이렉트
- [ ] 미인증 (프로필 심사 대기) 유저가 `/profiles` 진입 가능 여부 정책 확인
- [ ] 다른 유저의 match_id 직접 URL 접근 → 403/404

### E.6 브라우저/기기 호환
- [ ] iOS Safari 최신: 카운트다운 정상 동작 (Date.now 계산 정확)
- [ ] Android Chrome 최신
- [ ] 데스크톱 Chrome/Firefox/Edge
- [ ] 모바일 뷰포트 320px (iPhone SE) 레이아웃 깨짐 없음

---

## Solapi 발송 확인 (비용 주의)

테스트 시 Solapi 실제 발송이 일어나므로 **소액 크레딧 충전 상태로 제한된 시나리오만** 돌릴 것. 더미/스테이징 번호 사용 권장.

- [ ] Solapi 콘솔 발송 이력에서 각 template_key 최소 1건 이상 확인
- [ ] `sms_notifications` 테이블 row 수 = Solapi 콘솔 발송 수 (일치)
- [ ] 실패 케이스 (존재하지 않는 번호) 처리 확인: `status='failed'` 기록, 유저 플로우는 계속 진행

---

## 어드민 플로우

- [ ] `/admin/login` 일반 유저 계정으로 접근 시 차단
- [ ] `/admin/users` 심사 대기 필터
- [ ] `/admin/requests` 만료 예정 모니터링
- [ ] `/admin/matches` 결제 확인 대기 리스트
- [ ] `/admin/payments` 레퍼럴 지급 신청 큐
- [ ] `/admin/invite-codes` 초대 코드 발급

---

## 최종 스모크 테스트 (프로덕션 직후 5분)

1. [ ] 로그인 (OTP 수신 → 입력 → 성공)
2. [ ] 프로필 편집 1회
3. [ ] 다른 유저 탐색 + 요청 1건 전송 (테스트 계정 간)
4. [ ] 상대 계정 전환 후 수신 확인 + 수락
5. [ ] 요청자 계정 복귀 후 결제 페이지 진입 (결제 완료까지는 생략 가능)
6. [ ] SMS 수신 확인 (#1, #3)
7. [ ] 로그아웃

---

## 알려진 정책 미해결 포인트 (구현 시 재확인 필요)

- 결제 만료 시 A(결제자)에게 SMS 발송 여부 → 정책 문서는 "일단 인앱만, CS 민원 보고 결정"
- 동시 3개 한도가 찬 상태에서 A가 B에게 요청 시도 시 UI 문구
- 여러 요청 수신 시 "수신 보너스" 이 여러 건 쌓이는지 (정책: "받은 요청 수만큼" 이라고 명시)
- 요청 **취소** 가능 여부 및 UI 위치

위 포인트는 실제 기기 검증 시 사용자 기대치와 실제 동작이 다르면 team-lead에게 리포트할 것.

---

_본 문서는 초기 버전이며, 실제 Phase별 구현이 완료됨에 따라 해당 섹션 체크박스를 채워나가 주세요._
