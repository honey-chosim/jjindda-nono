"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import BottomNav from "@/components/layout/BottomNav";
import Card from "@/components/ui/Card";
import { getMyProfile } from "@/services/profileService";
import { getMyReferredUsers, verifyReferralProfile } from "@/services/referralService";
import { getSupabaseClient } from "@/lib/supabase";
import { PendingReviewBanner, isFullyVerified } from "@/components/ui/PendingReview";
import { cn } from "@/lib/utils";
import type { ProfileView, Profile, ReferralPayout } from "@/types/database";

interface ReferralBalance {
  totalEarned: number;
  paid: number;
  pending: number;
  countMale: number;
  countFemale: number;
}

type InviteCodeRow = { id: string; code: string; used_by: string | null; is_active: boolean; created_at: string };

type ReferredFriend = Profile & { my_verified: boolean };

const COMMENT_MAX = 200;

export default function MyPage() {
  const [profile, setProfile] = useState<ProfileView | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [inviteCodes, setInviteCodes] = useState<InviteCodeRow[]>([]);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [referredFriends, setReferredFriends] = useState<ReferredFriend[]>([]);
  const [verifyTarget, setVerifyTarget] = useState<ReferredFriend | null>(null);
  const [referrerComment, setReferrerComment] = useState("");
  const [verifyingAction, setVerifyingAction] = useState<"approve" | "reject" | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [referralBalance, setReferralBalance] = useState<ReferralBalance | null>(null);
  const [referralPayouts, setReferralPayouts] = useState<ReferralPayout[]>([]);
  const [showPayoutForm, setShowPayoutForm] = useState(false);
  const [payoutForm, setPayoutForm] = useState({ bankName: "", bankAccount: "", accountHolder: "", amount: 0 });
  const [submittingPayout, setSubmittingPayout] = useState(false);

  const refreshReferred = useCallback(async (userId: string) => {
    const friends = await getMyReferredUsers(userId);
    setReferredFriends(friends);
  }, []);

  useEffect(() => {
    async function fetchData() {
      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setCurrentUserId(user.id);
        const [profileData, codesRes, friends, referralRes] = await Promise.all([
          getMyProfile(user.id),
          fetch('/api/invite-codes/my'),
          getMyReferredUsers(user.id),
          fetch('/api/referral/payouts'),
        ]);
        setProfile(profileData);
        if (codesRes.ok) setInviteCodes(await codesRes.json());
        setReferredFriends(friends);
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

  function openVerifyModal(friend: ReferredFriend) {
    setVerifyTarget(friend);
    setReferrerComment("");
  }

  function closeVerifyModal() {
    if (verifyingAction) return;
    setVerifyTarget(null);
    setReferrerComment("");
  }

  async function submitVerify(approved: boolean) {
    if (!verifyTarget || !currentUserId) return;
    setVerifyingAction(approved ? "approve" : "reject");
    try {
      const trimmed = referrerComment.trim();
      await verifyReferralProfile({
        inviteeId: verifyTarget.id,
        approved,
        referrerComment: approved && trimmed ? trimmed : undefined,
      });
      await refreshReferred(currentUserId);
      setVerifyTarget(null);
      setReferrerComment("");
    } catch (err) {
      console.error("verify failed:", err);
      alert("처리 중 오류가 발생했습니다");
    } finally {
      setVerifyingAction(null);
    }
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

        {/* 내가 초대한 친구 (검증 + 검증완료 통합) */}
        <div>
          <h2 className="text-base font-bold text-[var(--text)] mb-3">내가 초대한 친구</h2>
          {referredFriends.length === 0 ? (
            <Card>
              <div className="py-6 text-center">
                <p className="text-sm text-[var(--text-muted)]">아직 초대한 친구가 없어요</p>
              </div>
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {referredFriends.map((friend) => {
                const age = new Date().getFullYear() - friend.birth_year + 1;
                const residence = friend.residence_district
                  ? `${friend.residence_city} ${friend.residence_district}`
                  : (friend.residence_city ?? "");
                return (
                  <Card key={friend.id} padding="sm">
                    <div className="flex items-center gap-3 p-2">
                      <div className="relative w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 bg-gray-100">
                        {friend.photos?.[0] ? (
                          <Image src={friend.photos[0]} alt={friend.name} fill className="object-cover" sizes="56px" />
                        ) : (
                          <div className="w-full h-full bg-gray-200" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-[var(--text)] truncate">{friend.name}</p>
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">
                          {friend.gender === 'male' ? '남' : '여'} · {age}세
                          {residence ? ` · ${residence}` : ''}
                        </p>
                        <div className="mt-1.5">
                          {friend.my_verified ? (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                              내 검증 완료
                            </span>
                          ) : (
                            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                              검증 대기
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        {friend.my_verified ? (
                          <Link
                            href={`/profiles/${friend.id}`}
                            className="text-xs font-semibold px-3 py-1.5 rounded-full border border-[var(--border)] text-[var(--text)]"
                          >
                            프로필 보기
                          </Link>
                        ) : (
                          <button
                            onClick={() => openVerifyModal(friend)}
                            className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[var(--primary)] text-white active:scale-95"
                          >
                            검증하기
                          </button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

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

      {/* 검증 모달 */}
      {verifyTarget && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center"
          onClick={closeVerifyModal}
        >
          <div
            className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-[var(--border)] px-5 py-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-[var(--text)]">친구 검증</h3>
              <button
                onClick={closeVerifyModal}
                disabled={!!verifyingAction}
                className="text-[var(--text-muted)] text-xl leading-none disabled:opacity-30"
              >
                ✕
              </button>
            </div>

            <div className="flex flex-col">
              {/* 사진 — 첫번째 풀와이드 */}
              {verifyTarget.photos?.[0] && (
                <div className="relative w-full aspect-[4/5] bg-gray-100">
                  <Image src={verifyTarget.photos[0]} alt={verifyTarget.name} fill className="object-cover" sizes="100vw" priority />
                </div>
              )}
              {/* 추가 사진 그리드 */}
              {verifyTarget.photos && verifyTarget.photos.length > 1 && (
                <div className="grid grid-cols-2 gap-1 px-1 pt-1">
                  {verifyTarget.photos.slice(1).map((photo, i) => (
                    <div key={i} className="relative aspect-square bg-gray-100 overflow-hidden rounded-md">
                      <Image src={photo} alt="" fill sizes="50vw" className="object-cover" />
                    </div>
                  ))}
                </div>
              )}

              <div className="p-5 flex flex-col gap-5">
                {/* 이름 + 기본 인적 사항 */}
                <div>
                  <p className="text-xl font-bold text-[var(--text)]">{verifyTarget.name}</p>
                  <p className="text-sm text-[var(--text-muted)] mt-1">
                    {verifyTarget.gender === 'male' ? '남' : '여'} · {new Date().getFullYear() - verifyTarget.birth_year + 1}세
                    {verifyTarget.height ? ` · ${verifyTarget.height}cm` : ''}
                  </p>
                  <p className="text-sm text-[var(--text-muted)] mt-0.5 truncate">
                    {verifyTarget.residence_city
                      ? `${verifyTarget.residence_city}${verifyTarget.residence_district ? ` ${verifyTarget.residence_district}` : ''}`
                      : '거주지 미입력'}
                  </p>
                </div>

                {/* 기본 정보 */}
                <div className="bg-[var(--bg)] rounded-2xl divide-y divide-[var(--border)]">
                  {[
                    { label: '학력', value: verifyTarget.education && verifyTarget.school ? `${verifyTarget.education} · ${verifyTarget.school}` : (verifyTarget.education || verifyTarget.school) },
                    { label: '직장', value: verifyTarget.company },
                    { label: '직업', value: verifyTarget.job_title },
                    { label: 'MBTI', value: verifyTarget.mbti },
                  ].filter((r) => r.value).map((r) => (
                    <div key={r.label} className="flex gap-4 px-4 py-2.5">
                      <span className="text-xs text-[var(--text-muted)] w-12 flex-shrink-0 pt-0.5">{r.label}</span>
                      <span className="text-sm text-[var(--text)] break-words">{r.value}</span>
                    </div>
                  ))}
                </div>

                {/* 라이프스타일 */}
                {(verifyTarget.smoking || verifyTarget.drinking || verifyTarget.pet || (verifyTarget.hobbies && verifyTarget.hobbies.length > 0)) && (
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">라이프스타일</p>
                    <div className="bg-[var(--bg)] rounded-2xl divide-y divide-[var(--border)]">
                      {[
                        { label: '흡연', value: verifyTarget.smoking },
                        { label: '음주', value: verifyTarget.drinking },
                        { label: '반려동물', value: verifyTarget.pet },
                        { label: '취미', value: verifyTarget.hobbies?.length ? verifyTarget.hobbies.join(', ') : null },
                      ].filter((r) => r.value).map((r) => (
                        <div key={r.label} className="flex gap-4 px-4 py-2.5">
                          <span className="text-xs text-[var(--text-muted)] w-14 flex-shrink-0 pt-0.5">{r.label}</span>
                          <span className="text-sm text-[var(--text)] break-words">{r.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 자기소개 */}
                {verifyTarget.bio && (
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">자기소개</p>
                    <div className="bg-[var(--bg)] rounded-2xl p-3">
                      <p className="text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap">{verifyTarget.bio}</p>
                    </div>
                  </div>
                )}

                {/* 이상형 */}
                {(verifyTarget.preferred_free_text || verifyTarget.preferred_age_min || verifyTarget.preferred_height_min || (verifyTarget.preferred_residence && verifyTarget.preferred_residence.length > 0)) && (
                  <div>
                    <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-2">이상형</p>
                    {verifyTarget.preferred_free_text && (
                      <div className="bg-[var(--bg)] rounded-2xl p-3 mb-2">
                        <p className="text-sm text-[var(--text)] leading-relaxed whitespace-pre-wrap">{verifyTarget.preferred_free_text}</p>
                      </div>
                    )}
                    <div className="bg-[var(--bg)] rounded-2xl divide-y divide-[var(--border)]">
                      {[
                        { label: '연령', value: verifyTarget.preferred_age_min && verifyTarget.preferred_age_max ? `${verifyTarget.preferred_age_min}~${verifyTarget.preferred_age_max}년생` : null },
                        { label: '최소 키', value: verifyTarget.preferred_height_min ? `${verifyTarget.preferred_height_min}cm` : null },
                        { label: '거주지', value: verifyTarget.preferred_residence?.length ? verifyTarget.preferred_residence.join(', ') : null },
                      ].filter((r) => r.value).map((r) => (
                        <div key={r.label} className="flex gap-4 px-4 py-2.5">
                          <span className="text-xs text-[var(--text-muted)] w-14 flex-shrink-0 pt-0.5">{r.label}</span>
                          <span className="text-sm text-[var(--text)] break-words">{r.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 소개자의 한마디 */}
              <div>
                <label className="block text-sm font-semibold text-[var(--text)] mb-1.5">
                  소개자의 한마디 <span className="text-xs font-normal text-[var(--text-muted)]">(선택)</span>
                </label>
                <textarea
                  value={referrerComment}
                  onChange={(e) => setReferrerComment(e.target.value.slice(0, COMMENT_MAX))}
                  placeholder="소개자만의 시각으로 친구를 한 줄 소개해주세요. 비워두셔도 됩니다."
                  rows={3}
                  className="w-full border border-[var(--border)] rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                />
                <p className="text-[11px] text-[var(--text-muted)] mt-1 text-right">
                  {referrerComment.length}/{COMMENT_MAX}
                </p>
              </div>
              </div>
            </div>

            <div className="sticky bottom-0 bg-white border-t border-[var(--border)] px-5 py-4 flex gap-2">
              <button
                onClick={() => submitVerify(false)}
                disabled={!!verifyingAction}
                className="flex-1 h-12 rounded-xl border border-[var(--border)] text-sm font-semibold text-[var(--text-muted)] disabled:opacity-50"
              >
                {verifyingAction === 'reject' ? '처리중...' : '거절'}
              </button>
              <button
                onClick={() => submitVerify(true)}
                disabled={!!verifyingAction}
                className="flex-1 h-12 rounded-xl bg-[var(--primary)] text-white text-sm font-semibold disabled:opacity-50"
              >
                {verifyingAction === 'approve' ? '처리중...' : '승인하기'}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
