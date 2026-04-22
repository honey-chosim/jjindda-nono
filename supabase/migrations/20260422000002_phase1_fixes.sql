-- ============================================================
-- Phase 1 fixes (reviewer PR #2 feedback)
--
-- Critical:
--   #1 KST quota filter: replace 'at time zone' misuse with explicit +09 literal
--   #2 matches.payer_id column + confirm_payment_transfer permission
--   #3 legacy sendDatingRequest routed through v2 RPC (TS-side; SQL no-op here)
--
-- Important:
--   #4 list_pending_payment_reminders uses payer_id
--   #5 quota upsert: drop received_count from send RPC (trigger owns it)
--   #6 referral_earnings FK: cascade → set null (preserve payout history)
--   #7 admin payment_status transition whitelist (app-side; see api/admin/matches/[id])
-- ============================================================

-- ============================================================
-- #2+#4 — matches.payer_id column
-- ============================================================

alter table matches
  add column if not exists payer_id uuid references profiles(id) on delete cascade;

-- Backfill existing matches: payer = requester (user1) by default
update matches
set payer_id = user1_id
where payer_id is null;

-- Going forward, payer_id required for new rows
alter table matches
  alter column payer_id set not null;

comment on column matches.payer_id is 'Who is responsible for paying. Default=user1 (requester). For instant_accept_match, payer=target (user2).';

create index if not exists idx_matches_payer_id on matches(payer_id);

-- ============================================================
-- #6 — referral_earnings FK cascade → set null
-- ============================================================

-- Drop cascade FKs and recreate as set null so earnings history survives user deletion
alter table referral_earnings
  drop constraint if exists referral_earnings_referrer_id_fkey,
  drop constraint if exists referral_earnings_invitee_id_fkey;

alter table referral_earnings
  alter column referrer_id drop not null,
  alter column invitee_id drop not null,
  add constraint referral_earnings_referrer_id_fkey
    foreign key (referrer_id) references profiles(id) on delete set null,
  add constraint referral_earnings_invitee_id_fkey
    foreign key (invitee_id) references profiles(id) on delete set null;

-- unique constraint still applies when both are non-null; we add a guard trigger to prevent nulls at insert time
create or replace function check_earning_ids_not_null()
returns trigger
language plpgsql
as $$
begin
  if new.referrer_id is null or new.invitee_id is null then
    raise exception 'referrer_id and invitee_id must be non-null at insert time' using errcode = '23502';
  end if;
  return new;
end;
$$;

drop trigger if exists referral_earnings_require_ids on referral_earnings;
create trigger referral_earnings_require_ids
  before insert on referral_earnings
  for each row execute function check_earning_ids_not_null();

-- ============================================================
-- #1 + #5 — send_dating_request RPC rewrite with fixed KST boundary
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
  v_kst_start timestamptz;
  v_active_slots int;
  v_sent_today int;
  v_received_today int;
  v_send_limit int;
  v_duplicate_active int;
begin
  if auth.uid() is distinct from p_requester_id then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;

  if p_requester_id = p_target_id then
    raise exception 'Cannot request yourself' using errcode = '22023';
  end if;

  v_quota_date := current_quota_date();
  -- #1 FIX: use explicit +09 offset instead of `at time zone` on naive timestamp
  v_kst_start := (v_quota_date::text || ' 08:00:00+09')::timestamptz;

  -- 3-slot ceiling
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

  select count(*)
  into v_duplicate_active
  from dating_requests
  where requester_id = p_requester_id
    and target_id = p_target_id
    and status in ('pending', 'accepted');

  if v_duplicate_active > 0 then
    raise exception 'Active request to this target already exists' using errcode = '23505';
  end if;

  select coalesce(sum(case when dr.requester_id = p_requester_id then 1 else 0 end), 0),
         coalesce(sum(case when dr.target_id    = p_requester_id then 1 else 0 end), 0)
  into v_sent_today, v_received_today
  from dating_requests dr
  where (dr.requester_id = p_requester_id or dr.target_id = p_requester_id)
    and dr.created_at >= v_kst_start;

  v_send_limit := 1 + v_received_today;

  if v_sent_today >= v_send_limit then
    raise exception 'Daily send quota exhausted' using errcode = 'P0002';
  end if;

  insert into dating_requests (requester_id, target_id, status, expires_at)
  values (p_requester_id, p_target_id, 'pending', now() + interval '24 hours')
  returning id into v_request_id;

  -- #5 FIX: only own sent_count; trigger handles received_count for target
  insert into request_quotas (user_id, quota_date, sent_count, received_count)
  values (p_requester_id, v_quota_date, v_sent_today + 1, 0)
  on conflict (user_id, quota_date)
  do update set sent_count = request_quotas.sent_count + 1;

  return v_request_id;
end;
$$;

grant execute on function send_dating_request(uuid, uuid) to authenticated;

-- ============================================================
-- #2 — accept_dating_request / instant_accept_match set payer_id correctly
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

  -- payer = requester (A) for normal accept flow
  insert into matches (request_id, user1_id, user2_id, payer_id, payment_status, payment_expires_at)
  values (p_request_id, v_requester_id, v_target_id, v_requester_id, 'pending', now() + interval '24 hours')
  on conflict (request_id) do update
    set payment_expires_at = coalesce(matches.payment_expires_at, excluded.payment_expires_at),
        payer_id = coalesce(matches.payer_id, excluded.payer_id)
  returning id into v_match_id;

  return v_match_id;
end;
$$;

grant execute on function accept_dating_request(uuid) to authenticated;

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

  -- payer = target (B) — B가 바로 수락 + 결제
  insert into matches (request_id, user1_id, user2_id, payer_id, payment_status, payment_expires_at)
  values (p_request_id, v_requester_id, v_target_id, v_target_id, 'pending', now() + interval '24 hours')
  on conflict (request_id) do update
    set payment_expires_at = coalesce(matches.payment_expires_at, excluded.payment_expires_at),
        payer_id = excluded.payer_id
  returning id into v_match_id;

  return v_match_id;
end;
$$;

grant execute on function instant_accept_match(uuid) to authenticated;

-- ============================================================
-- #2 — confirm_payment_transfer: only payer may confirm
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
  v_payer_id uuid;
  v_status text;
begin
  select payer_id, payment_status
  into v_payer_id, v_status
  from matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'Match not found' using errcode = 'P0003';
  end if;

  if auth.uid() is distinct from v_payer_id then
    raise exception 'Only the payer can confirm payment' using errcode = '42501';
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
-- #7 — admin_mark_payment_paid: whitelist transitions (no regression)
-- ============================================================

create or replace function admin_mark_payment_paid(
  p_match_id uuid,
  p_kakao_room_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current text;
begin
  select payment_status into v_current
  from matches
  where id = p_match_id
  for update;

  if not found then
    raise exception 'Match not found' using errcode = 'P0003';
  end if;

  if v_current = 'paid' then
    raise exception 'Already paid (terminal state)' using errcode = 'P0006';
  end if;

  if v_current = 'expired' then
    raise exception 'Cannot mark expired match as paid' using errcode = 'P0006';
  end if;

  if v_current not in ('pending', 'pending_confirmation') then
    raise exception 'Invalid transition from % to paid', v_current using errcode = 'P0006';
  end if;

  update matches
  set payment_status = 'paid',
      paid_at = now(),
      kakao_room_url = coalesce(p_kakao_room_url, kakao_room_url),
      kakao_group_created = case when p_kakao_room_url is not null then true else kakao_group_created end
  where id = p_match_id;
end;
$$;

revoke all on function admin_mark_payment_paid(uuid, text) from public, authenticated;
grant execute on function admin_mark_payment_paid(uuid, text) to service_role;

-- ============================================================
-- #4 — list_pending_payment_reminders uses payer_id
-- ============================================================

create or replace function list_pending_payment_reminders()
returns table(
  match_id uuid,
  payer_id uuid,
  payer_phone text,
  other_name text,
  payment_expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
    select m.id,
           m.payer_id,
           p_payer.phone,
           -- other user = whoever is not the payer
           case when m.payer_id = m.user1_id then p2.name else p1.name end as other_name,
           m.payment_expires_at
    from matches m
    join profiles p1 on p1.id = m.user1_id
    join profiles p2 on p2.id = m.user2_id
    join profiles p_payer on p_payer.id = m.payer_id
    where m.payment_status = 'pending'
      and m.payment_expires_at > now()
      and m.payment_expires_at <= now() + interval '1 hour'
      and p_payer.phone is not null
      and not exists (
        select 1 from sms_notifications sn
        where sn.user_id = m.payer_id
          and sn.template_key = 'payment_expiry_reminder'
          and sn.reference_id = m.id
      );
end;
$$;

grant execute on function list_pending_payment_reminders() to service_role;

-- ============================================================
-- DONE
-- ============================================================
