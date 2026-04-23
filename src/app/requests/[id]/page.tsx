"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import PhotoSwiper from "@/components/profiles/PhotoSwiper";
import Modal from "@/components/ui/Modal";
import CountdownTimer from "@/components/ui/CountdownTimer";
import { getReceivedRequests, rejectRequest } from "@/services/requestService";
import { getSupabaseClient } from "@/lib/supabase";
import type { RequestWithRequester } from "@/types/database";

export default function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [request, setRequest] = useState<RequestWithRequester | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    async function fetchRequest() {
      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setCurrentUserId(user.id);
        const requests = await getReceivedRequests(user.id);
        const found = requests.find((r) => r.id === id) ?? null;
        setRequest(found);
        if (found?.status === "expired") setIsExpired(true);
      } catch (err) {
        console.error("Failed to fetch request:", err);
      } finally {
        setIsFetching(false);
      }
    }
    fetchRequest();
  }, [id]);

  async function handleReject() {
    if (!currentUserId || !request) return;
    setShowRejectModal(false);
    try {
      await rejectRequest(request.id, currentUserId);
      setShowToast(true);
      setTimeout(() => {
        setShowToast(false);
        router.push("/requests");
      }, 1800);
    } catch (err) {
      console.error("Failed to reject request:", err);
    }
  }

  async function handleAccept() {
    if (!currentUserId || !request) return;
    setShowAcceptModal(false);
    try {
      const res = await fetch('/api/requests/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId: request.id }),
      });
      if (!res.ok) throw new Error('accept failed');
      router.push(`/match/${request.id}`);
    } catch (err) {
      console.error("Failed to accept request:", err);
    }
  }

  if (isFetching) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#E5E7EB] border-t-[#111827] rounded-full animate-spin" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[var(--bg)]">
        <div className="text-center">
          <p className="text-[var(--text-muted)]">요청을 찾을 수 없습니다</p>
          <Link href="/requests" className="mt-4 inline-block text-sm text-[var(--primary)]">
            목록으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const requester = request.requester;
  if (!requester) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[var(--bg)]">
        <div className="text-center">
          <p className="text-[var(--text-muted)]">프로필을 불러올 수 없습니다</p>
          <Link href="/requests" className="mt-4 inline-block text-sm text-[var(--primary)]">
            목록으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }
  const currentYear = new Date().getFullYear();
  const requesterAge = currentYear - requester.birth_year + 1;
  const requesterResidence = requester.residence_district
    ? `${requester.residence_city} ${requester.residence_district}`
    : (requester.residence_city ?? '');

  return (
    <div className="min-h-dvh bg-white pb-40">
      <button
        onClick={() => router.back()}
        className="absolute top-4 left-4 z-20 w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
      </button>

      <PhotoSwiper photos={requester.photos} name={requester.name} />

      <div className="px-4 pt-5 flex flex-col gap-5">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">{requester.name}, {requesterAge}</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">{requesterResidence}</p>
        </div>

        {requester.referrer_comment && (
          <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">소개자 한마디</p>
            <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{requester.referrer_comment}</p>
          </div>
        )}

        <div className="h-px bg-[var(--border)]" />

        <section>
          <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">기본 정보</h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "나이", value: `${requesterAge}세` },
              { label: "키", value: `${requester.height}cm` },
              { label: "거주지", value: requesterResidence.split(" ")[0] },
            ].map((item) => (
              <div key={item.label} className="bg-[var(--bg)] rounded-2xl p-3 text-center">
                <p className="text-xs text-[var(--text-muted)] mb-1">{item.label}</p>
                <p className="text-sm font-semibold text-[var(--text)]">{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">스펙</h2>
          <div className="bg-[var(--bg)] rounded-2xl divide-y divide-[var(--border)]">
            {[
              { label: "학력", value: `${requester.education} · ${requester.school}` },
              { label: "직장", value: requester.company },
              { label: "직업", value: requester.job_title },
            ].map((item) => (
              <div key={item.label} className="flex gap-4 px-4 py-3">
                <span className="text-xs text-[var(--text-muted)] w-12 flex-shrink-0 pt-0.5">{item.label}</span>
                <span className="text-sm text-[var(--text)]">{item.value}</span>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">라이프스타일</h2>
          <div className="bg-[var(--bg)] rounded-2xl divide-y divide-[var(--border)]">
            {[
              { label: "MBTI", value: requester.mbti },
              { label: "흡연", value: requester.smoking },
              { label: "음주", value: requester.drinking },
              { label: "반려동물", value: requester.pet },
            ].map((item) => (
              <div key={item.label} className="flex gap-4 px-4 py-3">
                <span className="text-xs text-[var(--text-muted)] w-12 flex-shrink-0 pt-0.5">{item.label}</span>
                <span className="text-sm text-[var(--text)]">{item.value}</span>
              </div>
            ))}
            <div className="flex gap-4 px-4 py-3">
              <span className="text-xs text-[var(--text-muted)] w-12 flex-shrink-0 pt-0.5">취미</span>
              <div className="flex flex-wrap gap-1.5">
                {requester.hobbies.map((h) => (
                  <span key={h} className="text-xs bg-[#F3F4F6] text-[#374151] px-2.5 py-1 rounded-full font-medium">{h}</span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">자기소개</h2>
          <div className="bg-[var(--bg)] rounded-2xl p-4">
            <p className="text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap">{requester.bio}</p>
          </div>
        </section>

        {requester.preferred_free_text && (
          <section>
            <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">이상형</h2>
            <div className="bg-[var(--bg)] rounded-2xl p-4">
              <p className="text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap">{requester.preferred_free_text}</p>
            </div>
          </section>
        )}
      </div>

      {showToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-[var(--text)] text-white text-sm font-medium px-5 py-3 rounded-full shadow-lg animate-slide-up">
          거절 완료되었습니다
        </div>
      )}

      <div className="fixed bottom-0 left-0 right-0 px-5 py-4 pb-safe" style={{background:"rgba(255,255,255,0.92)",backdropFilter:"blur(20px) saturate(180%)",WebkitBackdropFilter:"blur(20px) saturate(180%)",borderTop:"0.5px solid rgba(0,0,0,0.1)"}}>
        {isExpired || request.status === "expired" ? (
          <div className="w-full h-14 rounded-2xl bg-[#F3F4F6] flex items-center justify-center text-sm font-semibold text-[#9CA3AF]">
            만료된 요청입니다
          </div>
        ) : request.status === "accepted" ? (
          <div className="flex flex-col gap-2">
            <p className="text-center text-sm font-medium text-[#16A34A]">상대방의 요청을 수락했어요!</p>
            <button
              onClick={() => router.push(`/match/${request.id}`)}
              className="w-full h-14 rounded-2xl bg-[var(--primary)] text-white text-sm font-semibold hover:bg-[#1F2937] active:scale-[0.98] transition-all shadow-sm"
            >
              카톡방 생성 요청하기!
            </button>
          </div>
        ) : request.status === "rejected" ? (
          <div className="w-full h-14 rounded-2xl bg-[#F3F4F6] flex items-center justify-center text-sm font-semibold text-[#9CA3AF]">
            거절한 요청입니다
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex justify-center">
              <CountdownTimer
                expiresAt={request.expires_at ?? new Date(new Date(request.created_at).getTime() + 24 * 60 * 60 * 1000).toISOString()}
                onExpired={() => setIsExpired(true)}
                compact
                label="수락 마감까지"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowRejectModal(true)}
                className="flex-1 h-14 rounded-2xl border border-[var(--border)] text-sm font-semibold text-[var(--text)] hover:bg-gray-50 active:scale-[0.98] transition-all"
              >
                거절하기
              </button>
              <button
                onClick={() => setShowAcceptModal(true)}
                className="flex-1 h-14 rounded-2xl bg-[var(--primary)] text-white text-sm font-semibold hover:bg-[#1F2937] active:scale-[0.98] transition-all shadow-sm"
              >
                수락하기
              </button>
            </div>
          </div>
        )}
      </div>

      <Modal
        isOpen={showRejectModal}
        onClose={() => setShowRejectModal(false)}
        title="요청 거절"
        description={`${requester.name}님의 소개팅 요청을 거절하시겠습니까?`}
        confirmLabel="거절하기"
        cancelLabel="취소"
        onConfirm={handleReject}
        variant="danger"
      />
      <Modal
        isOpen={showAcceptModal}
        onClose={() => setShowAcceptModal(false)}
        title="요청 수락"
        description={`${requester.name}님의 소개팅 요청을 수락하시겠습니까?`}
        confirmLabel="수락하기"
        cancelLabel="취소"
        onConfirm={handleAccept}
      />
    </div>
  );
}
