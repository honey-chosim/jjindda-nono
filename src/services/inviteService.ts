import { getRawSupabaseClient } from '@/lib/supabase'

export async function validateInviteCode(code: string): Promise<boolean> {
  const supabase = getRawSupabaseClient()
  const { data, error } = await supabase
    .from('invite_codes')
    .select('id')
    .eq('code', code.toUpperCase())
    .eq('is_active', true)
    .maybeSingle()

  if (error) throw error
  return data !== null
}

/**
 * @deprecated 브라우저에서 단독 호출 금지. createProfile() 직후 호출하던
 * 옛 플로우는 두 번째 단계가 silently fail해서 invite_code 추적이 누락됐다
 * (실제 데이터 손실 사례 2건). 대신 `finalizeOnboarding()` 사용 — 서버 RPC가
 * profiles INSERT + invite_codes UPDATE를 단일 트랜잭션으로 처리한다.
 */
export async function consumeInviteCode(code: string, userId: string): Promise<void> {
  if (!code) throw new Error('초대 코드가 없습니다. 처음부터 다시 가입해주세요.')
  const supabase = getRawSupabaseClient()

  const { data: existing } = await supabase
    .from('invite_codes')
    .select('id')
    .eq('code', code.toUpperCase())
    .is('used_by', null)
    .maybeSingle()

  if (!existing) throw new Error('이미 사용된 코드이거나 유효하지 않습니다.')

  const { error } = await supabase
    .from('invite_codes')
    .update({ used_by: userId, used_at: new Date().toISOString() })
    .eq('id', (existing as { id: string }).id)

  if (error) throw error
}
