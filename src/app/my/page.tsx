"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import BottomNav from "@/components/layout/BottomNav";
import Card from "@/components/ui/Card";
import { getMyProfile } from "@/services/profileService";
import { getSentRequests } from "@/services/requestService";
import { getReferredUsersToVerify, verifyReferralProfile } from "@/services/referralService";
import { getSupabaseClient } from "@/lib/supabase";
import { PendingReviewBanner, isFullyVerified } from "@/components/ui/PendingReview";
import { cn } from "@/lib/utils";
import type { ProfileView, DatingRequest, Profile, ReferralPayout } from "@/types/database";

interface ReferralBalance {
  totalEarned: number;
  paid: number;
  pending: number;
  countMale: number;
  countFemale: number;
}

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

type InviteCodeRow = { id: string; code: string; used_by: string | null; is_active: boolean; created_at: string };

export default function MyPage() {
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [sentRequests, setSentRequests] = useState<DatingRequest[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [inviteCodes, setInviteCodes] = useState<InviteCodeRow[]>([]);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [referralsToVerify, setReferralsToVerify] = useState<Profile[]>([]);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [referralBalance, setReferralBalance] = useState<ReferralBalance | null>(null);
  const [referralPayouts, setReferralPayouts] = useState<ReferralPayout[]>([]);
  const [showPayoutForm, setShowPayoutForm] = useState(false);
  const [payoutForm, setPayoutForm] = useState({ bankName: "", bankAccount: "", accountHolder: "", amount: 0 });
  const [submittingPayout, setSubmittingPayout] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const [profileData, requestsData, codesRes, referrals, referralRes] = await Promise.all([
          getMyProfile(user.id),
          getSentRequests(user.id),
          fetch('/api/invite-codes/my'),
          getReferredUsersToVerify(user.id),
          fetch('/api/referral/payouts'),
        ]);
        setProfile(profileData);
        setSentRequests(requestsData);
        if (codesRes.ok) setInviteCodes(await codesRes.json());
        setReferralsToVerify(referrals);
        if (referralRes.ok) {
          const rd = await referralRes.json();
          setReferralBalance(rd.balance);
          setReferralPayouts(rd.payouts ?? []);
        }
      } catch (err) {
        console.error("Failed to fetch my data:", err);
      } finally {
        setIsFetching(false);
      }
    }
    fetchData();
  }, []);

  async function generateCode() {
    setGeneratingCode(true);
    try {
      const res = await fetch('/api/invite-codes/my', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { alert(data.error); return; }
      setInviteCodes((prev) => [data, ...prev]);
    } finally {
      setGeneratingCode(false);
    }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    });
  }

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

      {!isFullyVerified(profile) && <PendingReviewBanner />}

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

        {/* 내 초대코드 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold text-[var(--text)]">내 초대코드</h2>
            <button
              onClick={generateCode}
              disabled={generatingCode}
              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#111827] text-white disabled:opacity-40 active:scale-95 transition-all"
            >
              {generatingCode ? "생성 중..." : "+ 코드 발급"}
            </button>
          </div>
          {inviteCodes.length === 0 ? (
            <Card>
              <div className="py-6 text-center">
                <p className="text-sm text-[var(--text-muted)]">지인에게 초대코드를 발급해보세요</p>
              </div>
            </Card>
          ) : (
            <div className="flex flex-col gap-2">
              {inviteCodes.map((c) => (
                <Card key={c.id} padding="sm">
                  <div className="flex items-center justify-between gap-3 px-2 py-1">
                    <div>
                      <p className="text-sm font-mono font-bold tracking-[0.15em] text-[#111827]">{c.code}</p>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">
                        {c.used_by ? "사용됨" : "미사용"} · {new Date(c.created_at).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}
                      </p>
                    </div>
                    {!c.used_by && (
                      <button
                        onClick={() => copyCode(c.code)}
                        className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#F3F4F6] text-[#111827] active:scale-95 transition-all"
                      >
                        {copiedCode === c.code ? "복사됨!" : "복사"}
                      </button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

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

      {/* 친구 검증 섹션 */}
      {referralsToVerify.length > 0 && (
        <div className="px-5 pt-4 pb-2">
          <h2 className="text-base font-bold text-[var(--text)] mb-3">내가 초대한 친구 검증</h2>
          <div className="flex flex-col gap-3">
            {referralsToVerify.map((invitee) => (
              <Card key={invitee.id} className="flex items-center gap-3 p-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--text)]">{invitee.name}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {invitee.gender === 'male' ? '남' : '여'} · {new Date().getFullYear() - invitee.birth_year}세
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={verifyingId === invitee.id}
                    onClick={async () => {
                      setVerifyingId(invitee.id);
                      try {
                        await verifyReferralProfile({ inviteeId: invitee.id, approved: false });
                        setReferralsToVerify((prev) => prev.filter((p) => p.id !== invitee.id));
                      } finally { setVerifyingId(null); }
                    }}
                    className="text-xs px-3 py-1.5 rounded-full border border-[var(--border)] text-[var(--text-muted)] disabled:opacity-50"
                  >
                    거절
                  </button>
                  <button
                    disabled={verifyingId === invitee.id}
                    onClick={async () => {
                      setVerifyingId(invitee.id);
                      try {
                        await verifyReferralProfile({ inviteeId: invitee.id, approved: true });
                        setReferralsToVerify((prev) => prev.filter((p) => p.id !== invitee.id));
                      } finally { setVerifyingId(null); }
                    }}
                    className="text-xs px-3 py-1.5 rounded-full bg-[var(--primary)] text-white font-semibold disabled:opacity-50"
                  >
                    {verifyingId === invitee.id ? '처리중...' : '승인'}
                  </button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* 레퍼럴 수익 섹션 */}
      {referralBalance && referralBalance.totalEarned > 0 && (
        <div className="px-5 pt-4 pb-2">
          <h2 className="text-base font-bold text-[var(--text)] mb-3">레퍼럴 수익</h2>
          <Card className="p-4 mb-3">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-[var(--text-muted)]">총 적립</span>
              <span className="text-sm font-semibold text-[var(--text)]">{referralBalance.totalEarned.toLocaleString()}원</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-[var(--text-muted)]">지급 완료</span>
              <span className="text-sm text-[var(--text-muted)]">{referralBalance.paid.toLocaleString()}원</span>
            </div>
            <div className="flex justify-between items-center border-t border-[var(--border)] pt-2">
              <span className="text-sm font-semibold text-[var(--text)]">출금 가능</span>
              <span className="text-sm font-bold text-[var(--primary)]">{referralBalance.pending.toLocaleString()}원</span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-2">
              남자 소개 {referralBalance.countMale}명(×5,000원) · 여자 소개 {referralBalance.countFemale}명(×15,000원)
            </p>
          </Card>
          {referralBalance.pending > 0 && (
            <button
              onClick={() => setShowPayoutForm((v) => !v)}
              className="w-full py-2.5 rounded-xl bg-[var(--primary)] text-white text-sm font-semibold mb-3"
            >
              {showPayoutForm ? '취소' : '지급 신청하기'}
            </button>
          )}
          {showPayoutForm && (
            <Card className="p-4 mb-3 flex flex-col gap-2">
              <input placeholder="은행명" value={payoutForm.bankName}
                onChange={(e) => setPayoutForm((f) => ({ ...f, bankName: e.target.value }))}
                className="border border-[var(--border)] rounded-lg px-3 py-2 text-sm" />
              <input placeholder="계좌번호" value={payoutForm.bankAccount}
                onChange={(e) => setPayoutForm((f) => ({ ...f, bankAccount: e.target.value }))}
                className="border border-[var(--border)] rounded-lg px-3 py-2 text-sm" />
              <input placeholder="예금주" value={payoutForm.accountHolder}
                onChange={(e) => setPayoutForm((f) => ({ ...f, accountHolder: e.target.value }))}
                className="border border-[var(--border)] rounded-lg px-3 py-2 text-sm" />
              <button
                disabled={submittingPayout}
                onClick={async () => {
                  setSubmittingPayout(true);
                  try {
                    const res = await fetch('/api/referral/payouts', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ ...payoutForm, amount: referralBalance.pending }),
                    });
                    if (!res.ok) { alert((await res.json()).error); return; }
                    setShowPayoutForm(false);
                    setReferralBalance((b) => b ? { ...b, pending: 0, paid: b.paid + b.pending } : b);
                  } finally { setSubmittingPayout(false); }
                }}
                className="py-2 rounded-lg bg-[var(--primary)] text-white text-sm font-semibold disabled:opacity-50"
              >
                {submittingPayout ? '처리중...' : `${referralBalance.pending.toLocaleString()}원 신청`}
              </button>
            </Card>
          )}
          {referralPayouts.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-[var(--text-muted)] font-semibold">지급 이력</p>
              {referralPayouts.map((p) => (
                <Card key={p.id} className="flex justify-between items-center p-3">
                  <span className="text-sm text-[var(--text)]">{p.amount_requested?.toLocaleString()}원</span>
                  <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full",
                    p.status === 'paid' ? "bg-green-100 text-green-700" :
                    p.status === 'approved' ? "bg-blue-100 text-blue-700" :
                    p.status === 'rejected' ? "bg-red-100 text-red-700" :
                    "bg-yellow-100 text-yellow-700"
                  )}>
                    {p.status === 'paid' ? '지급완료' : p.status === 'approved' ? '승인됨' : p.status === 'rejected' ? '거절됨' : '검토중'}
                  </span>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      <BottomNav />
    </div>
  );
}
