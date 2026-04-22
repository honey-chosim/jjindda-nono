"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import BottomNav from "@/components/layout/BottomNav";
import RequestCard from "@/components/requests/RequestCard";
import CountdownTimer from "@/components/ui/CountdownTimer";
import { getReceivedRequests, getSentRequests } from "@/services/requestService";
import { getSupabaseClient } from "@/lib/supabase";
import type { RequestWithRequester, DatingRequest } from "@/types/database";
import { cn } from "@/lib/utils";

type SentRequest = DatingRequest & { target: { id: string; name: string } | null };

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
  const [received, setReceived] = useState<RequestWithRequester[]>([]);
  const [sent, setSent] = useState<SentRequest[]>([]);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    async function fetchAll() {
      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
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

  const pendingCount = received.filter((r) => r.status === "pending").length;

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
          {pendingCount > 0 && (
            <span className="bg-[#DC2626] text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
              {pendingCount}
            </span>
          )}
        </div>

        <div className="flex gap-0">
          {(["received", "sent"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "flex-1 pb-2.5 text-[14px] font-semibold border-b-2 transition-colors",
                tab === t
                  ? "border-[#111827] text-[#111827]"
                  : "border-transparent text-[#9CA3AF]"
              )}
            >
              {t === "received" ? "받은 요청" : "보낸 요청"}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 pt-4">
        {isFetching ? (
          <div className="flex justify-center py-32">
            <div className="w-6 h-6 border-2 border-[#E5E7EB] border-t-[#111827] rounded-full animate-spin" />
          </div>
        ) : tab === "received" ? (
          received.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <p className="text-[15px] font-semibold text-[#111827]">아직 받은 요청이 없어요</p>
              <p className="text-[13px] text-[#9CA3AF] mt-1">프로필을 완성하면 더 많은 분들이 찾아올 거예요</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {received.map((request) => (
                <RequestCard
                  key={request.id}
                  request={request}
                  onExpired={() => handleRequestExpired(request.id)}
                />
              ))}
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
              {sent.map((req) => (
                <div key={req.id} className="flex items-center gap-4 bg-white rounded-2xl border border-[var(--border)] p-4 shadow-sm">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-[#111827]">
                      {req.target?.name ?? "알 수 없음"}
                    </p>
                    <p className="text-xs text-[#9CA3AF] mt-0.5">
                      {new Date(req.created_at).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} 신청
                    </p>
                    {req.status === "pending" && (
                      <CountdownTimer
                        expiresAt={expiresAt(req)}
                        onExpired={() => handleRequestExpired(req.id)}
                        compact
                        className="mt-1"
                      />
                    )}
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full", statusColor[req.status])}>
                      {statusLabel[req.status]}
                    </span>
                    {req.status === "accepted" && req.target && (
                      <Link href={`/profiles/${req.target_id}`} className="text-xs text-[#111827] font-medium">
                        보기 →
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      <BottomNav />
    </div>
  );
}
