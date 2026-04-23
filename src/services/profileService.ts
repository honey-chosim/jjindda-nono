import { getRawSupabaseClient } from '@/lib/supabase'
import type { ProfileView } from '@/types/database'

function toProfileView(p: Record<string, unknown>): ProfileView {
  const currentYear = new Date().getFullYear()
  const birthYear = p.birth_year as number
  const residenceCity = p.residence_city as string | null
  const residenceDistrict = p.residence_district as string | null
  return {
    ...(p as Parameters<typeof toProfileView>[0] & Record<string, unknown>),
    age: currentYear - birthYear + 1,
    residence: residenceDistrict
      ? `${residenceCity} ${residenceDistrict}`
      : (residenceCity ?? ''),
  } as ProfileView
}

// Columns returned for other users — phone excluded for privacy
const PUBLIC_PROFILE_COLUMNS = 'id,name,gender,birth_year,birth_month,birth_day,height,education,school,company,job_title,residence_city,residence_district,smoking,drinking,mbti,hobbies,pet,bio,photos,referrer_comment,is_active,onboarding_completed,created_at,updated_at'

export async function getProfiles(_currentUserId: string): Promise<ProfileView[]> {
  // 서버 라우트 경유 (service_role 사용 → RLS/세션 이슈 없이 성별 필터 확실히 적용)
  const res = await fetch('/api/profiles', { cache: 'no-store' })
  if (!res.ok) {
    if (res.status === 401) return []
    throw new Error((await res.json().catch(() => ({})))?.error ?? 'failed')
  }
  const data = (await res.json()) as Record<string, unknown>[]
  return data.map(toProfileView)
}

export async function getProfileById(id: string): Promise<ProfileView | null> {
  const supabase = getRawSupabaseClient()
  const { data, error } = await supabase
    .from('profiles')
    .select(PUBLIC_PROFILE_COLUMNS)
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
  return data ? toProfileView(data as Record<string, unknown>) : null
}

export async function getMyProfile(_userId: string): Promise<ProfileView | null> {
  // 서버 라우트 경유 (service_role — RLS/세션 이슈 없이 본인 프로필 조회 확실)
  const res = await fetch('/api/me', { cache: 'no-store' })
  if (!res.ok) {
    if (res.status === 401) return null
    throw new Error((await res.json().catch(() => ({})))?.error ?? 'failed')
  }
  const data = await res.json()
  return data ? toProfileView(data as Record<string, unknown>) : null
}

export async function createProfile(profile: Record<string, unknown>): Promise<ProfileView> {
  const supabase = getRawSupabaseClient()
  const { data, error } = await supabase
    .from('profiles')
    .insert(profile)
    .select()
    .single()

  if (error) throw error
  return toProfileView(data as Record<string, unknown>)
}

// Atomic finalize: 프로필 생성 + invite_codes.used_by 업데이트를 단일 트랜잭션으로.
// 시행착오: createProfile() + consumeInviteCode() 두 번 호출하면 두 번째가
// 실패할 때 invite_code 추적이 누락됨 (실제로 2명 데이터 손실). 서버 RPC 경유.
export async function finalizeOnboarding(
  profile: Record<string, unknown>,
  inviteCode: string
): Promise<void> {
  const res = await fetch('/api/onboarding/finalize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
    body: JSON.stringify({ profile, inviteCode }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string }
    throw new Error(data.error ?? '프로필 저장에 실패했습니다')
  }
}

export async function updateProfile(userId: string, update: Record<string, unknown>): Promise<ProfileView> {
  const supabase = getRawSupabaseClient()
  const { data, error } = await supabase
    .from('profiles')
    .update(update)
    .eq('id', userId)
    .select()
    .single()

  if (error) throw error
  return toProfileView(data as Record<string, unknown>)
}

export async function completeOnboarding(userId: string): Promise<void> {
  const supabase = getRawSupabaseClient()
  const { error } = await supabase
    .from('profiles')
    .update({ onboarding_completed: true })
    .eq('id', userId)

  if (error) throw error
}
