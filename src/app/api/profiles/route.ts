import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

const PUBLIC_COLUMNS = 'id,name,gender,birth_year,birth_month,birth_day,height,education,school,company,job_title,residence_city,residence_district,smoking,drinking,mbti,hobbies,pet,bio,photos,is_active,onboarding_completed,created_at,updated_at'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

export async function GET() {
  const supabase = await createServerSupabaseClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = getAdminClient()

  // 본인 프로필에서 성별 조회 (service_role → RLS bypass, 확실)
  const { data: me, error: meError } = await admin
    .from('profiles')
    .select('gender')
    .eq('id', user.id)
    .maybeSingle()
  if (meError) return NextResponse.json({ error: meError.message }, { status: 500 })
  if (!me?.gender) return NextResponse.json([], { status: 200 })

  // 반대 성별 + 검증 완료된 프로필만
  const { data, error } = await admin
    .from('profiles')
    .select(PUBLIC_COLUMNS)
    .eq('is_active', true)
    .eq('onboarding_completed', true)
    .eq('is_verified', true)
    .eq('verified_by_referrer', true)
    .neq('id', user.id)
    .neq('gender', me.gender)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
