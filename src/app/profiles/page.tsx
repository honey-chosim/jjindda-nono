"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ProfileCard from "@/components/profiles/ProfileCard";
import BottomNav from "@/components/layout/BottomNav";
import { PendingReviewState, isFullyVerified } from "@/components/ui/PendingReview";
import { getProfiles, getMyProfile } from "@/services/profileService";
import { getRequestQuota } from "@/services/requestService";
import { getSupabaseClient } from "@/lib/supabase";
import type { ProfileView } from "@/types/database";
import type { RequestQuota } from "@/services/requestService";

const INITIAL_COUNT = 12;
const LOAD_MORE = 8;

export default function ProfilesPage() {
  const [allProfiles, setAllProfiles] = useState<ProfileView[]>([]);
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [quota, setQuota] = useState<RequestQuota | null>(null);
  const [me, setMe] = useState<ProfileView | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const visible = allProfiles.slice(0, visibleCount);
  const hasMore = visibleCount < allProfiles.length;
  const verified = isFullyVerified(me);

  useEffect(() => {
    async function fetchData() {
      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const myProfile = await getMyProfile(user.id);
        setMe(myProfile);
        if (!isFullyVerified(myProfile)) return;
        const [profiles, quotaData] = await Promise.all([
          getProfiles(user.id),
          getRequestQuota(user.id),
        ]);
        setAllProfiles(profiles);
        setQuota(quotaData);
      } catch (err) {
        console.error("Failed to fetch profiles:", err);
      } finally {
        setIsFetching(false);
      }
    }
    fetchData();
  }, []);

  const loadMore = useCallback(() => {
    if (isLoading || !hasMore) return;
    setIsLoading(true);
    setTimeout(() => {
      setVisibleCount((c) => c + LOAD_MORE);
      setIsLoading(false);
    }, 300);
  }, [isLoading, hasMore]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: "200px" }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <div className="min-h-dvh bg-white pb-24">
      <div
        className="sticky top-0 z-30 px-5 pt-4 pb-4"
        style={{
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderBottom: "0.5px solid rgba(0,0,0,0.08)",
        }}
      >
        <div className="flex items-center justify-between">
          <h1 className="text-[28px] font-black text-[#111827] tracking-[-0.03em]">탐색</h1>
          {verified && quota !== null && (
            <div className="flex items-center gap-1.5">
              <div
                className={
                  quota.available > 0
                    ? "flex items-center gap-1 bg-[#111827] text-white text-xs font-semibold px-3 py-1.5 rounded-full"
                    : "flex items-center gap-1 bg-[#F3F4F6] text-[#9CA3AF] text-xs font-semibold px-3 py-1.5 rounded-full"
                }
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                </svg>
                요청권 {quota.available}개
              </div>
              {quota.activeSlots >= 3 && (
                <span className="text-[11px] text-[var(--danger)] font-semibold">슬롯 만석</span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="px-4 pt-4">
        {isFetching ? (
          <div className="flex justify-center py-32">
            <div className="w-6 h-6 border-2 border-[#E5E7EB] border-t-[#111827] rounded-full animate-spin" />
          </div>
        ) : !verified ? (
          <PendingReviewState />
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <p className="text-[15px] font-semibold text-[#111827]">프로필이 없습니다</p>
            <p className="text-[13px] text-[#9CA3AF] mt-1">나중에 다시 확인해보세요</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {visible.map((profile) => (
                <ProfileCard key={profile.id} profile={profile} />
              ))}
            </div>
            <div ref={sentinelRef} className="h-1" />
            {isLoading && (
              <div className="flex justify-center py-6">
                <div className="w-5 h-5 border-2 border-[#E5E7EB] border-t-[#111827] rounded-full animate-spin" />
              </div>
            )}
            {!hasMore && visible.length > 0 && (
              <div className="py-8 text-center">
                <p className="text-[13px] text-[#9CA3AF]">모든 프로필을 확인했어요</p>
              </div>
            )}
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
