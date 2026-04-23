-- Creator(=초대 코드 발급자)가 자기 코드를 used 여부 상관없이 조회할 수 있도록 SELECT 정책 추가.
-- 기존 정책: 미사용 + active 코드만 조회 가능 → /my 의 "내가 초대한 친구" 리스트에서
-- consume된 코드를 못 봐서 invitee가 안 보이던 문제 해결.

create policy "Creator can view own invite codes"
  on invite_codes for select
  using (created_by = auth.uid());
