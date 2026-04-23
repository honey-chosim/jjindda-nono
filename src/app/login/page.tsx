"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSupabaseClient } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const digits = phone.replace(/\D/g, "");

  async function sendCode() {
    if (digits.length < 10) { setError("올바른 전화번호를 입력해주세요"); return; }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: digits }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "전송 실패");
      }
      setCodeSent(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "오류가 발생했습니다");
    } finally {
      setLoading(false);
    }
  }

  async function verify() {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: digits, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "인증 실패");

      const supabase = getSupabaseClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: data.tokenHash,
        type: "email",
      });
      if (verifyError) throw verifyError;

      // 신규 유저(프로필 없음)는 invite code 거쳐 가입해야 함
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", user.id)
          .maybeSingle();
        if (!profile) {
          await supabase.auth.signOut();
          setError("가입된 계정이 없습니다. 초대 코드로 가입해주세요.");
          setTimeout(() => router.push("/"), 1500);
          return;
        }
      }

      router.push("/profiles");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "인증에 실패했습니다");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-dvh bg-white flex flex-col items-center">
      <div className="w-full max-w-sm px-6 pt-12 pb-0">
        <span className="text-xs font-semibold tracking-[0.18em] text-[#9CA3AF] uppercase">
          Private
        </span>
      </div>

      <div className="flex-1 flex flex-col justify-center px-6 pb-8 w-full max-w-sm">
        <div>
          <h1 className="text-[36px] font-black text-[#111827] leading-tight tracking-[-0.03em] mb-2">
            로그인
          </h1>
          <p className="text-[15px] text-[#6B7280] leading-relaxed mb-10">
            가입 시 사용한 전화번호로 로그인하세요.
          </p>

          <div className="flex flex-col gap-3">
            <div>
              <div className="flex gap-2">
                <div className="flex-1 min-w-0">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => { setPhone(e.target.value); setError(""); }}
                    placeholder="전화번호 입력"
                    disabled={codeSent}
                    className="w-full h-[56px] px-5 rounded-2xl bg-[#F3F4F6] text-[15px] text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#111827] focus:bg-white transition-all disabled:opacity-50"
                  />
                </div>
                {!codeSent && (
                  <button
                    type="button"
                    onClick={sendCode}
                    disabled={loading || digits.length < 10}
                    className="h-[56px] px-5 rounded-2xl bg-[#111827] text-white text-[14px] font-semibold flex-shrink-0 disabled:opacity-30 disabled:cursor-not-allowed active:scale-[0.98] transition-all"
                  >
                    {loading ? "전송 중" : "인증번호 받기"}
                  </button>
                )}
              </div>
            </div>

            {codeSent && (
              <input
                type="text"
                value={code}
                onChange={(e) => { setCode(e.target.value); setError(""); }}
                placeholder="인증번호 6자리"
                maxLength={6}
                className="w-full h-[56px] px-5 rounded-2xl bg-[#F3F4F6] text-[15px] text-center font-bold tracking-[0.2em] text-[#111827] placeholder:font-normal placeholder:tracking-normal placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#111827] focus:bg-white transition-all"
              />
            )}

            {error && (
              <p className="text-sm text-[#DC2626] font-medium text-center animate-slide-up">{error}</p>
            )}

            {codeSent && (
              <button
                type="button"
                onClick={verify}
                disabled={loading || code.length !== 6}
                className="w-full h-[56px] rounded-2xl bg-[#111827] text-white text-[16px] font-semibold transition-all active:scale-[0.98] disabled:opacity-30 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    확인 중
                  </span>
                ) : "로그인"}
              </button>
            )}

            {codeSent && (
              <button
                type="button"
                onClick={sendCode}
                disabled={loading}
                className="text-xs text-[#6B7280] underline-offset-2 hover:underline text-center"
              >
                인증번호 재발송
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="w-full max-w-sm px-6 pb-10 text-center">
        <p className="text-[13px] text-[#9CA3AF]">
          계정이 없으신가요?{" "}
          <a href="/" className="text-[#111827] font-medium underline-offset-2 hover:underline">
            초대 코드로 가입
          </a>
        </p>
      </div>
    </main>
  );
}
