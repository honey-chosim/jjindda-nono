"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import ProfileCard from "@/components/profiles/ProfileCard";
import BottomNav from "@/components/layout/BottomNav";
import { mockProfiles } from "@/data/mock-profiles";

const INITIAL_COUNT = 12;
const LOAD_MORE = 8;

const allProfiles = [
  ...mockProfiles,
  ...mockProfiles.map((p) => ({ ...p, id: p.id + "_2", name: p.name + " " })),
];

export default function ProfilesPage() {
  const [visibleCount, setVisibleCount] = useState(INITIAL_COUNT);
  const [isLoading, setIsLoading] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const visible = allProfiles.slice(0, visibleCount);
  const hasMore = visibleCount < allProfiles.length;

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
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <div className="min-h-dvh bg-white pb-24">
      {/* Header — fixed */}
      <div
        className="fixed top-0 left-0 right-0 z-30 px-5 pb-4"
        style={{
          paddingTop: "max(16px, env(safe-area-inset-top))",
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderBottom: "0.5px solid rgba(0,0,0,0.08)",
        }}
      >
        <h1 className="text-[28px] font-black text-[#111827] tracking-[-0.03em]">
          탐색
        </h1>
      </div>

      {/* Grid — offset for fixed header */}
      <div className="px-4 pt-[84px]">
        {visible.length === 0 ? (
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

            {/* Sentinel for IntersectionObserver */}
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
