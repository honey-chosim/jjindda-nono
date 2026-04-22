-- ============================================================
-- Phase 1: 찐따노노 정책 반영 - DB 스키마 + RPC 확장
--
-- 적용 정책:
-- - 송신 + 수신 합산 동시 active 최대 3개
-- - 기본 송신권 1 + 수신 보너스 (받은 요청 수) — 08:00 KST 기준 일일 리셋
-- - 요청 수락 대기 24h / 결제 대기 24h 타이머
-- - 결제는 수동 이체 확인: pending → pending_confirmation → paid (admin) / expired
-- - partial unique: active(pending/accepted) 상태에서만 (requester, target) 유일
-- - 거절/만료/cancelled_unpaid 상태에선 재요청 허용
-- - SMS 발송 이력 로깅 + opt-in 플래그
-- - 레퍼럴 지급 신청 (수동 처리)
-- - 프로필 검증 2단계: 레퍼럴 친구 승인 + 운영진 최종 승인
-- ============================================================

-- ============================================================
-- 1. PROFILES 컬럼 추가
-- ============================================================

alter table profiles
  add column if not exists is_verified boolean not null default false,
  add column if not exists verified_by_referrer boolean not null default false,
  add column if not exists rejection_reason text,
  add column if not exists marketing_sms boolean not null default false,
  add column if not exists last_active_at timestamptz,
  add column if not exists bank_name text,
  add column if not exists bank_account text,
  add column if not exists account_holder text;

comment on column profiles.is_verified is 'Operator (admin) final approval';
comment on column profiles.verified_by_referrer is 'Referrer-friend approval (first-stage verification)';
comment on column profiles.rejection_reason is 'Rejection reason shown in SMS #7 and /my/edit';
comment on column profiles.marketing_sms is 'Opt-in flag for non-critical SMS (#11 daily reset alert, #12 dormant resummon)';
comment on column profiles.last_active_at is 'Last session/activity. Used by dormant-resummon cron.';

create index if not exists idx_profiles_is_verified on profiles(is_verified);
create index if not exists idx_profiles_last_active on profiles(last_active_at);

-- ============================================================
-- 2. DATING_REQUESTS — status enum 확장, expires_at, partial unique
-- ============================================================

-- Add expires_at (24h acceptance timer); backfill existing rows to now+24h (safe for fresh data)
alter table dating_requests
  add column if not exists expires_at timestamptz not null default (now() + interval '24 hours');

create index if not exists idx_dating_requests_expires_at on dating_requests(expires_at);

-- Expand status enum: add 'cancelled' (by requester) + 'cancelled_unpaid' (auto when payment expires)
alter table dating_requests drop constraint if exists dating_requests_status_check;
alter table dating_requests add constraint dating_requests_status_check
  check (status in ('pending', 'accepted', 'rejected', 'expired', 'cancelled', 'cancelled_unpaid'));

-- Replace total-unique with partial-unique (only active slots blocked)
alter table dating_requests drop constraint if exists dating_requests_requester_id_target_id_key;

create unique index if not exists dating_requests_active_unique
  on dating_requests (requester_id, target_id)
  where status in ('pending', 'accepted');

-- ============================================================
-- 3. MATCHES — payment_status 4-state, payment_expires_at, paid_at, kakao_room_url
-- ============================================================

-- Expand payment_status to 4 states: pending → pending_confirmation → paid / expired
alter table matches drop constraint if exists matches_payment_status_check;
alter table matches add constraint matches_payment_status_check
  check (payment_status in ('pending', 'pending_confirmation', 'paid', 'expired'));

alter table matches
  add column if not exists payment_expires_at timestamptz,
  add column if not exists paid_at timestamptz,
  add column if not exists kakao_room_url text,
  add column if not exists payment_confirmed_at timestamptz;

comment on column matches.payment_expires_at is 'Set at match creation (accept RPC) to now()+24h. Used by expire-payments cron.';
comment on column matches.payment_confirmed_at is 'When user clicked "이체 완료" (status -> pending_confirmation)';
comment on column matches.paid_at is 'When admin confirmed payment (status -> paid)';

create index if not exists idx_matches_payment_status on matches(payment_status);
create index if not exists idx_matches_payment_expires_at on matches(payment_expires_at);

-- ============================================================
-- 4. REQUEST_QUOTAS — 송신권 스냅샷 (08:00 KST 기준)
-- ============================================================

-- Quota 계산은 실시간이지만, 스냅샷 기록으로 opt-in #11 알림 발송 대상 추적 + 분석 용도
create table if not exists request_quotas (
  user_id uuid not null references profiles(id) on delete cascade,
  quota_date date not null,               -- KST 08:00 기준 날짜
  sent_count integer not null default 0,  -- 해당 쿼터 기간 내 송신 수
  received_count integer not null default 0,  -- 수신 수 (보너스 산출용)
  bonus_used integer not null default 0,  -- 소모된 보너스 수
  created_at timestamptz not null default now(),
  primary key (user_id, quota_date)
);

create index if not exists idx_request_quotas_date on request_quotas(quota_date);

alter table request_quotas enable row level security;

create policy "Users can view own quota"
  on request_quotas for select
  to authenticated
  using (user_id = auth.uid());

-- No direct client-side insert/update; managed by RPCs only (service_role bypasses RLS)

-- ============================================================
-- 5. SMS_NOTIFICATIONS — 발송 이력 + 중복 방지
-- ============================================================

create table if not exists sms_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  template_key text not null,       -- 'request_received', 'payment_reminder', ...
  reference_id uuid,                -- dating_request_id / match_id / invitee_id 등
  phone text not null,
  message text not null,
  sent_at timestamptz not null default now(),
  solapi_message_id text,
  status text not null default 'sent' check (status in ('sent', 'failed', 'skipped_night', 'skipped_duplicate')),
  error text
);

create index if not exists idx_sms_user_template_ref
  on sms_notifications(user_id, template_key, reference_id);
create index if not exists idx_sms_sent_at on sms_notifications(sent_at);

alter table sms_notifications enable row level security;

-- Only service_role writes; users may see their own history for transparency
create policy "Users can view own sms history"
  on sms_notifications for select
  to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- 6. REFERRAL_PAYOUTS — 레퍼럴 지급 신청
-- ============================================================

create table if not exists referral_payouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  amount_requested integer not null,
  bank_name text not null,
  bank_account text not null,
  account_holder text not null,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'paid', 'rejected')),
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  admin_note text
);

create index if not exists idx_referral_payouts_user on referral_payouts(user_id);
create index if not exists idx_referral_payouts_status on referral_payouts(status);

alter table referral_payouts enable row level security;

create policy "Users can view own payout requests"
  on referral_payouts for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can create own payout request"
  on referral_payouts for insert
  to authenticated
  with check (user_id = auth.uid());

-- No user-side updates; admin (service_role) only

-- ============================================================
-- 7. REFERRAL_EARNINGS — invitee당 1회 적립 (append-only)
-- ============================================================

-- 레퍼럴한 유저가 가입 완료(onboarding + verified) 시점에 append.
-- 단가는 invitee gender 기준 계산 (남 5k, 여 15k).
create table if not exists referral_earnings (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references profiles(id) on delete cascade,
  invitee_id uuid not null references profiles(id) on delete cascade,
  invitee_gender text not null check (invitee_gender in ('male', 'female')),
  amount integer not null,           -- 5000 or 15000
  earned_at timestamptz not null default now(),
  paid_payout_id uuid references referral_payouts(id) on delete set null,
  unique (referrer_id, invitee_id)   -- invitee 한 명당 1회만 적립
);

create index if not exists idx_referral_earnings_referrer on referral_earnings(referrer_id);
create index if not exists idx_referral_earnings_payout on referral_earnings(paid_payout_id);

alter table referral_earnings enable row level security;

create policy "Users can view own earnings"
  on referral_earnings for select
  to authenticated
  using (referrer_id = auth.uid());

-- ============================================================
-- 8. HELPER FUNCTIONS (timezone-aware)
-- ============================================================

-- Returns the current KST quota_date: day flips at 08:00 KST (before 08:00 KST = yesterday)
create or replace function current_quota_date()
returns date
language sql
stable
as $$
  select case
    when (now() at time zone 'Asia/Seoul') >= date_trunc('day', now() at time zone 'Asia/Seoul') + interval '8 hours'
    then (now() at time zone 'Asia/Seoul')::date
    else ((now() at time zone 'Asia/Seoul') - interval '1 day')::date
  end;
$$;

comment on function current_quota_date is 'Returns quota date boundary — flips at 08:00 KST';

-- ============================================================
-- 9. RPC: send_dating_request (리팩터)
-- ============================================================

create or replace function send_dating_request(
  p_requester_id uuid,
  p_target_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_request_id uuid;
  v_quota_date date;
  v_active_slots int;
  v_sent_today int;
  v_received_today int;
  v_send_limit int;
  v_duplicate_active int;
begin
  -- 1. Auth check
  if auth.uid() is distinct from p_requester_id then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  if p_requester_id = p_target_id then
    raise exception 'Cannot request yourself' using errcode = '22023';
  end if;

  v_quota_date := current_quota_date();

  -- 2. 송신 + 수신 합산 active 슬롯 체크 (정책: max 3)
  -- active = pending OR (accepted AND payment_status in ('pending','pending_confirmation'))
  select count(*)
  into v_active_slots
  from dating_requests dr
  left join matches m on m.request_id = dr.id
  where (dr.requester_id = p_requester_id or dr.target_id = p_requester_id)
    and (
      dr.status = 'pending'
      or (dr.status = 'accepted' and (m.payment_status is null or m.payment_status in ('pending', 'pending_confirmation')))
    );

  if v_active_slots >= 3 then
    raise exception 'Active slot limit reached (3)' using errcode = 'P0001';
  end if;

  -- 3. 이미 해당 target에게 active 요청이 있으면 거부 (partial unique index와 중복 방지)
  select count(*)
  into v_duplicate_active
  from dating_requests
  where requester_id = p_requester_id
    and target_id = p_target_id
    and status in ('pending', 'accepted');

  if v_duplicate_active > 0 then
    raise exception 'Active request to this target already exists' using errcode = '23505';
  end if;

  -- 4. 송신 한도 계산: 기본 1 + 수신 보너스(오늘 받은 요청 수) - 이미 오늘 보낸 수
  select coalesce(sum(case when dr.requester_id = p_requester_id then 1 else 0 end), 0),
         coalesce(sum(case when dr.target_id    = p_requester_id then 1 else 0 end), 0)
  into v_sent_today, v_received_today
  from dating_requests dr
  where (dr.requester_id = p_requester_id or dr.target_id = p_requester_id)
    and dr.created_at >= ((v_quota_date::timestamp + interval '8 hours') at time zone 'Asia/Seoul');

  v_send_limit := 1 + v_received_today;

  if v_sent_today >= v_send_limit then
    raise exception 'Daily send quota exhausted' using errcode = 'P0002';
  end if;

  -- 5. 요청 insert (expires_at 기본값 24h)
  insert into dating_requests (requester_id, target_id, status, expires_at)
  values (p_requester_id, p_target_id, 'pending', now() + interval '24 hours')
  returning id into v_request_id;

  -- 6. quota 스냅샷 upsert
  insert into request_quotas (user_id, quota_date, sent_count, received_count)
  values (p_requester_id, v_quota_date, v_sent_today + 1, v_received_today)
  on conflict (user_id, quota_date)
  do update set sent_count = excluded.sent_count;

  return v_request_id;
end;
$$;

grant execute on function send_dating_request(uuid, uuid) to authenticated;

-- ============================================================
-- 10. RPC: accept_dating_request (리팩터) — payment_expires_at 세팅
-- ============================================================

create or replace function accept_dating_request(
  p_request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match_id uuid;
  v_requester_id uuid;
  v_target_id uuid;
  v_status text;
  v_expires_at timestamptz;
begin
  select requester_id, target_id, status, expires_at
  into v_requester_id, v_target_id, v_status, v_expires_at
  from dating_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found' using errcode = 'P0003';
  end if;

  if auth.uid() is distinct from v_target_id then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  if v_status <> 'pending' then
    raise exception 'Request is not pending (status=%)', v_status using errcode = 'P0004';
  end if;

  if v_expires_at <= now() then
    raise exception 'Request expired' using errcode = 'P0005';
  end if;

  update dating_requests
  set status = 'accepted'
  where id = p_request_id;

  insert into matches (request_id, user1_id, user2_id, payment_status, payment_expires_at)
  values (p_request_id, v_requester_id, v_target_id, 'pending', now() + interval '24 hours')
  on conflict (request_id) do update
    set payment_expires_at = coalesce(matches.payment_expires_at, excluded.payment_expires_at)
  returning id into v_match_id;

  return v_match_id;
end;
$$;

grant execute on function accept_dating_request(uuid) to authenticated;

-- ============================================================
-- 11. RPC: cancel_dating_request — 요청자가 본인 요청 취소
-- ============================================================

create or replace function cancel_dating_request(
  p_request_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_requester_id uuid;
  v_status text;
begin
  select requester_id, status
  into v_requester_id, v_status
  from dating_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found' using errcode = 'P0003';
  end if;

  if auth.uid() is distinct from v_requester_id then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  if v_status <> 'pending' then
    raise exception 'Only pending requests can be cancelled' using errcode = 'P0004';
  end if;

  update dating_requests
  set status = 'cancelled'
  where id = p_request_id;
end;
$$;

grant execute on function cancel_dating_request(uuid) to authenticated;

-- ============================================================
-- 12. RPC: instant_accept_match — "바로 수락하기" (B가 결제도 함께 트리거)
-- ============================================================

-- B가 바로 수락 + 이체 완료 플래그까지 한 번에 (결제 자체는 별도 /payment 플로우에서 이체 안내됨)
create or replace function instant_accept_match(
  p_request_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match_id uuid;
  v_requester_id uuid;
  v_target_id uuid;
  v_status text;
  v_expires_at timestamptz;
begin
  select requester_id, target_id, status, expires_at
  into v_requester_id, v_target_id, v_status, v_expires_at
  from dating_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Request not found' using errcode = 'P0003';
  end if;

  if auth.uid() is distinct from v_target_id then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  if v_status <> 'pending' then
    raise exception 'Request is not pending' using errcode = 'P0004';
  end if;

  if v_expires_at <= now() then
    raise exception 'Request expired' using errcode = 'P0005';
  end if;

  update dating_requests
  set status = 'accepted'
  where id = p_request_id;

  -- B가 바로 수락 → 결제자 역할도 B. payer_id 컬럼 필요할 수 있으나 일단 matches에 플래그만.
  insert into matches (request_id, user1_id, user2_id, payment_status, payment_expires_at)
  values (p_request_id, v_requester_id, v_target_id, 'pending', now() + interval '24 hours')
  on conflict (request_id) do update
    set payment_expires_at = coalesce(matches.payment_expires_at, excluded.payment_expires_at)
  returning id into v_match_id;

  return v_match_id;
end;
$$;

grant execute on function instant_accept_match(uuid) to authenticated;

-- ============================================================
-- 13. RPC: confirm_payment — 유저가 "이체 완료" 클릭
-- ============================================================

create or replace function confirm_payment_transfer(
  p_match_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user1 uuid;
  v_user2 uuid;
  v_status text;
begin
  select user1_id, user2_id, payment_status
  into v_user1, v_user2, v_status
  from matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'Match not found' using errcode = 'P0003';
  end if;

  if auth.uid() is distinct from v_user1 and auth.uid() is distinct from v_user2 then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  if v_status <> 'pending' then
    raise exception 'Match not in pending payment state' using errcode = 'P0004';
  end if;

  update matches
  set payment_status = 'pending_confirmation',
      payment_confirmed_at = now()
  where id = p_match_id;
end;
$$;

grant execute on function confirm_payment_transfer(uuid) to authenticated;

-- ============================================================
-- 14. RPC: admin_mark_payment_paid — 어드민이 입금 확인 후 paid
-- ============================================================

-- 어드민 전용 — service_role로 호출. authenticated는 admin UI 인증 레이어에서 차단.
create or replace function admin_mark_payment_paid(
  p_match_id uuid,
  p_kakao_room_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update matches
  set payment_status = 'paid',
      paid_at = now(),
      kakao_room_url = coalesce(p_kakao_room_url, kakao_room_url),
      kakao_group_created = case when p_kakao_room_url is not null then true else kakao_group_created end
  where id = p_match_id
    and payment_status in ('pending', 'pending_confirmation');

  if not found then
    raise exception 'Match not found or already paid' using errcode = 'P0003';
  end if;
end;
$$;

-- Only service_role can execute (admin-only)
revoke all on function admin_mark_payment_paid(uuid, text) from public, authenticated;
grant execute on function admin_mark_payment_paid(uuid, text) to service_role;

-- ============================================================
-- 15. RPC: expire_requests — 24h 수락 대기 만료 (cron)
-- ============================================================

create or replace function expire_pending_requests()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  update dating_requests
  set status = 'expired'
  where status = 'pending'
    and expires_at <= now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function expire_pending_requests() to service_role;

-- ============================================================
-- 16. RPC: expire_payments — 24h 결제 대기 만료 (cron)
--   → match.payment_status = 'expired' + dating_requests.status = 'cancelled_unpaid'
-- ============================================================

create or replace function expire_pending_payments()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
begin
  with expired as (
    update matches m
    set payment_status = 'expired'
    where m.payment_status in ('pending', 'pending_confirmation')
      and m.payment_expires_at is not null
      and m.payment_expires_at <= now()
    returning m.request_id
  )
  update dating_requests dr
  set status = 'cancelled_unpaid'
  from expired
  where dr.id = expired.request_id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function expire_pending_payments() to service_role;

-- ============================================================
-- 17. TRIGGER: received-bonus quota 갱신
--   dating_requests insert 시 target의 received_count 증가 (quota 스냅샷)
-- ============================================================

create or replace function trg_dating_request_received_bonus()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_quota_date date := current_quota_date();
begin
  if tg_op = 'INSERT' then
    insert into request_quotas (user_id, quota_date, sent_count, received_count)
    values (new.target_id, v_quota_date, 0, 1)
    on conflict (user_id, quota_date) do update
      set received_count = request_quotas.received_count + 1;
  end if;
  return new;
end;
$$;

drop trigger if exists dating_requests_received_bonus on dating_requests;
create trigger dating_requests_received_bonus
  after insert on dating_requests
  for each row execute function trg_dating_request_received_bonus();

-- ============================================================
-- 18. RPC: reset_daily_quotas — 08:00 KST 스냅샷 + opt-in SMS 대상 조회
-- ============================================================

create or replace function reset_daily_quotas()
returns table(user_id uuid, phone text, marketing_sms boolean)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 실제 쿼터는 실시간 계산이라 reset 자체는 no-op.
  -- 단, opt-in 유저 phone 리스트를 반환해서 Vercel Cron이 SMS 발송하도록 함.
  return query
    select p.id, p.phone, p.marketing_sms
    from profiles p
    where p.marketing_sms = true
      and p.is_active = true
      and p.is_verified = true
      and p.phone is not null;
end;
$$;

grant execute on function reset_daily_quotas() to service_role;

-- ============================================================
-- 19. RPC: list_reminder_request_targets — 수락 대기 1h 전 알림 대상
-- ============================================================

create or replace function list_pending_request_reminders()
returns table(request_id uuid, target_user_id uuid, target_phone text, requester_name text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select dr.id, dr.target_id, t.phone, r.name, dr.expires_at
    from dating_requests dr
    join profiles t on t.id = dr.target_id
    join profiles r on r.id = dr.requester_id
    where dr.status = 'pending'
      and dr.expires_at > now()
      and dr.expires_at <= now() + interval '1 hour'
      and t.phone is not null
      -- Exclude users already notified for this reference_id + template
      and not exists (
        select 1 from sms_notifications sn
        where sn.user_id = dr.target_id
          and sn.template_key = 'request_expiry_reminder'
          and sn.reference_id = dr.id
      );
end;
$$;

grant execute on function list_pending_request_reminders() to service_role;

-- ============================================================
-- 20. RPC: list_reminder_payment_targets — 결제 대기 1h 전 알림 대상
-- ============================================================

create or replace function list_pending_payment_reminders()
returns table(match_id uuid, payer_id uuid, payer_phone text, other_name text, payment_expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 현재는 요청자(user1)가 결제자. 향후 instant_accept 플래그로 B가 결제자일 수도 있으나 일단 A 고정.
  return query
    select m.id, m.user1_id, p1.phone, p2.name, m.payment_expires_at
    from matches m
    join profiles p1 on p1.id = m.user1_id
    join profiles p2 on p2.id = m.user2_id
    where m.payment_status = 'pending'
      and m.payment_expires_at > now()
      and m.payment_expires_at <= now() + interval '1 hour'
      and p1.phone is not null
      and not exists (
        select 1 from sms_notifications sn
        where sn.user_id = m.user1_id
          and sn.template_key = 'payment_expiry_reminder'
          and sn.reference_id = m.id
      );
end;
$$;

grant execute on function list_pending_payment_reminders() to service_role;

-- ============================================================
-- 21. RPC: verify_referral_profile — 레퍼럴 친구가 프로필 승인
-- ============================================================

create or replace function verify_referral_profile(
  p_invitee_id uuid,
  p_approved boolean,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer_id uuid;
  v_invitee_gender text;
  v_amount int;
begin
  -- Caller must be the referrer (invite_codes.created_by = auth.uid() AND used_by = invitee)
  select ic.created_by
  into v_referrer_id
  from invite_codes ic
  where ic.used_by = p_invitee_id
  limit 1;

  if v_referrer_id is null or auth.uid() is distinct from v_referrer_id then
    raise exception 'Unauthorized — not the referrer of this invitee' using errcode = '42501';
  end if;

  if p_approved then
    update profiles
    set verified_by_referrer = true,
        rejection_reason = null
    where id = p_invitee_id;

    -- Note: referral_earnings는 운영진 최종 승인(is_verified=true) 시점에 append.
    -- 여기선 verified_by_referrer만 세팅.
  else
    update profiles
    set verified_by_referrer = false,
        rejection_reason = coalesce(p_note, '레퍼럴 친구가 프로필을 반려했어요.')
    where id = p_invitee_id;
  end if;
end;
$$;

grant execute on function verify_referral_profile(uuid, boolean, text) to authenticated;

-- ============================================================
-- 22. RPC: admin_verify_profile — 운영진 최종 승인 → referral_earnings append
-- ============================================================

create or replace function admin_verify_profile(
  p_user_id uuid,
  p_approved boolean,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_gender text;
  v_referrer uuid;
  v_amount int;
begin
  if p_approved then
    update profiles
    set is_verified = true,
        rejection_reason = null
    where id = p_user_id
    returning gender into v_gender;

    -- 레퍼럴 적립: invitee 기준 gender 단가
    select ic.created_by
    into v_referrer
    from invite_codes ic
    where ic.used_by = p_user_id
    limit 1;

    if v_referrer is not null and v_gender is not null then
      v_amount := case when v_gender = 'male' then 5000 else 15000 end;

      insert into referral_earnings (referrer_id, invitee_id, invitee_gender, amount)
      values (v_referrer, p_user_id, v_gender, v_amount)
      on conflict (referrer_id, invitee_id) do nothing;
    end if;
  else
    update profiles
    set is_verified = false,
        rejection_reason = coalesce(p_reason, '프로필 보완이 필요해요.')
    where id = p_user_id;
  end if;
end;
$$;

revoke all on function admin_verify_profile(uuid, boolean, text) from public, authenticated;
grant execute on function admin_verify_profile(uuid, boolean, text) to service_role;

-- ============================================================
-- 23. BACKFILL — 기존 matches에 payment_expires_at 채우기
-- ============================================================

update matches
set payment_expires_at = created_at + interval '24 hours'
where payment_expires_at is null;

-- ============================================================
-- DONE
-- ============================================================
