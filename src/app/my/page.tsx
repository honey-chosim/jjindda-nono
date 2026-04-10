"use client";

import Image from "next/image";
import Link from "next/link";
import BottomNav from "@/components/layout/BottomNav";
import Card from "@/components/ui/Card";
import { mockUser } from "@/data/mock-user";
import { useAppStore } from "@/store/appStore";
import { cn } from "@/lib/utils";

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
  const { sentRequests } = useAppStore();

  return (
    <div className="min-h-dvh bg-white pb-28">
      {/* Header */}
      <div
        className="fixed top-0 left-0 right-0 z-30 px-5 pb-4"
        style={{
          paddingTop: "max(16px, env(safe-area-inset-top))",
          background: "rgba(255,255,255,0.88)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderBottom: "0.5px solid rgba(0,0,0,0.08)",
        }}
      >
        <h1 className="text-[28px] font-black text-[#111827] tracking-[-0.03em]">MY</h1>
      </div>

      <div className="px-4 pt-[84px] flex flex-col gap-4">
        {/* Profile Card */}
        <Card padding="none" className="overflow-hidden">
          <div className="flex items-center gap-4 p-5">
            <div className="relative w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 bg-gray-100">
              <Image
                src={mockUser.photos[0]}
                alt={mockUser.name}
                fill
                className="object-cover"
                sizes="80px"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-bold text-[var(--text)]">
                {mockUser.name}
              </p>
              <p className="text-sm text-[var(--text-muted)] mt-0.5">
                {mockUser.age}세 · {mockUser.height}cm
              </p>
              <p className="text-sm text-[var(--text-muted)] truncate">
                {mockUser.jobTitle} · {mockUser.residence}
              </p>
            </div>
          </div>

          {/* Info rows */}
          <div className="border-t border-[var(--border)] divide-y divide-[var(--border)]">
            <div className="flex px-5 py-3 gap-4">
              <span className="text-xs text-[var(--text-muted)] w-16 flex-shrink-0 pt-0.5">학력</span>
              <span className="text-sm text-[var(--text)]">
                {mockUser.education} · {mockUser.school}
              </span>
            </div>
            <div className="flex px-5 py-3 gap-4">
              <span className="text-xs text-[var(--text-muted)] w-16 flex-shrink-0 pt-0.5">직장</span>
              <span className="text-sm text-[var(--text)]">
                {mockUser.company} · {mockUser.jobTitle}
              </span>
            </div>
            <div className="flex px-5 py-3 gap-4">
              <span className="text-xs text-[var(--text-muted)] w-16 flex-shrink-0 pt-0.5">MBTI</span>
              <span className="text-sm text-[var(--text)]">{mockUser.mbti}</span>
            </div>
            <div className="flex px-5 py-3 gap-4">
              <span className="text-xs text-[var(--text-muted)] w-16 flex-shrink-0 pt-0.5">취미</span>
              <span className="text-sm text-[var(--text)]">
                {mockUser.hobbies.join(", ")}
              </span>
            </div>
          </div>

          {/* Edit button */}
          <div className="border-t border-[var(--border)] p-4">
            <Link
              href="/onboarding/3"
              className="flex items-center justify-center gap-2 w-full h-11 rounded-xl border border-[var(--border)] text-sm font-medium text-[var(--text)] hover:bg-gray-50 transition-colors"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              프로필 수정하기
            </Link>
          </div>
        </Card>

        {/* Sent Requests */}
        <div>
          <h2 className="text-base font-bold text-[var(--text)] mb-3">
            보낸 요청
          </h2>
          {sentRequests.length === 0 ? (
            <Card>
              <div className="py-8 text-center">
                <p className="text-2xl mb-2">💌</p>
                <p className="text-sm text-[var(--text-muted)]">
                  아직 보낸 요청이 없습니다
                </p>
              </div>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {sentRequests.map((req) => (
                <Card key={req.profileId} padding="sm">
                  <div className="flex items-center justify-between gap-3 px-2 py-1">
                    <div>
                      <p className="text-sm font-semibold text-[var(--text)]">
                        {req.profileName}
                      </p>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        {new Date(req.sentAt).toLocaleDateString("ko-KR", {
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          "text-xs font-semibold px-2.5 py-1 rounded-full",
                          statusColor[req.status]
                        )}
                      >
                        {statusLabel[req.status]}
                      </span>
                      {req.status === "accepted" && (
                        <Link
                          href={`/match/${req.profileId}`}
                          className="text-xs text-[var(--primary)] font-medium"
                        >
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
