/**
 * 검증 대기 중인 유저(어드민/친구 검증 둘 중 하나라도 미완)에게 노출되는 컴포넌트.
 *
 * - PendingReviewState: /profiles, /requests의 메인 콘텐츠 자리에 들어가는 빈 상태
 * - PendingReviewBanner: /my 상단에 띄우는 배너
 */

export function PendingReviewState() {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-32 text-center">
      <div className="text-5xl mb-5">🕒</div>
      <h2 className="text-[18px] font-bold text-[#111827] tracking-[-0.02em] mb-2">
        현재 검토 중입니다
      </h2>
      <p className="text-[14px] text-[#6B7280] leading-relaxed">
        운영진 승인과 친구 검증이 완료되면<br />
        프로필 탐색과 요청을 시작할 수 있어요
      </p>
    </div>
  );
}

export function PendingReviewBanner() {
  return (
    <div className="mx-4 mt-4 mb-4 rounded-2xl border border-[#FDE68A] bg-[#FEF3C7] px-4 py-3">
      <div className="flex items-start gap-2.5">
        <span className="text-[18px] leading-none mt-0.5">🕒</span>
        <div className="flex-1 min-w-0">
          <p className="text-[14px] font-semibold text-[#92400E] mb-0.5">검토 중입니다</p>
          <p className="text-[12.5px] text-[#92400E]/80 leading-relaxed">
            운영진 승인과 친구 검증이 완료되면 탐색·요청 기능을 이용할 수 있어요.
          </p>
        </div>
      </div>
    </div>
  );
}

/** is_verified AND verified_by_referrer 둘 다 true일 때만 fully approved */
export function isFullyVerified(profile: { is_verified?: boolean | null; verified_by_referrer?: boolean | null } | null | undefined): boolean {
  return !!profile?.is_verified && !!profile?.verified_by_referrer;
}
