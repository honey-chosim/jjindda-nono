"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { mockProfiles } from "@/data/mock-profiles";
import PhotoSwiper from "@/components/profiles/PhotoSwiper";
import Modal from "@/components/ui/Modal";
import { useAppStore } from "@/store/appStore";
import { cn } from "@/lib/utils";

export default function ProfileDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { hasUsedRequestToday, addSentRequest } = useAppStore();
  const [showModal, setShowModal] = useState(false);
  const [requested, setRequested] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const profile = mockProfiles.find((p) => p.id === id);

  if (!profile) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[var(--bg)]">
        <div className="text-center">
          <p className="text-[var(--text-muted)]">프로필을 찾을 수 없습니다</p>
          <Link href="/profiles" className="mt-4 inline-block text-sm text-[var(--primary)]">
            목록으로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  const alreadyRequested = profile.isRequested || requested;

  function handleConfirmRequest() {
    setShowModal(false);
    addSentRequest(profile!.id, profile!.name);
    setRequested(true);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  }

  return (
    <div className="min-h-dvh bg-white pb-40">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="absolute top-4 left-4 z-20 w-10 h-10 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center text-white"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
      </button>

      {/* Photo gallery */}
      <PhotoSwiper photos={profile.photos} name={profile.name} />

      {/* Content */}
      <div className="px-4 pt-5 flex flex-col gap-5">
        {/* Name + basics */}
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)]">
            {profile.name}, {profile.age}
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            {profile.residence}
          </p>
        </div>

        {/* Divider */}
        <div className="h-px bg-[var(--border)]" />

        {/* 기본 정보 */}
        <section>
          <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
            기본 정보
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "나이", value: `${profile.age}세` },
              { label: "키", value: `${profile.height}cm` },
              { label: "거주지", value: profile.residence.split(" ")[0] },
            ].map((item) => (
              <div
                key={item.label}
                className="bg-[var(--bg)] rounded-2xl p-3 text-center"
              >
                <p className="text-xs text-[var(--text-muted)] mb-1">{item.label}</p>
                <p className="text-sm font-semibold text-[var(--text)]">{item.value}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 스펙 */}
        <section>
          <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
            스펙
          </h2>
          <div className="bg-[var(--bg)] rounded-2xl divide-y divide-[var(--border)]">
            {[
              { label: "학력", value: `${profile.education} · ${profile.school}` },
              { label: "직장", value: profile.company },
              { label: "직업", value: profile.jobTitle },
            ].map((item) => (
              <div key={item.label} className="flex gap-4 px-4 py-3">
                <span className="text-xs text-[var(--text-muted)] w-12 flex-shrink-0 pt-0.5">
                  {item.label}
                </span>
                <span className="text-sm text-[var(--text)]">{item.value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 라이프스타일 */}
        <section>
          <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
            라이프스타일
          </h2>
          <div className="bg-[var(--bg)] rounded-2xl divide-y divide-[var(--border)]">
            {[
              { label: "MBTI", value: profile.mbti },
              { label: "흡연", value: profile.smoking },
              { label: "음주", value: profile.drinking },
              { label: "반려동물", value: profile.pet },
            ].map((item) => (
              <div key={item.label} className="flex gap-4 px-4 py-3">
                <span className="text-xs text-[var(--text-muted)] w-12 flex-shrink-0 pt-0.5">
                  {item.label}
                </span>
                <span className="text-sm text-[var(--text)]">{item.value}</span>
              </div>
            ))}
            <div className="flex gap-4 px-4 py-3">
              <span className="text-xs text-[var(--text-muted)] w-12 flex-shrink-0 pt-0.5">
                취미
              </span>
              <div className="flex flex-wrap gap-1.5">
                {profile.hobbies.map((h) => (
                  <span
                    key={h}
                    className="text-xs bg-[#F3F4F6] text-[#374151] px-2.5 py-1 rounded-full font-medium"
                  >
                    {h}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* 자기소개 */}
        <section>
          <h2 className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
            자기소개 및 이상형
          </h2>
          <div className="bg-[var(--bg)] rounded-2xl p-4">
            <p className="text-sm text-[var(--text)] leading-relaxed">
              {profile.bio}
            </p>
          </div>
        </section>
      </div>

      {/* Success toast */}
      {showSuccess && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-[var(--text)] text-white text-sm font-medium px-5 py-3 rounded-full shadow-lg animate-slide-up">
          소개팅 신청이 완료되었습니다
        </div>
      )}

      {/* Fixed bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 px-5 py-4 pb-safe" style={{background:"rgba(255,255,255,0.92)",backdropFilter:"blur(20px) saturate(180%)",WebkitBackdropFilter:"blur(20px) saturate(180%)",borderTop:"0.5px solid rgba(0,0,0,0.1)"}}>
        {hasUsedRequestToday || alreadyRequested ? (
          <div className="flex items-center justify-center gap-2 w-full h-14 rounded-2xl bg-gray-100 text-[var(--text-muted)]">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            <span className="text-sm font-medium">
              {alreadyRequested ? "신청 완료" : "오늘 신청이 완료되었습니다"}
            </span>
          </div>
        ) : (
          <button
            onClick={() => setShowModal(true)}
            className="w-full h-14 rounded-2xl bg-[var(--primary)] text-white text-base font-semibold hover:bg-[#1F2937] active:scale-[0.98] transition-all shadow-sm "
          >
            소개팅 신청하기
          </button>
        )}
      </div>

      {/* Confirm modal */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title="소개팅 신청"
        description={`${profile.name}님께 소개팅을 신청하시겠습니까?\n오늘 하루 1회만 신청 가능합니다.`}
        confirmLabel="신청하기"
        cancelLabel="취소"
        onConfirm={handleConfirmRequest}
      />
    </div>
  );
}
