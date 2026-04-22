import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@supabase/supabase-js'
import { notifyUser } from '@/services/notificationService'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

async function checkAuth() {
  const cookieStore = await cookies()
  return cookieStore.get('admin_session')?.value === 'authenticated'
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await checkAuth())) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const body = await request.json()
  const supabaseAdmin = getAdminClient()

  if ('approved' in body) {
    const { approved, note } = body as { approved: boolean; note?: string }
    const { error } = await supabaseAdmin.rpc('verify_referral_profile', {
      p_invitee_id: id,
      p_approved: approved,
      p_note: note,
    })
    if (error) return Response.json({ error: error.message }, { status: 500 })

    const { data, error: fetchError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single()
    if (fetchError) return Response.json({ error: fetchError.message }, { status: 500 })

    notifyUser({
      userId: id,
      templateKey: approved ? 'profile_approved' : 'profile_rejected',
      referenceId: id,
      vars: { reason: note },
    }).catch(console.error)

    return Response.json(data)
  }

  const { is_active } = body
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ is_active })
    .eq('id', id)
    .select()
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}
