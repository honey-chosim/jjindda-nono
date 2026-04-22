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
const PUBLIC_PROFILE_COLUMNS = 'id,name,gender,birth_year,birth_month,birth_day,height,education,school,company,job_title,residence_city,residence_district,smoking,drinking,mbti,hobbies,pet,bio,photos,is_active,onboarding_completed,created_at,updated_at'

export async function getProfiles(currentUserId: string): Promise<ProfileView[]> {
  const supabase = getRawSupabaseClient()

  // Fetch current user's gender — 반드시 조회돼야 함. 없으면 탐색 자체가 위험(동성 프로필 노출).
  const { data: me, error: meError } = await supabase
    .from('profiles')
    .select('gender')
    .eq('id', currentUserId)
    .maybeSingle()

  if (meError) throw meError
  if (!me?.gender) {
    // 자기 프로필 조회 실패 (RLS 또는 세션 문제) → 빈 리스트 (fail-closed)
    return []
  }

  const { data, error } = await supabase
    .from('profiles')
    .select(PUBLIC_PROFILE_COLUMNS)
    .eq('is_active', true)
    .eq('onboarding_completed', true)
    .eq('is_verified', true)
    .eq('verified_by_referrer', true)
    .neq('id', currentUserId)
    .neq('gender', me.gender)
    .order('created_at', { ascending: false })

  if (error) throw error
  return ((data ?? []) as Record<string, unknown>[]).map(toProfileView)
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

export async function getMyProfile(userId: string): Promise<ProfileView | null> {
  const supabase = getRawSupabaseClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }
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
