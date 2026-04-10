"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useOnboardingStore } from "@/store/onboardingStore";
import { validateInviteCode } from "@/services/inviteService";

export default function LandingPage() {
  const router = useRouter();
  const setInviteCode = useOnboardingStore((s) => s.setInviteCode);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 8) {
      setError("유효하지 않은 코드입니다");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const valid = await validateInviteCode(code);
      if (!valid) {
        setError("유효하지 않은 초대 코드입니다");
        setLoading(false);
        return;
      }
      setInviteCode(code);
      router.push("/onboarding/2");
    } catch {
      setError("코드 확인 중 오류가 발생했습니다");
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh bg-white flex flex-col">
      {/* Top wordmark */}
      <div className="px-6 pt-12 pb-0">
        <span className="text-xs font-semibold tracking-[0.18em] text-[#9CA3AF] uppercase">
          Private
        </span>
      </div>

      {/* Hero */}
      <div className="flex-1 flex flex-col justify-center px-6 pb-8">
        <div className="max-w-sm">
          {/* Headline */}
          <h1 className="text-[52px] font-black text-[#111827] leading-[1.05] tracking-[-0.03em] mb-3">
            찐따노노
          </h1>
          <p className="text-[18px] font-medium text-[#111827] leading-snug mb-2">
            검증된 사람들만의 소개팅
          </p>
          <p className="text-[15px] text-[#6B7280] leading-relaxed mb-12">
            초대받은 분만 가입할 수 있습니다.
            <br />
            지인의 초대 코드를 입력해 시작하세요.
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <div>
              <input
                type="text"
                value={code}
                onChange={(e) => {
                  setCode(e.target.value.toUpperCase().replace(/\s/g, ""));
                  setError("");
                }}
                placeholder="초대 코드 8자리"
                maxLength={8}
                autoCapitalize="characters"
                className={`w-full h-[56px] px-5 rounded-2xl bg-[#F3F4F6] text-center text-lg font-bold tracking-[0.2em] text-[#111827] placeholder:font-normal placeholder:tracking-normal placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 transition-all ${
                  error
                    ? "ring-2 ring-[#DC2626] bg-[#FEF2F2]"
                    : "focus:ring-[#111827] focus:bg-white"
                }`}
              />
              {error && (
                <p className="mt-2 text-sm text-[#DC2626] font-medium text-center animate-slide-up">
                  {error}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || code.length === 0}
              className="w-full h-[56px] rounded-2xl bg-[#111827] text-white text-[16px] font-semibold tracking-[-0.01em] transition-all active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  확인 중
                </span>
              ) : (
                "시작하기"
              )}
            </button>
          </form>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 pb-10 text-center">
        <p className="text-[13px] text-[#9CA3AF]">
          초대 코드가 없으신가요?{" "}
          <button className="text-[#111827] font-medium underline-offset-2 hover:underline">
            운영팀에 문의
          </button>
        </p>
      </div>
    </main>
  );
}
