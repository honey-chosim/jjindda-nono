"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import BottomNav from "@/components/layout/BottomNav";
import Card from "@/components/ui/Card";
import { getMyProfile } from "@/services/profileService";
import { getSentRequests } from "@/services/requestService";
import { getSupabaseClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { ProfileView, DatingRequest } from "@/types/database";

const statusLabel: Record<string, string> = {
  pending: "대기중",
  accepted: "수락됨",
  rejected: "거절됨",
  expired: "만료",
};
const statusColor: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  accepted: "bg-green-100 text-green-700",
  rejected: "bg-gray-100 text-gray-500",
  expired: "bg-gray-100 text-gray-400",
};

export default function MyPage() {
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [sentRequests, setSentRequests] = useState<DatingRequest[]>([]);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const [profileData, requestsData] = await Promise.all([
          getMyProfile(user.id),
          getSentRequests(user.id),
        ]);
        setProfile(profileData);
        setSentRequests(requestsData);
      } catch (err) {
        console.error("Failed to fetch my data:", err);
      } finally {
        setIsFetching(false);
      }
    }
    fetchData();
  }, []);

  if (isFetching) {
    return (
      <div className="min-h-dvh bg-white flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#E5E7EB] border-t-[#111827] rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-dvh bg-white flex items-center justify-center">
        <p className="text-[#6B7280] text-sm">프로필을 불러올 수 없습니다</p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-white pb-28">
      <div
        className="sticky top-0 z-30 px-5 pt-4 pb-4"
        style={{
          background: "rgba(255,255,255,0.88)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderBottom: "0.5px solid rgba(0,0,0,0.08)",
        }}
      >
        <h1 className="text-[28px] font-black text-[#111827] tracking-[-0.03em]">MY</h1>
      </div>

      <div className="px-4 pt-4 flex flex-col gap-4">
        <Card padding="none" className="overflow-hidden">
          <div className="flex items-center gap-4 p-5">
            <div className="relative w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 bg-gray-100">
              {profile.photos[0] ? (
                <Image
                  src={profile.photos[0]}
                  alt={profile.name}
                  fill
                  className="object-cover"
                  sizes="80px"
                />
              ) : (
                <div className="w-full h-full bg-gray-200" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-bold text-[var(--text)]">{profile.name}</p>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">
                {profile.age}세 · {profile.height}cm
              </p>
              <p className="text-sm text-[var(--text-muted)] truncate">
                {profile.job_title} · {profile.residence}
              </p>
            </div>
          </div>

          <div className="border-t border-[var(--border)] divide-y divide-[var(--border)]">
            <div className="flex px-5 py-3 gap-4">
              <span className="text-xs text-[var(--text-muted)] w-16 flex-shrink-0 pt-0.5">학력</span>
              <span className="text-sm text-[var(--text)]">
                {profile.education} · {profile.school}
              </span>
            </div>
            <div className="flex px-5 py-3 gap-4">
              <span className="text-xs text-[var(--text-muted)] w-16 flex-shrink-0 pt-0.5">직장</span>
              <span className="text-sm text-[var(--text)]">
                {profile.company} · {profile.job_title}
              </span>
            </div>
            <div className="flex px-5 py-3 gap-4">
              <span className="text-xs text-[var(--text-muted)] w-16 flex-shrink-0 pt-0.5">MBTI</span>
              <span className="text-sm text-[var(--text)]">{profile.mbti}</span>
            </div>
            <div className="flex px-5 py-3 gap-4">
              <span className="text-xs text-[var(--text-muted)] w-16 flex-shrink-0 pt-0.5">취미</span>
              <span className="text-sm text-[var(--text)]">{profile.hobbies.join(", ")}</span>
            </div>
          </div>

          <div className="border-t border-[var(--border)] p-4">
            <Link
              href="/my/edit"
              className="flex items-center justify-center gap-2 w-full h-11 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text)] hover:bg-gray-50 transition-colors"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              프로필 수정하기
            </Link>
          </div>
        </Card>

        <div>
          <h2 className="text-base font-bold text-[var(--text)] mb-3">보낸 요청</h2>
          {sentRequests.length === 0 ? (
            <Card>
              <div className="py-8 text-center">
                <p className="text-2xl mb-2">💌</p>
                <p className="text-sm text-[var(--text-muted)]">아직 보낸 요청이 없습니다</p>
              </div>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {sentRequests.map((req) => (
                <Card key={req.id} padding="sm">
                  <div className="flex items-center justify-between gap-3 px-2 py-1">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text)]">{(req as { target?: { name: string } | null }).target?.name ?? "알 수 없음"}</p>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        {new Date(req.created_at).toLocaleDateString("ko-KR", {
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full", statusColor[req.status])}>
                        {statusLabel[req.status]}
                      </span>
                      {req.status === "accepted" && (
                        <Link href={`/profiles/${req.target_id}`} className="text-xs text-[var(--primary)] font-medium">
                          보기 →
                        </Link>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
