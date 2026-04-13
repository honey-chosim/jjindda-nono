-- ============================================================
-- 찐따노노 Supabase Schema
-- ============================================================

-- Enable UUID extension


-- ============================================================
-- TABLES
-- ============================================================

-- invite_codes: 초대 코드 관리
create table if not exists invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  created_by uuid references auth.users(id) on delete set null,
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- profiles: 사용자 프로필 (auth.users와 1:1)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  phone text unique,
  gender text not null check (gender in ('male', 'female')),
  birth_year integer not null,
  birth_month integer not null,
  birth_day integer not null,
  height integer,
  education text,
  school text,
  company text,
  job_title text,
  residence_city text,
  residence_district text,
  smoking text check (smoking in ('비흡연', '흡연', '금연 중')),
  drinking text check (drinking in ('안 마심', '사회적 음주', '즐겨 마심')),
  mbti text,
  hobbies text[] not null default '{}',
  pet text check (pet in ('없음', '강아지', '고양이', '기타')),
  bio text,
  photos text[] not null default '{}',
  preferred_age_min integer default 1990,
  preferred_age_max integer default 2002,
  preferred_height_min integer default 0,
  preferred_residence text[] not null default '{}',
  preferred_free_text text,
  is_active boolean not null default true,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- dating_requests: 소개팅 신청
create table if not exists dating_requests (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references profiles(id) on delete cascade,
  target_id uuid not null references profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'expired')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(requester_id, target_id)
);

-- matches: 매칭 성사 (수락된 요청)
create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references dating_requests(id) on delete cascade,
  user1_id uuid not null references profiles(id) on delete cascade,
  user2_id uuid not null references profiles(id) on delete cascade,
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid')),
  kakao_group_created boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- daily_request_limits: 하루 1회 신청 제한 추적
create table if not exists daily_request_limits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  request_date date not null default current_date,
  unique(user_id, request_date)
);

-- ============================================================
-- INDEXES
-- ============================================================

create index if not exists idx_profiles_gender on profiles(gender);
create index if not exists idx_profiles_is_active on profiles(is_active);
create index if not exists idx_profiles_onboarding on profiles(onboarding_completed);
create index if not exists idx_dating_requests_requester on dating_requests(requester_id);
create index if not exists idx_dating_requests_target on dating_requests(target_id);
create index if not exists idx_dating_requests_status on dating_requests(status);
create index if not exists idx_matches_user1 on matches(user1_id);
create index if not exists idx_matches_user2 on matches(user2_id);
create index if not exists idx_invite_codes_code on invite_codes(code);
create index if not exists idx_daily_limits_user_date on daily_request_limits(user_id, request_date);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger profiles_updated_at
  before update on profiles
  for each row execute function update_updated_at();

create trigger dating_requests_updated_at
  before update on dating_requests
  for each row execute function update_updated_at();

create trigger matches_updated_at
  before update on matches
  for each row execute function update_updated_at();

-- ============================================================
-- RPC FUNCTIONS (atomic operations)
-- ============================================================

-- send_dating_request: daily_request_limits 삽입 + dating_requests 삽입 원자적 처리
create or replace function send_dating_request(
  p_requester_id uuid,
  p_target_id uuid
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_request_id uuid;
  v_today date := current_date;
begin
  -- Verify caller is the requester
  if auth.uid() != p_requester_id then
    raise exception 'Unauthorized';
  end if;

  -- Enforce daily limit (unique constraint raises on duplicate)
  insert into daily_request_limits (user_id, request_date)
  values (p_requester_id, v_today);

  -- Insert the dating request
  insert into dating_requests (requester_id, target_id)
  values (p_requester_id, p_target_id)
  returning id into v_request_id;

  return v_request_id;
end;
$$;

-- accept_dating_request: status update + matches insert 원자적 처리
create or replace function accept_dating_request(
  p_request_id uuid
)
returns uuid
language plpgsql
security definer
as $$
declare
  v_match_id uuid;
  v_requester_id uuid;
  v_target_id uuid;
begin
  -- Fetch and verify target is the caller
  select requester_id, target_id
  into v_requester_id, v_target_id
  from dating_requests
  where id = p_request_id and target_id = auth.uid() and status = 'pending';

  if not found then
    raise exception 'Request not found or unauthorized';
  end if;

  -- Update status to accepted
  update dating_requests
  set status = 'accepted'
  where id = p_request_id;

  -- Create match record
  insert into matches (request_id, user1_id, user2_id)
  values (p_request_id, v_requester_id, v_target_id)
  returning id into v_match_id;

  return v_match_id;
end;
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table invite_codes enable row level security;
alter table profiles enable row level security;
alter table dating_requests enable row level security;
alter table matches enable row level security;
alter table daily_request_limits enable row level security;

-- invite_codes policies
-- Unauthenticated users (anon) can check if a code is valid (for landing page)
create policy "Anon can verify an invite code"
  on invite_codes for select
  to anon
  using (is_active = true and used_by is null);

-- Only authenticated admins (service role) can update invite codes
-- Client-side consumption goes through the consume_invite_code service function
-- which uses the raw client; actual DB update is via service role in production.
-- For dev: allow authenticated users to update codes they haven't yet used.
create policy "Authenticated can consume invite code"
  on invite_codes for update
  to authenticated
  using (used_by is null and is_active = true)
  with check (used_by = auth.uid());

-- profiles policies
create policy "Profiles are viewable by authenticated users"
  on profiles for select
  to authenticated
  using (is_active = true and onboarding_completed = true);

create policy "Users can view their own profile regardless of status"
  on profiles for select
  to authenticated
  using (id = auth.uid());

create policy "Users can insert their own profile"
  on profiles for insert
  to authenticated
  with check (id = auth.uid());

create policy "Users can update their own profile"
  on profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- dating_requests policies
create policy "Users can view requests they sent or received"
  on dating_requests for select
  to authenticated
  using (requester_id = auth.uid() or target_id = auth.uid());

-- Insert only via send_dating_request RPC (security definer),
-- but allow direct insert with requester = caller for client flexibility.
create policy "Users can create requests"
  on dating_requests for insert
  to authenticated
  with check (
    requester_id = auth.uid()
    and exists (
      select 1 from daily_request_limits
      where user_id = auth.uid()
      and request_date = current_date
    )
  );

-- Target user can accept/reject; only status transitions allowed
create policy "Target user can update request status"
  on dating_requests for update
  to authenticated
  using (target_id = auth.uid())
  with check (status in ('accepted', 'rejected'));

-- matches policies
create policy "Users can view their own matches"
  on matches for select
  to authenticated
  using (user1_id = auth.uid() or user2_id = auth.uid());

-- Matches are created via accept_dating_request RPC (security definer)
-- Direct insert allowed for authenticated participants as fallback
create policy "Match participants can insert"
  on matches for insert
  to authenticated
  with check (user1_id = auth.uid() or user2_id = auth.uid());

-- Match participants can update payment status
create policy "Match participants can update"
  on matches for update
  to authenticated
  using (user1_id = auth.uid() or user2_id = auth.uid());

-- daily_request_limits policies
create policy "Users can view their own daily limit"
  on daily_request_limits for select
  to authenticated
  using (user_id = auth.uid());

create policy "Users can insert their own daily limit"
  on daily_request_limits for insert
  to authenticated
  with check (user_id = auth.uid());

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================

-- Profile photos bucket (public bucket for profile images)
insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do nothing;

-- Storage policies
-- Authenticated users can upload to their own folder (user_id/filename)
create policy "Users can upload own photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can update/replace their own photos
create policy "Users can update own photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can delete their own photos
create policy "Users can delete own photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'profile-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Photos are publicly readable (bucket is public, but explicit policy for clarity)
create policy "Photos are publicly readable"
  on storage.objects for select
  using (bucket_id = 'profile-photos');
