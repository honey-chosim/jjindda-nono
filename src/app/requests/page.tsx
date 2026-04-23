"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import BottomNav from "@/components/layout/BottomNav";
import RequestCard from "@/components/requests/RequestCard";
import CountdownTimer from "@/components/ui/CountdownTimer";
import { getReceivedRequests, getSentRequests } from "@/services/requestService";
import { getMyProfile } from "@/services/profileService";
import { getSupabaseClient } from "@/lib/supabase";
import { PendingReviewState, isFullyVerified } from "@/components/ui/PendingReview";
import type { RequestWithRequester, DatingRequest, ProfileView } from "@/types/database";
import { cn } from "@/lib/utils";

type SentRequest = DatingRequest & {
  target: {
    id: string
    name: string
    photos: string[] | null
    birth_year: number | null
    job_title: string | null
    residence_city: string | null
    residence_district: string | null
  } | null
  match: { payment_expires_at: string | null; payment_status: string } | null
};

type ReceivedRequest = RequestWithRequester & {
  match: { payment_expires_at: string | null; payment_status: string } | null
};

const statusLabel: Record<string, string> = {
  pending: "대기중",
  accepted: "수락됨",
  rejected: "거절됨",
  expired: "만료",
};

const statusColor: Record<string, string> = {
  pending: "bg-[#FEF3C7] text-[#92400E]",
  accepted: "bg-[#D1FAE5] text-[#065F46]",
  rejected: "bg-[#FEE2E2] text-[#991B1B]",
  expired: "bg-[#F3F4F6] text-[#6B7280]",
};

function expiresAt(req: { expires_at?: string | null; created_at: string }): string {
  if (req.expires_at) return req.expires_at;
  return new Date(new Date(req.created_at).getTime() + 24 * 60 * 60 * 1000).toISOString();
}

export default function RequestsPage() {
  const [tab, setTab] = useState<"received" | "sent">("received");
  const [received, setReceived] = useState<ReceivedRequest[]>([]);
  const [sent, setSent] = useState<SentRequest[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [me, setMe] = useState<ProfileView | null>(null);
  const verified = isFullyVerified(me);

  useEffect(() => {
    async function fetchAll() {
      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const myProfile = await getMyProfile(user.id);
        setMe(myProfile);
        if (!isFullyVerified(myProfile)) return;
        const [receivedData, sentData] = await Promise.all([
          getReceivedRequests(user.id),
          getSentRequests(user.id),
        ]);
        setReceived(receivedData);
        setSent(sentData as SentRequest[]);
      } catch (err) {
        console.error("Failed to fetch requests:", err);
      } finally {
        setIsFetching(false);
      }
    }
    fetchAll();
  }, []);

  const handleRequestExpired = useCallback((id: string) => {
    setReceived((prev) =>
      prev.map((r) => r.id === id ? { ...r, status: "expired" as const } : r)
    );
    setSent((prev) =>
      prev.map((r) => r.id === id ? { ...r, status: "expired" as const } : r)
    );
  }, []);

  const receivedPendingCount = received.filter((r) => r.status === "pending").length;
  const sentActiveCount = sent.filter((r) => r.status === "pending" || r.status === "accepted").length;
  const tabCounts: Record<"received" | "sent", number> = {
    received: receivedPendingCount,
    sent: sentActiveCount,
  };

  return (
    <div className="min-h-dvh bg-white pb-28">
      <div
        className="sticky top-0 z-30 px-5 pt-4 pb-0"
        style={{
          background: "rgba(255,255,255,0.92)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderBottom: "0.5px solid rgba(0,0,0,0.08)",
        }}
      >
        <div className="flex items-center gap-2.5 mb-3">
          <h1 className="text-[28px] font-black text-[#111827] tracking-[-0.03em]">요청</h1>
        </div>

        {verified && (
          <div className="flex gap-0">
            {(["received", "sent"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "flex-1 pb-2.5 text-[14px] font-semibold border-b-2 transition-colors inline-flex items-center justify-center gap-1.5",
                  tab === t
                    ? "border-[#111827] text-[#111827]"
                    : "border-transparent text-[#9CA3AF]"
                )}
              >
                <span>{t === "received" ? "받은 요청" : "보낸 요청"}</span>
                {tabCounts[t] > 0 && (
                  <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5 bg-[#DC2626] text-white text-[10px] font-bold rounded-full leading-none">
                    {tabCounts[t]}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="px-4 pt-4">
        {isFetching ? (
          <div className="flex justify-center py-32">
            <div className="w-6 h-6 border-2 border-[#E5E7EB] border-t-[#111827] rounded-full animate-spin" />
          </div>
        ) : !verified ? (
          <PendingReviewState />
        ) : tab === "received" ? (
          received.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <p className="text-[15px] font-semibold text-[#111827]">아직 받은 요청이 없어요</p>
              <p className="text-[13px] text-[#9CA3AF] mt-1">프로필을 완성하면 더 많은 분들이 찾아올 거예요</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {received.map((request) =>
                request.requester ? (
                  <RequestCard
                    key={request.id}
                    requestId={request.id}
                    createdAt={request.created_at}
                    status={request.status}
                    profile={request.requester}
                    direction="received"
                    match={request.match}
                    onExpired={() => handleRequestExpired(request.id)}
                  />
                ) : null
              )}
            </div>
          )
        ) : (
          sent.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <p className="text-[15px] font-semibold text-[#111827]">아직 보낸 요청이 없어요</p>
              <p className="text-[13px] text-[#9CA3AF] mt-1">마음에 드는 분께 소개팅을 신청해보세요</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {sent.map((req) =>
                req.target ? (
                  <RequestCard
                    key={req.id}
                    requestId={req.id}
                    createdAt={req.created_at}
                    status={req.status}
                    profile={req.target}
                    direction="sent"
                    match={req.match}
                    onExpired={() => handleRequestExpired(req.id)}
                  />
                ) : null
              )}
            </div>
          )
        )}
      </div>

      <BottomNav />
    </div>
  );
}
