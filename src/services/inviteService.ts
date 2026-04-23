import { getRawSupabaseClient } from '@/lib/supabase'

export async function validateInviteCode(code: string): Promise<boolean> {
  const supabase = getRawSupabaseClient()
  const { data, error } = await supabase
    .from('invite_codes')
    .select('id')
    .eq('code', code.toUpperCase())
    .eq('is_active', true)
    .is('used_by', null)
    .maybeSingle()

  if (error) throw error
  return data !== null
}

export async function consumeInviteCode(code: string, userId: string): Promise<void> {
  if (!code) throw new Error('초대 코드가 없습니다. 처음부터 다시 가입해주세요.')
  const supabase = getRawSupabaseClient()

  const { data: existing } = await supabase
    .from('invite_codes')
    .select('id')
    .eq('code', code.toUpperCase())
    .is('used_by', null)
    .maybeSingle()

  // 시행착오 — silent return은 invite_codes.used_by 추적 누락의 원인. 항상 throw.
  if (!existing) throw new Error('이미 사용된 코드이거나 유효하지 않습니다.')

  const { error } = await supabase
    .from('invite_codes')
    .update({ used_by: userId, used_at: new Date().toISOString() })
    .eq('id', (existing as { id: string }).id)

  if (error) throw error
}
