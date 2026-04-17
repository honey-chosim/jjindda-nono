"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getMyProfile, updateProfile } from "@/services/profileService";
import { getSupabaseClient } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import type { ProfileView } from "@/types/database";

// ─── Constants ────────────────────────────────────────────────────────────────

const EDUCATION_OPTIONS = ["고등학교졸", "대학교재학", "대학교졸", "대학원재학", "대학원졸"];

const CITIES = [
  "서울", "경기", "인천", "부산", "대구", "대전", "광주", "울산", "세종",
  "강원", "충북", "충남", "전북", "전남", "경북", "경남", "제주",
];

const SMOKING_OPTIONS = ["비흡연", "흡연", "금연 중"];
const DRINKING_OPTIONS = ["안 마심", "사회적 음주", "즐겨 마심"];
const PET_OPTIONS = ["없음", "강아지", "고양이", "기타"];
const HOBBY_OPTIONS = [
  "독서", "영화", "음악", "여행", "요리", "헬스", "등산", "테니스",
  "골프", "게임", "사진", "그림", "댄스", "반려동물", "봉사활동",
];
const MAX_HOBBIES = 5;
const MAX_PHOTOS = 5;

const YEARS = Array.from({ length: 40 }, (_, i) => String(2005 - i));
const MONTHS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));

// ─── Image compression ────────────────────────────────────────────────────────

async function compressImage(file: File, maxPx = 1200, quality = 0.85): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = document.createElement("img");
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        if (width > height) { height = Math.round((height / width) * maxPx); width = maxPx; }
        else { width = Math.round((width / height) * maxPx); height = maxPx; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("압축 실패")), "image/jpeg", quality);
    };
    img.onerror = reject;
    img.src = url;
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-[#6B7280] uppercase tracking-wider mb-3">
      {children}
    </p>
  );
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[13px] font-semibold text-[#6B7280]">{label}</label>
      {children}
      {hint && <p className="text-xs text-[#9CA3AF]">{hint}</p>}
    </div>
  );
}

function TextInput({
  value, onChange, placeholder, type = "text", suffix, disabled,
}: {
  value: string; onChange?: (v: string) => void; placeholder?: string;
  type?: string; suffix?: string; disabled?: boolean;
}) {
  return (
    <div className="relative">
      <input
        type={type}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          "w-full px-4 py-3 rounded-2xl bg-[#F3F4F6] text-[15px] text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#111827] focus:bg-white transition-all border border-transparent",
          suffix && "pr-12",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      />
      {suffix && (
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[#6B7280]">{suffix}</span>
      )}
    </div>
  );
}

function SelectInput({
  value, onChange, options, placeholder,
}: {
  value: string; onChange: (v: string) => void; options: string[]; placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-4 py-3 rounded-2xl bg-[#F3F4F6] text-[15px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#111827] focus:bg-white transition-all border border-transparent appearance-none"
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function ToggleGroup({
  options, value, onChange,
}: {
  options: string[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt}
          type="button"
          onClick={() => onChange(opt)}
          className={cn(
            "px-4 py-2.5 rounded-xl text-[14px] font-medium transition-all",
            value === opt
              ? "bg-[#111827] text-white"
              : "bg-[#F3F4F6] text-[#111827]"
          )}
        >
          {opt}
        </button>
      ))}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EditProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState("");

  // Form state
  const [name, setName] = useState("");
  const [gender, setGender] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthDay, setBirthDay] = useState("");
  const [height, setHeight] = useState("");
  const [education, setEducation] = useState("");
  const [school, setSchool] = useState("");
  const [company, setCompany] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [residenceCity, setResidenceCity] = useState("");
  const [residenceDistrict, setResidenceDistrict] = useState("");
  const [smoking, setSmoking] = useState("");
  const [drinking, setDrinking] = useState("");
  const [mbti, setMbti] = useState("");
  const [hobbies, setHobbies] = useState<string[]>([]);
  const [pet, setPet] = useState("");
  const [bio, setBio] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);

  useEffect(() => {
    async function load() {
      try {
        const supabase = getSupabaseClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) { router.replace("/onboarding/2"); return; }
        setUserId(user.id);

        const profile: ProfileView | null = await getMyProfile(user.id);
        if (!profile) return;

        setName(profile.name ?? "");
        setGender(profile.gender ?? "");
        setBirthYear(String(profile.birth_year ?? ""));
        setBirthMonth(String(profile.birth_month ?? ""));
        setBirthDay(String(profile.birth_day ?? ""));
        setHeight(String(profile.height ?? ""));
        setEducation(profile.education ?? "");
        setSchool(profile.school ?? "");
        setCompany(profile.company ?? "");
        setJobTitle(profile.job_title ?? "");
        setResidenceCity(profile.residence_city ?? "");
        setResidenceDistrict(profile.residence_district ?? "");
        setSmoking(profile.smoking ?? "");
        setDrinking(profile.drinking ?? "");
        setMbti(profile.mbti ?? "");
        setHobbies(profile.hobbies ?? []);
        setPet(profile.pet ?? "");
        setBio(profile.bio ?? "");
        setPhotos(profile.photos ?? []);
      } catch (err) {
        console.error(err);
        setError("프로필을 불러오지 못했습니다");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  function toggleHobby(hobby: string) {
    setHobbies((prev) => {
      if (prev.includes(hobby)) return prev.filter((h) => h !== hobby);
      if (prev.length >= MAX_HOBBIES) return prev;
      return [...prev, hobby];
    });
  }

  async function handlePhotoAdd(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || photos.length >= MAX_PHOTOS) return;
    setUploading(true);
    setError("");
    try {
      const supabase = getSupabaseClient();
      const compressed = await compressImage(file);
      const path = `${userId}/${Date.now()}.jpg`;
      const { error: uploadErr } = await supabase.storage
        .from("profile-photos")
        .upload(path, compressed, { contentType: "image/jpeg", upsert: false });
      if (uploadErr) throw uploadErr;
      const { data: { publicUrl } } = supabase.storage.from("profile-photos").getPublicUrl(path);
      setPhotos((prev) => [...prev, publicUrl]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "업로드에 실패했습니다");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeletePhoto(url: string) {
    // Extract storage path from public URL
    const supabase = getSupabaseClient();
    const pathMatch = url.match(/profile-photos\/(.+)$/);
    if (pathMatch) {
      await supabase.storage.from("profile-photos").remove([pathMatch[1]]);
    }
    setPhotos((prev) => prev.filter((p) => p !== url));
  }

  async function handleSave() {
    setError("");
    setSaving(true);
    try {
      await updateProfile(userId, {
        name,
        birth_year: Number(birthYear),
        birth_month: Number(birthMonth),
        birth_day: Number(birthDay),
        height: Number(height),
        education,
        school,
        company,
        job_title: jobTitle,
        residence_city: residenceCity,
        residence_district: residenceDistrict,
        smoking,
        drinking,
        mbti,
        hobbies,
        pet,
        bio,
        photos,
      });
      router.push("/my");
    } catch (err) {
      setError(err instanceof Error ? err.message : "저장에 실패했습니다");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-dvh bg-white flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#E5E7EB] border-t-[#111827] rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-white pb-32">
      {/* Header */}
      <div
        className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3"
        style={{
          background: "rgba(255,255,255,0.88)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderBottom: "0.5px solid rgba(0,0,0,0.08)",
        }}
      >
        <button
          type="button"
          onClick={() => router.push("/my")}
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[#F3F4F6] transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-[18px] font-bold text-[#111827] tracking-[-0.02em]">프로필 수정</h1>
      </div>

      <div className="px-4 pt-6 flex flex-col gap-8">
        {/* 섹션1: 기본 정보 */}
        <section>
          <SectionTitle>기본 정보</SectionTitle>
          <div className="flex flex-col gap-4">
            <Field label="닉네임">
              <TextInput value={name} onChange={setName} placeholder="닉네임" />
            </Field>

            <Field label="성별" hint="성별은 변경할 수 없습니다">
              <TextInput
                value={gender === "male" ? "남성" : gender === "female" ? "여성" : gender}
                disabled
              />
            </Field>

            <Field label="생년월일">
              <div className="grid grid-cols-3 gap-2">
                <SelectInput
                  value={birthYear}
                  onChange={setBirthYear}
                  options={YEARS}
                  placeholder="년도"
                />
                <SelectInput
                  value={birthMonth}
                  onChange={setBirthMonth}
                  options={MONTHS}
                  placeholder="월"
                />
                <SelectInput
                  value={birthDay}
                  onChange={setBirthDay}
                  options={DAYS}
                  placeholder="일"
                />
              </div>
            </Field>
          </div>
        </section>

        {/* 섹션2: 외모·스펙 */}
        <section>
          <SectionTitle>외모 · 스펙</SectionTitle>
          <div className="flex flex-col gap-4">
            <Field label="키">
              <TextInput value={height} onChange={setHeight} type="number" placeholder="키" suffix="cm" />
            </Field>

            <Field label="최종학력">
              <SelectInput
                value={education}
                onChange={setEducation}
                options={EDUCATION_OPTIONS}
                placeholder="선택"
              />
            </Field>

            <Field label="학교">
              <TextInput value={school} onChange={setSchool} placeholder="학교명" />
            </Field>

            <Field label="직장">
              <TextInput value={company} onChange={setCompany} placeholder="회사명" />
            </Field>

            <Field label="직업">
              <TextInput value={jobTitle} onChange={setJobTitle} placeholder="직함 / 직종" />
            </Field>

            <Field label="거주 도시">
              <SelectInput
                value={residenceCity}
                onChange={setResidenceCity}
                options={CITIES}
                placeholder="선택"
              />
            </Field>

            <Field label="거주 구/군">
              <TextInput value={residenceDistrict} onChange={setResidenceDistrict} placeholder="구·군 입력" />
            </Field>
          </div>
        </section>

        {/* 섹션3: 라이프스타일 */}
        <section>
          <SectionTitle>라이프스타일</SectionTitle>
          <div className="flex flex-col gap-5">
            <Field label="흡연">
              <ToggleGroup options={SMOKING_OPTIONS} value={smoking} onChange={setSmoking} />
            </Field>

            <Field label="음주">
              <ToggleGroup options={DRINKING_OPTIONS} value={drinking} onChange={setDrinking} />
            </Field>

            <Field label="MBTI">
              <TextInput value={mbti} onChange={(v) => setMbti(v.toUpperCase())} placeholder="예: INFP" />
            </Field>

            <Field label={`취미 (최대 ${MAX_HOBBIES}개)`}>
              <div className="flex flex-wrap gap-2">
                {HOBBY_OPTIONS.map((hobby) => {
                  const selected = hobbies.includes(hobby);
                  const disabled = !selected && hobbies.length >= MAX_HOBBIES;
                  return (
                    <button
                      key={hobby}
                      type="button"
                      onClick={() => !disabled && toggleHobby(hobby)}
                      className={cn(
                        "px-4 py-2.5 rounded-xl text-[14px] font-medium transition-all",
                        selected
                          ? "bg-[#111827] text-white"
                          : disabled
                          ? "bg-[#F3F4F6] text-[#9CA3AF] cursor-not-allowed"
                          : "bg-[#F3F4F6] text-[#111827]"
                      )}
                    >
                      {hobby}
                    </button>
                  );
                })}
              </div>
            </Field>

            <Field label="반려동물">
              <ToggleGroup options={PET_OPTIONS} value={pet} onChange={setPet} />
            </Field>
          </div>
        </section>

        {/* 섹션4: 자기소개 */}
        <section>
          <SectionTitle>자기소개</SectionTitle>
          <div className="flex flex-col gap-1.5">
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="자신을 소개해주세요 (20~300자)"
              rows={5}
              maxLength={300}
              className="w-full px-4 py-3 rounded-2xl bg-[#F3F4F6] text-[15px] text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#111827] focus:bg-white transition-all border border-transparent resize-none"
            />
            <p className="text-xs text-[#9CA3AF] text-right">{bio.length}/300</p>
          </div>
        </section>

        {/* 섹션5: 사진 */}
        <section>
          <SectionTitle>사진</SectionTitle>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePhotoAdd}
          />
          <div className="grid grid-cols-3 gap-3">
            {photos.map((src, i) => (
              <div key={src} className="relative aspect-[3/4] rounded-xl overflow-hidden bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`사진 ${i + 1}`} className="w-full h-full object-cover" />
                {i === 0 && (
                  <span className="absolute top-1.5 left-1.5 bg-[#111827] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                    대표
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleDeletePhoto(src)}
                  className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M18 6L6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}

            {photos.length < MAX_PHOTOS && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="aspect-[3/4] rounded-xl border-2 border-dashed border-[#D1D5DB] flex flex-col items-center justify-center gap-1 text-[#9CA3AF] hover:border-[#111827] hover:text-[#111827] transition-colors disabled:opacity-50"
              >
                {uploading ? (
                  <div className="w-5 h-5 border-2 border-[#D1D5DB] border-t-[#111827] rounded-full animate-spin" />
                ) : (
                  <>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    <span className="text-xs font-medium">추가</span>
                  </>
                )}
              </button>
            )}
          </div>
          <p className="text-xs text-[#9CA3AF] mt-2">최대 {MAX_PHOTOS}장 · 첫 번째 사진이 대표 사진이에요</p>
        </section>

        {/* Error */}
        {error && (
          <p className="text-sm text-[#DC2626] text-center">{error}</p>
        )}
      </div>

      {/* 저장 버튼 (하단 고정) */}
      <div
        className="fixed bottom-0 left-0 right-0"
        style={{
          background: "rgba(255,255,255,0.88)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          borderTop: "0.5px solid rgba(0,0,0,0.1)",
        }}
      >
        <div className="max-w-lg mx-auto px-5 py-4">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || uploading}
            className="w-full h-[56px] rounded-2xl bg-[#111827] text-white text-[16px] font-semibold tracking-[-0.01em] active:scale-[0.98] transition-transform disabled:opacity-25 disabled:cursor-not-allowed"
          >
            {saving ? "저장 중..." : "저장하기"}
          </button>
        </div>
      </div>
    </div>
  );
}
