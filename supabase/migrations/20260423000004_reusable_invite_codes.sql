-- Reusable invite codes — one code can be consumed by multiple invitees.
--
-- Rationale: previously invite_codes.used_by (single uuid) limited a code to
-- a single signup. We now want a referrer to share one code with many friends
-- and rotate ("재발급") to retire the old code. Referral attribution lives on
-- profiles.invite_code_used + profiles.referrer_id (denormalized), which is
-- preserved untouched. invite_codes rows are NEVER deleted — only is_active
-- toggled — so historical referrals stay intact.

-- 1. Loosen the anon SELECT policy so verification only checks is_active.
drop policy if exists "Anon can verify an invite code" on invite_codes;
create policy "Anon can verify an invite code"
  on invite_codes for select
  using (is_active = true);

-- 2. Replace finalize_onboarding: stop touching invite_codes.used_by/used_at.
--    Validate code by is_active only; profile insert still records
--    invite_code_used + referrer_id for history.
create or replace function finalize_onboarding(p_user_id uuid, p_invite_code text, p_profile jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_referrer_id uuid;
  v_code text;
  v_profile_id uuid;
begin
  v_code := upper(coalesce(p_invite_code, ''));
  if length(v_code) <> 8 then
    raise exception 'INVALID_INVITE_CODE_FORMAT' using errcode = 'P0001';
  end if;

  select created_by into v_referrer_id
  from invite_codes
  where code = v_code and is_active = true
  limit 1;

  if not found then
    raise exception 'INVITE_CODE_INVALID_OR_USED' using errcode = 'P0002';
  end if;

  insert into profiles (
    id, name, real_name, phone, gender,
    birth_year, birth_month, birth_day,
    height, education, school, company, job_title,
    residence_city, residence_district,
    smoking, drinking, mbti, hobbies, pet,
    bio, photos,
    preferred_age_min, preferred_age_max, preferred_height_min,
    preferred_residence, preferred_free_text,
    onboarding_completed,
    invite_code_used, referrer_id
  )
  values (
    p_user_id,
    p_profile->>'name',
    p_profile->>'real_name',
    p_profile->>'phone',
    (p_profile->>'gender')::text,
    (p_profile->>'birth_year')::int,
    (p_profile->>'birth_month')::int,
    (p_profile->>'birth_day')::int,
    nullif(p_profile->>'height','')::int,
    p_profile->>'education',
    p_profile->>'school',
    p_profile->>'company',
    p_profile->>'job_title',
    p_profile->>'residence_city',
    p_profile->>'residence_district',
    p_profile->>'smoking',
    p_profile->>'drinking',
    p_profile->>'mbti',
    coalesce(
      array(select jsonb_array_elements_text(p_profile->'hobbies')),
      array[]::text[]
    ),
    p_profile->>'pet',
    p_profile->>'bio',
    coalesce(
      array(select jsonb_array_elements_text(p_profile->'photos')),
      array[]::text[]
    ),
    nullif(p_profile->>'preferred_age_min','')::int,
    nullif(p_profile->>'preferred_age_max','')::int,
    nullif(p_profile->>'preferred_height_min','')::int,
    coalesce(
      array(select jsonb_array_elements_text(p_profile->'preferred_residence')),
      array[]::text[]
    ),
    p_profile->>'preferred_free_text',
    coalesce((p_profile->>'onboarding_completed')::boolean, true),
    v_code,
    v_referrer_id
  )
  returning id into v_profile_id;

  return v_profile_id;
end;
$$;

grant execute on function finalize_onboarding(uuid, text, jsonb) to authenticated, anon, service_role;
