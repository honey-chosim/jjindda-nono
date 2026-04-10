"use client";

import { use, useState } from "react";
import { useRouter } from "next/navigation";
import { useOnboardingStore } from "@/store/onboardingStore";
import { cn } from "@/lib/utils";

// ─── constants ────────────────────────────────────────────────────────────────

const MBTI_TYPES = [
  "INTJ","INTP","ENTJ","ENTP",
  "INFJ","INFP","ENFJ","ENFP",
  "ISTJ","ISFJ","ESTJ","ESFJ",
  "ISTP","ISFP","ESTP","ESFP",
];

const HOBBY_OPTIONS = [
  "독서","테니스","골프","헬스","요리","여행","영화","음악","게임","등산",
];

const EDUCATION_OPTIONS = ["고졸","전문대졸","대졸","대학원졸"];

const CITIES = [
  "서울","경기","인천","부산","대구","광주","대전","울산","세종",
  "강원","충북","충남","전북","전남","경북","경남","제주",
];

const DISTRICTS: Record<string, string[]> = {
  서울: ["강남구","강동구","강북구","강서구","관악구","광진구","구로구","금천구","노원구","도봉구","동대문구","동작구","마포구","서대문구","서초구","성동구","성북구","송파구","양천구","영등포구","용산구","은평구","종로구","중구","중랑구"],
  경기: ["수원시","성남시","고양시","용인시","부천시","안산시","안양시","남양주시","화성시","평택시","의정부시","파주시","광명시","시흥시","김포시","군포시","하남시","오산시","이천시","양주시","구리시","안성시","포천시","의왕시","여주시","동두천시","과천시"],
  인천: ["중구","동구","미추홀구","연수구","남동구","부평구","계양구","서구","강화군","옹진군"],
  부산: ["중구","서구","동구","영도구","부산진구","동래구","남구","북구","해운대구","사하구","금정구","강서구","연제구","수영구","사상구","기장군"],
  대구: ["중구","동구","서구","남구","북구","수성구","달서구","달성군"],
  광주: ["동구","서구","남구","북구","광산구"],
  대전: ["동구","중구","서구","유성구","대덕구"],
  울산: ["중구","남구","동구","북구","울주군"],
  세종: ["세종시"],
  강원: ["춘천시","원주시","강릉시","동해시","태백시","속초시","삼척시"],
  충북: ["청주시","충주시","제천시","보은군","옥천군","영동군","증평군","진천군","괴산군","음성군","단양군"],
  충남: ["천안시","공주시","보령시","아산시","서산시","논산시","계룡시","당진시"],
  전북: ["전주시","군산시","익산시","정읍시","남원시","김제시"],
  전남: ["목포시","여수시","순천시","나주시","광양시"],
  경북: ["포항시","경주시","김천시","안동시","구미시","영주시","영천시","상주시","문경시","경산시"],
  경남: ["창원시","진주시","통영시","사천시","김해시","밀양시","거제시","양산시"],
  제주: ["제주시","서귀포시"],
};

// ─── Toggle Button ─────────────────────────────────────────────────────────────

function ToggleButton({
  label,
  active,
  onClick,
  fullWidth = false,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  fullWidth?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-12 px-4 rounded-xl border text-sm font-medium transition-all duration-150 active:scale-[0.97]",
        fullWidth && "flex-1",
        active
          ? "bg-[#111827] border-[#111827] text-white font-semibold"
          : "bg-[#F3F4F6] border-transparent text-[#111827] hover:bg-[#E5E7EB]"
      )}
    >
      {label}
    </button>
  );
}

// ─── Field wrapper ─────────────────────────────────────────────────────────────

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-[13px] font-semibold text-[#6B7280] uppercase tracking-wide">{label}</label>
      {children}
      {hint && <p className="text-xs text-[#6B7280]">{hint}</p>}
    </div>
  );
}

// ─── Select ────────────────────────────────────────────────────────────────────

function Select({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full h-[52px] px-4 rounded-2xl bg-[#F3F4F6] text-[15px] text-[#111827] focus:outline-none focus:ring-2 focus:ring-[#111827] focus:bg-white transition-all border border-transparent appearance-none"
    >
      {placeholder && (
        <option value="" disabled>
          {placeholder}
        </option>
      )}
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

// ─── Text Input ────────────────────────────────────────────────────────────────

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  suffix,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  suffix?: string;
}) {
  return (
    <div className="relative">
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-[52px] px-4 rounded-2xl bg-[#F3F4F6] text-[15px] text-[#111827] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#111827] focus:bg-white transition-all border border-transparent"
      />
      {suffix && (
        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[#6B7280]">
          {suffix}
        </span>
      )}
    </div>
  );
}

// ─── Continue Button ───────────────────────────────────────────────────────────

function ContinueButton({
  onClick,
  disabled,
  label = "다음",
}: {
  onClick: () => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 px-5 py-4 pb-safe"
      style={{
        background: "rgba(255,255,255,0.88)",
        backdropFilter: "blur(20px) saturate(180%)",
        WebkitBackdropFilter: "blur(20px) saturate(180%)",
        borderTop: "0.5px solid rgba(0,0,0,0.1)",
      }}
    >
      <button
        onClick={onClick}
        disabled={disabled}
        className="w-full h-[56px] rounded-2xl bg-[#111827] text-white text-[16px] font-semibold tracking-[-0.01em] active:scale-[0.98] transition-transform disabled:opacity-25 disabled:cursor-not-allowed"
      >
        {label}
      </button>
    </div>
  );
}

// ─── STEPS ─────────────────────────────────────────────────────────────────────

function Step2() {
  const router = useRouter();
  const { phone, setPhone } = useOnboardingStore();
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  function sendCode() {
    const digits = phone.replace(/[-\s]/g, "");
    if (!digits.startsWith("010") || digits.length !== 11) {
      setError("010으로 시작하는 11자리 번호를 입력해주세요");
      return;
    }
    setError("");
    setCodeSent(true);
  }

  function verify() {
    if (code === "000000") {
      router.push("/onboarding/3");
    } else {
      setError("인증번호가 올바르지 않습니다");
    }
  }

  return (
    <div className="px-4 pt-6 pb-28 flex flex-col gap-6">
      <div>
        <h2 className="text-[28px] font-black text-[#111827] tracking-[-0.02em] leading-tight">전화번호 인증</h2>
        <p className="text-sm text-[#6B7280] mt-1">
          본인 명의 전화번호로 인증해주세요
        </p>
      </div>

      <Field label="전화번호">
        <div className="flex gap-2">
          <TextInput
            value={phone}
            onChange={(v) => {
              setPhone(v);
              setError("");
            }}
            placeholder="010-0000-0000"
            type="tel"
          />
          <button
            type="button"
            onClick={sendCode}
            className="flex-shrink-0 h-12 px-4 rounded-xl bg-[var(--primary)] text-white text-sm font-semibold whitespace-nowrap hover:bg-[#1F2937] transition-colors"
          >
            인증번호 받기
          </button>
        </div>
        {error && !codeSent && (
          <p className="text-xs text-[#DC2626] mt-1">{error}</p>
        )}
      </Field>

      {codeSent && (
        <Field label="인증번호" hint="테스트: 000000">
          <TextInput
            value={code}
            onChange={(v) => {
              setCode(v);
              setError("");
            }}
            placeholder="6자리 입력"
            type="text"
          />
          {error && (
            <p className="text-xs text-[var(--danger)]">{error}</p>
          )}
        </Field>
      )}

      <ContinueButton
        onClick={codeSent ? verify : sendCode}
        disabled={!phone}
        label={codeSent ? "인증 완료" : "인증번호 받기"}
      />
    </div>
  );
}

function Step3() {
  const router = useRouter();
  const { name, setName, gender, setGender, birthYear, setBirthYear, birthMonth, setBirthMonth, birthDay, setBirthDay } =
    useOnboardingStore();

  const years = Array.from({ length: 2006 - 1970 + 1 }, (_, i) => String(1970 + i));
  const months = Array.from({ length: 12 }, (_, i) => String(i + 1));
  const days = Array.from({ length: 31 }, (_, i) => String(i + 1));

  return (
    <div className="px-4 pt-6 pb-28 flex flex-col gap-6">
      <div>
        <h2 className="text-[28px] font-black text-[#111827] tracking-[-0.02em] leading-tight">기본 정보</h2>
        <p className="text-sm text-[#6B7280] mt-1">이름과 성별을 알려주세요</p>
      </div>

      <Field label="이름">
        <TextInput value={name} onChange={setName} placeholder="실명 입력" />
      </Field>

      <Field label="성별">
        <div className="flex gap-3">
          <ToggleButton label="남" active={gender === "male"} onClick={() => setGender("male")} fullWidth />
          <ToggleButton label="여" active={gender === "female"} onClick={() => setGender("female")} fullWidth />
        </div>
      </Field>

      <Field label="생년월일">
        <div className="grid grid-cols-3 gap-2">
          <Select value={String(birthYear)} onChange={(v) => setBirthYear(Number(v))} options={years} placeholder="년도" />
          <Select value={String(birthMonth)} onChange={(v) => setBirthMonth(Number(v))} options={months} placeholder="월" />
          <Select value={String(birthDay)} onChange={(v) => setBirthDay(Number(v))} options={days} placeholder="일" />
        </div>
      </Field>

      <ContinueButton onClick={() => router.push("/onboarding/4")} disabled={!name || !gender} />
    </div>
  );
}

function Step4() {
  const router = useRouter();
  const {
    height, setHeight,
    education, setEducation,
    school, setSchool,
    company, setCompany,
    jobTitle, setJobTitle,
    residenceCity, setResidenceCity,
    residenceDistrict, setResidenceDistrict,
  } = useOnboardingStore();

  const districts = residenceCity ? (DISTRICTS[residenceCity] ?? []) : [];

  return (
    <div className="px-4 pt-6 pb-28 flex flex-col gap-6">
      <div>
        <h2 className="text-[28px] font-black text-[#111827] tracking-[-0.02em] leading-tight">외모 · 스펙</h2>
        <p className="text-sm text-[#6B7280] mt-1">상대방이 확인하는 기본 스펙이에요</p>
      </div>

      <Field label="키">
        <TextInput
          value={height === 0 ? "" : String(height)}
          onChange={(v) => setHeight(Number(v) || 0)}
          type="number"
          placeholder="키 입력"
          suffix="cm"
        />
      </Field>

      <Field label="최종 학력">
        <Select value={education} onChange={setEducation} options={EDUCATION_OPTIONS} placeholder="선택" />
      </Field>

      <Field label="학교명">
        <TextInput value={school} onChange={setSchool} placeholder="학교 이름" />
      </Field>

      <Field label="현재 직장">
        <TextInput value={company} onChange={setCompany} placeholder="회사명" />
      </Field>

      <Field label="직업 · 직책">
        <TextInput value={jobTitle} onChange={setJobTitle} placeholder="예: 소프트웨어 엔지니어" />
      </Field>

      <Field label="거주지">
        <div className="grid grid-cols-2 gap-2">
          <Select
            value={residenceCity}
            onChange={(v) => { setResidenceCity(v); setResidenceDistrict(""); }}
            options={CITIES}
            placeholder="시 / 도"
          />
          <Select
            value={residenceDistrict}
            onChange={setResidenceDistrict}
            options={districts}
            placeholder="구 / 군"
          />
        </div>
      </Field>

      <ContinueButton
        onClick={() => router.push("/onboarding/5")}
        disabled={!height || !education || !company || !jobTitle || !residenceCity}
      />
    </div>
  );
}

function Step5() {
  const router = useRouter();
  const { smoking, setSmoking, drinking, setDrinking, mbti, setMbti, hobbies, toggleHobby, pet, setPet } =
    useOnboardingStore();
  const [customHobby, setCustomHobby] = useState("");

  function addCustom() {
    if (customHobby.trim() && hobbies.length < 5) {
      toggleHobby(customHobby.trim());
      setCustomHobby("");
    }
  }

  return (
    <div className="px-4 pt-6 pb-28 flex flex-col gap-6">
      <div>
        <h2 className="text-[28px] font-black text-[#111827] tracking-[-0.02em] leading-tight">라이프스타일</h2>
        <p className="text-sm text-[#6B7280] mt-1">나의 생활 방식을 알려주세요</p>
      </div>

      <Field label="흡연">
        <div className="flex gap-2">
          {["비흡연","흡연","금연 중"].map((v) => (
            <ToggleButton key={v} label={v} active={smoking === v} onClick={() => setSmoking(v)} fullWidth />
          ))}
        </div>
      </Field>

      <Field label="음주">
        <div className="flex gap-2">
          {["안 마심","사회적 음주","즐겨 마심"].map((v) => (
            <ToggleButton key={v} label={v} active={drinking === v} onClick={() => setDrinking(v)} fullWidth />
          ))}
        </div>
      </Field>

      <Field label="MBTI">
        <Select value={mbti} onChange={setMbti} options={MBTI_TYPES} placeholder="선택" />
      </Field>

      <Field label="취미" hint={`최대 5개 선택 (${hobbies.length}/5)`}>
        <div className="flex flex-wrap gap-2">
          {HOBBY_OPTIONS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => toggleHobby(h)}
              className={cn(
                "h-9 px-3.5 rounded-full text-sm font-medium border transition-all active:scale-[0.97]",
                hobbies.includes(h)
                  ? "bg-[var(--primary)] border-[var(--primary)] text-white"
                  : "bg-[var(--surface)] border-[var(--border)] text-[#111827]"
              )}
            >
              {h}
            </button>
          ))}
        </div>
        <div className="flex gap-2 mt-1">
          <input
            type="text"
            value={customHobby}
            onChange={(e) => setCustomHobby(e.target.value)}
            placeholder="직접 입력"
            className="flex-1 h-10 px-3 rounded-xl border border-[var(--border)] text-sm focus:outline-none focus:border-[var(--primary)]"
            onKeyDown={(e) => e.key === "Enter" && addCustom()}
          />
          <button
            type="button"
            onClick={addCustom}
            className="h-10 px-4 rounded-xl bg-gray-100 text-sm font-medium text-[#111827] hover:bg-gray-200"
          >
            추가
          </button>
        </div>
        {hobbies.filter((h) => !HOBBY_OPTIONS.includes(h)).length > 0 && (
          <div className="flex flex-wrap gap-2 mt-1">
            {hobbies.filter((h) => !HOBBY_OPTIONS.includes(h)).map((h) => (
              <button
                key={h}
                type="button"
                onClick={() => toggleHobby(h)}
                className="h-9 px-3.5 rounded-full text-sm font-medium border bg-[var(--primary)] border-[var(--primary)] text-white"
              >
                {h} ×
              </button>
            ))}
          </div>
        )}
      </Field>

      <Field label="반려동물">
        <div className="flex gap-2">
          {["없음","강아지","고양이","기타"].map((v) => (
            <ToggleButton key={v} label={v} active={pet === v} onClick={() => setPet(v)} fullWidth />
          ))}
        </div>
      </Field>

      <ContinueButton
        onClick={() => router.push("/onboarding/7")}
        disabled={!smoking || !drinking}
      />
    </div>
  );
}

function Step7() {
  const router = useRouter();
  const { bio, setBio } = useOnboardingStore();
  const MAX = 300;
  const MIN = 20;

  return (
    <div className="px-4 pt-6 pb-28 flex flex-col gap-6">
      <div>
        <h2 className="text-[28px] font-black text-[#111827] tracking-[-0.02em] leading-tight">자기소개 및 이상형</h2>
        <p className="text-sm text-[#6B7280] mt-1">나는 어떤 사람인지, 어떤 분을 만나고 싶은지 써주세요</p>
      </div>

      <Field label="자기소개 및 이상형" hint={`${bio.length}/${MAX}자 · 최소 ${MIN}자 이상`}>
        <textarea
          value={bio}
          onChange={(e) => setBio(e.target.value.slice(0, MAX))}
          placeholder={"예) 여의도에서 일하는 30대 직장인입니다. 취미는 테니스와 독서예요. 밝고 유머 있는 분이면 좋겠어요 :)"}
          rows={8}
          className="w-full px-4 py-3 rounded-2xl bg-[#F3F4F6] text-[15px] text-[#111827] leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-[#111827] focus:bg-white transition-all border border-transparent placeholder:text-[#9CA3AF]"
        />
        {bio.length > 0 && bio.length < MIN && (
          <p className="text-xs text-[#DC2626]">{MIN - bio.length}자 더 입력해주세요</p>
        )}
      </Field>

      <ContinueButton
        onClick={() => router.push("/onboarding/8")}
        disabled={bio.length < MIN}
      />
    </div>
  );
}

function Step8() {
  const router = useRouter();
  const { photos, addPhoto, removePhoto } = useOnboardingStore();
  const MIN_PHOTOS = 2;
  const MAX_PHOTOS = 5;

  const MOCK_PHOTOS = [
    "https://picsum.photos/seed/upload1/400/533",
    "https://picsum.photos/seed/upload2/400/533",
    "https://picsum.photos/seed/upload3/400/533",
    "https://picsum.photos/seed/upload4/400/533",
    "https://picsum.photos/seed/upload5/400/533",
  ];

  function handleAdd() {
    if (photos.length < MAX_PHOTOS) {
      const next = MOCK_PHOTOS[photos.length % MOCK_PHOTOS.length];
      addPhoto(next);
    }
  }

  return (
    <div className="px-4 pt-6 pb-28 flex flex-col gap-6">
      <div>
        <h2 className="text-[28px] font-black text-[#111827] tracking-[-0.02em] leading-tight">사진 업로드</h2>
        <p className="text-sm text-[#6B7280] mt-1">
          최소 2장, 최대 5장 · 첫 번째 사진이 대표 사진이에요
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {/* Existing photos */}
        {photos.map((src, i) => (
          <div key={i} className="relative aspect-[3/4] rounded-xl overflow-hidden bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`사진 ${i + 1}`} className="w-full h-full object-cover" />
            {i === 0 && (
              <span className="absolute top-1.5 left-1.5 bg-[var(--primary)] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md">
                대표
              </span>
            )}
            <button
              onClick={() => removePhoto(i)}
              className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center text-white text-xs"
            >
              ×
            </button>
          </div>
        ))}

        {/* Add slot */}
        {photos.length < MAX_PHOTOS && (
          <button
            type="button"
            onClick={handleAdd}
            className="aspect-[3/4] rounded-xl border-2 border-dashed border-[var(--border)] flex flex-col items-center justify-center gap-2 text-[#6B7280] hover:border-[var(--primary)] hover:text-[var(--primary)] transition-colors"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            <span className="text-xs font-medium">사진 추가</span>
          </button>
        )}
      </div>

      {photos.length < MIN_PHOTOS && (
        <p className="text-sm text-[var(--warning)] text-center">
          최소 {MIN_PHOTOS}장의 사진이 필요합니다
        </p>
      )}

      <div className="bg-[#F3F4F6] rounded-xl p-4">
        <p className="text-xs text-[#374151] leading-relaxed">
          데모 모드: 사진 추가 버튼을 누르면 샘플 이미지가 추가됩니다.
          실제 서비스에서는 갤러리에서 선택할 수 있습니다.
        </p>
      </div>

      <ContinueButton
        onClick={() => router.push("/onboarding/9")}
        disabled={photos.length < MIN_PHOTOS}
      />
    </div>
  );
}

function Step9() {
  const router = useRouter();
  const store = useOnboardingStore();

  return (
    <div className="px-4 pt-6 pb-28 flex flex-col gap-6">
      <div>
        <h2 className="text-[28px] font-black text-[#111827] tracking-[-0.02em] leading-tight">미리보기</h2>
        <p className="text-sm text-[#6B7280] mt-1">
          다른 사람들에게 이렇게 보입니다
        </p>
      </div>

      {/* Profile preview card */}
      <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] overflow-hidden shadow-sm">
        {store.photos.length > 0 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={store.photos[0]}
            alt="대표 사진"
            className="w-full aspect-[3/4] object-cover"
          />
        ) : (
          <div className="w-full aspect-[3/4] bg-gray-100 flex items-center justify-center">
            <p className="text-sm text-[#6B7280]">사진 없음</p>
          </div>
        )}
        <div className="p-5 flex flex-col gap-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xl font-bold text-[#111827]">
                {store.name || "이름 미입력"},{" "}
                {new Date().getFullYear() - store.birthYear + 1}세
              </p>
              <p className="text-sm text-[#6B7280] mt-0.5">
                {store.residenceCity} {store.residenceDistrict}
              </p>
            </div>
            <button
              onClick={() => router.push("/onboarding/3")}
              className="text-xs text-[var(--primary)] font-medium"
            >
              수정
            </button>
          </div>

          <div className="h-px bg-[var(--border)]" />

          {/* Spec row */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="text-xs text-[#6B7280] mb-1">스펙</p>
              <p className="text-sm text-[#111827]">
                {store.height}cm · {store.education}
              </p>
              <p className="text-sm text-[#111827]">
                {store.company} · {store.jobTitle}
              </p>
            </div>
            <button
              onClick={() => router.push("/onboarding/4")}
              className="text-xs text-[var(--primary)] font-medium flex-shrink-0"
            >
              수정
            </button>
          </div>

          <div className="h-px bg-[var(--border)]" />

          {/* Lifestyle row */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="text-xs text-[#6B7280] mb-1">라이프스타일</p>
              <p className="text-sm text-[#111827]">
                {store.mbti} · {store.smoking} · {store.drinking}
              </p>
              {store.hobbies.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {store.hobbies.map((h) => (
                    <span key={h} className="text-xs bg-[#F3F4F6] text-[#374151] px-2 py-0.5 rounded-full">
                      {h}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <button
              onClick={() => router.push("/onboarding/5")}
              className="text-xs text-[var(--primary)] font-medium flex-shrink-0"
            >
              수정
            </button>
          </div>

          <div className="h-px bg-[var(--border)]" />

          {/* Bio row */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1">
              <p className="text-xs text-[#6B7280] mb-1">자기소개</p>
              <p className="text-sm text-[#111827] leading-relaxed line-clamp-3">
                {store.bio || "자기소개 없음"}
              </p>
            </div>
            <button
              onClick={() => router.push("/onboarding/7")}
              className="text-xs text-[var(--primary)] font-medium flex-shrink-0"
            >
              수정
            </button>
          </div>
        </div>
      </div>

      <ContinueButton
        onClick={() => router.push("/profiles")}
        label="등록 완료"
      />
    </div>
  );
}

// ─── Router ────────────────────────────────────────────────────────────────────

const STEP_COMPONENTS: Record<number, React.FC> = {
  2: Step2,
  3: Step3,
  4: Step4,
  5: Step5,

  7: Step7,
  8: Step8,
  9: Step9,
};

export default function OnboardingStepPage({
  params,
}: {
  params: Promise<{ step: string }>;
}) {
  const { step } = use(params);
  const stepNum = parseInt(step);
  const StepComponent = STEP_COMPONENTS[stepNum];

  if (!StepComponent) {
    return (
      <div className="px-4 pt-6">
        <p className="text-[#6B7280]">존재하지 않는 단계입니다</p>
      </div>
    );
  }

  return <StepComponent />;
}
