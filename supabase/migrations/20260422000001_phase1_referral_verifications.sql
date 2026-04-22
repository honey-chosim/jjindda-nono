-- ============================================================
-- Phase 1 follow-up: referral_verifications table
--
-- 레퍼럴 친구(referrer)가 invitee 프로필을 검증한 이력.
-- profiles.verified_by_referrer는 현재 상태만 저장; 이 테이블은 감사/재검증용 이력.
-- ============================================================

create table if not exists referral_verifications (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references profiles(id) on delete cascade,
  invitee_id uuid not null references profiles(id) on delete cascade,
  approved boolean not null,
  note text,
  verified_at timestamptz not null default now(),
  unique (referrer_id, invitee_id)
);

create index if not exists idx_referral_verifications_referrer
  on referral_verifications(referrer_id);
create index if not exists idx_referral_verifications_invitee
  on referral_verifications(invitee_id);

alter table referral_verifications enable row level security;

create policy "Referrer and invitee can view verification"
  on referral_verifications for select
  to authenticated
  using (referrer_id = auth.uid() or invitee_id = auth.uid());

create policy "Referrer can insert verification"
  on referral_verifications for insert
  to authenticated
  with check (referrer_id = auth.uid());

create policy "Referrer can update verification"
  on referral_verifications for update
  to authenticated
  using (referrer_id = auth.uid())
  with check (referrer_id = auth.uid());

-- Extend verify_referral_profile RPC to also write audit row
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
begin
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
  else
    update profiles
    set verified_by_referrer = false,
        rejection_reason = coalesce(p_note, '레퍼럴 친구가 프로필을 반려했어요.')
    where id = p_invitee_id;
  end if;

  insert into referral_verifications (referrer_id, invitee_id, approved, note)
  values (v_referrer_id, p_invitee_id, p_approved, p_note)
  on conflict (referrer_id, invitee_id) do update
    set approved = excluded.approved,
        note = excluded.note,
        verified_at = now();
end;
$$;

grant execute on function verify_referral_profile(uuid, boolean, text) to authenticated;
