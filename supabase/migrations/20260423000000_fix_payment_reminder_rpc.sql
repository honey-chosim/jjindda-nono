-- Fix: list_pending_payment_reminders should use payer_id, not always user1_id
-- Reported by reviewer in PR #7 review.
-- Affects: instant_accept_match flow where B (user2) is the payer.

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
           case when m.payer_id = m.user1_id then p2.name else p1.name end as other_name,
           m.payment_expires_at
    from matches m
    join profiles p1 on p1.id = m.user1_id
    join profiles p2 on p2.id = m.user2_id
    join profiles p_payer on p_payer.id = coalesce(m.payer_id, m.user1_id)
    where m.payment_status = 'pending'
      and m.payment_expires_at > now()
      and m.payment_expires_at <= now() + interval '1 hour'
      and p_payer.phone is not null
      and not exists (
        select 1 from sms_notifications sn
        where sn.user_id = coalesce(m.payer_id, m.user1_id)
          and sn.template_key = 'payment_expiry_reminder'
          and sn.reference_id = m.id
      );
end;
$$;

grant execute on function list_pending_payment_reminders() to service_role;
