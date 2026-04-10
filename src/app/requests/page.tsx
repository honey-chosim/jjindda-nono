"use client";

import BottomNav from "@/components/layout/BottomNav";
import RequestCard from "@/components/requests/RequestCard";
import { mockRequests } from "@/data/mock-requests";

export default function RequestsPage() {
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
        <div className="flex items-center gap-2.5">
          <h1 className="text-[28px] font-black text-[#111827] tracking-[-0.03em]">
            받은 요청
          </h1>
          {mockRequests.filter((r) => r.status === "pending").length > 0 && (
            <span className="bg-[#DC2626] text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
              {mockRequests.filter((r) => r.status === "pending").length}
            </span>
          )}
        </div>
      </div>

      <div className="px-4 pt-[84px]">
        {mockRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <p className="text-[15px] font-semibold text-[#111827]">아직 받은 요청이 없어요</p>
            <p className="text-[13px] text-[#9CA3AF] mt-1">프로필을 완성하면 더 많은 분들이 찾아올 거예요</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {mockRequests.map((request) => (
              <RequestCard key={request.id} request={request} />
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
