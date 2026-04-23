"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import CountdownTimer from "@/components/ui/CountdownTimer";
import { getMatchByRequestId, markPaymentComplete, getPaymentDeadline } from "@/services/matchService";
import { getSupabaseClient } from "@/lib/supabase";
import type { MatchWithProfiles } from "@/types/database";

export default function MatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [match, setMatch] = useState<MatchWithProfiles | null>(null);
  const [isFetching, setIsFetching] = useState(true);
  const [paid, setPaid] = useState(false);
  const [paymentExpired, setPaymentExpired] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  function copyAccount() {
    navigator.clipboard.writeText("979-053466-01-019").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  useEffect(() => {
    async function fetchMatch() {
      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setCurrentUserId(user.id);
        const matchData = await getMatchByRequestId(id);
        setMatch(matchData);
        if (matchData?.payment_status === 'paid') setPaid(true);
        if (matchData?.payment_status === 'expired') setPaymentExpired(true);
      } catch (err) {
        console.error("Failed to fetch match:", err);
      } finally {
        setIsFetching(false);
      }
    }
    fetchMatch();
  }, [id]);

  async function handlePaid() {
    if (!match || !currentUserId) return;
    try {
      await markPaymentComplete(match.id, currentUserId);
      setPaid(true);
    } catch (err) {
      console.error("Failed to mark payment:", err);
      setPaid(true);
    }
  }

  const matchName = match
    ? (match.user1_id === currentUserId ? (match.user2?.name ?? "상대방") : (match.user1?.name ?? "상대방"))
    : "상대방";

  const isPayer = !!(match && currentUserId && match.payer_id === currentUserId);
  const deadlineIso = match ? getPaymentDeadline(match).toISOString() : null;

  if (isFetching) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#E5E7EB] border-t-[#111827] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-white flex flex-col">
      <div className="px-5 pb-3 flex items-center gap-3" style={{ paddingTop: "max(16px, env(safe-area-inset-top))" }}>
        <button
          onClick={() => router.push("/requests")}
          className="flex items-center gap-1 text-sm text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
          뒤로
        </button>
      </div>

      <div className="flex-1 px-4 py-4 flex flex-col gap-4 max-w-sm mx-auto w-full">
        <div className="text-center py-3">
          <div className="text-4xl mb-3">{paymentExpired ? "⏰" : "🎉"}</div>
          <h1 className="text-xl font-bold text-[var(--text)]">
            {paymentExpired ? "결제 시간 만료" : "매칭 성사!"}
          </h1>
          <p className="mt-1.5 text-sm text-[var(--text-muted)] leading-relaxed">
            {paymentExpired ? (
              "결제 시간이 초과되어 매칭이 취소되었습니다"
            ) : (
              <>
                <span className="text-[var(--text)] font-semibold">{matchName}</span>님이
                <br />소개팅을 수락했습니다
              </>
            )}
          </p>
        </div>

        {!paymentExpired && match && deadlineIso && (
          <>
            {!paid && (
              <div className="flex items-center justify-center gap-2 bg-[#FEF3C7] rounded-2xl px-4 py-3">
                <CountdownTimer
                  expiresAt={deadlineIso}
                  onExpired={() => setPaymentExpired(true)}
                />
              </div>
            )}

            {isPayer ? (
              <>
                <div className="bg-[var(--surface)] rounded-3xl border border-[var(--border)] shadow-sm overflow-hidden">
                  <div className="px-5 pt-5 pb-4 border-b border-[var(--border)]">
                    <h2 className="text-base font-bold text-[var(--text)]">소개팅 비용 안내</h2>
                    <p className="mt-1 text-sm text-[var(--text-muted)]">아래 계좌로 입금해 주세요</p>
                  </div>
                  <div className="px-5 py-4 flex items-center justify-between border-b border-[var(--border)]">
                    <span className="text-sm text-[var(--text-muted)]">결제 금액</span>
                    <span className="text-xl font-bold text-[var(--text)]">70,000원</span>
                  </div>
                  <div className="px-5 py-4 bg-gray-50 divide-y divide-[var(--border)]">
                    {[
                      { label: "은행", value: "기업은행" },
                      { label: "계좌번호", value: "979-053466-01-019" },
                      { label: "예금주", value: "심규헌" },
                    ].map((item) => (
                      <div key={item.label} className="flex justify-between py-2.5">
                        <span className="text-xs text-[var(--text-muted)]">{item.label}</span>
                        <span className="text-sm font-semibold text-[var(--text)] font-mono tracking-wide">{item.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="px-5 py-3">
                    <button
                      onClick={copyAccount}
                      className="w-full h-11 rounded-xl bg-[#F3F4F6] text-sm font-semibold text-[#111827] active:scale-[0.98] transition-all"
                    >
                      {copied ? "복사됐어요!" : "계좌번호 복사하기"}
                    </button>
                  </div>
                  <div className="px-5 pb-4 bg-[#F3F4F6]">
                    <p className="text-xs text-[#374151] leading-relaxed text-center font-medium">
                      입금 후 1시간 내 카카오톡 단톡방을 개설해드립니다
                    </p>
                  </div>
                </div>

                <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-4">
                  <div className="flex gap-3">
                    <span className="text-lg flex-shrink-0">💬</span>
                    <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                      운영팀이 양측의 카카오톡을 통해 단톡방을 직접 만들어드립니다.
                      연락처는 절대 공개되지 않습니다.
                    </p>
                  </div>
                </div>

                {paid ? (
                  <div className="flex items-center justify-center gap-2 w-full h-12 rounded-2xl bg-green-50 text-green-700 font-semibold text-sm border border-green-200">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    확인했습니다. 곧 연락드릴게요
                  </div>
                ) : (
                  <button
                    onClick={handlePaid}
                    className="w-full h-12 rounded-2xl bg-[var(--primary)] text-white text-sm font-semibold hover:bg-[#1F2937] active:scale-[0.98] transition-all shadow-sm"
                  >
                    입금 완료 알리기
                  </button>
                )}
              </>
            ) : (
              <>
                <div className="bg-[var(--surface)] rounded-3xl border border-[var(--border)] shadow-sm overflow-hidden">
                  <div className="px-5 py-6 text-center">
                    <div className="text-3xl mb-2">⏳</div>
                    <h2 className="text-base font-bold text-[var(--text)]">
                      상대방의 결제를 기다리고 있어요
                    </h2>
                    <p className="mt-2 text-sm text-[var(--text-muted)] leading-relaxed">
                      <span className="text-[var(--text)] font-semibold">{matchName}</span>님이
                      <br />소개팅 비용을 입금하면 단톡방이 개설됩니다
                    </p>
                  </div>
                </div>

                <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-4">
                  <div className="flex gap-3">
                    <span className="text-lg flex-shrink-0">💬</span>
                    <p className="text-sm text-[var(--text-muted)] leading-relaxed">
                      입금이 확인되면 운영팀이 양측의 카카오톡을 통해 단톡방을 직접 만들어드립니다.
                      연락처는 절대 공개되지 않습니다.
                    </p>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        <Link
          href="/profiles"
          className="text-sm text-[var(--text-muted)] text-center hover:text-[var(--text)] transition-colors"
        >
          탐색으로 돌아가기
        </Link>
      </div>
    </div>
  );
}
