'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import type { Profile } from '@/types/database'

interface InviteInfo {
  code: string
  label: string | null
  created_by: string | null
  referrer: { id: string; name: string; real_name: string | null } | null
}

interface UserWithInvite extends Profile {
  invite: InviteInfo | null
}

function getAge(birthYear: number, birthMonth: number, birthDay: number): number {
  const today = new Date()
  const birth = new Date(birthYear, birthMonth - 1, birthDay)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

type VerifyFilter = 'all' | 'pending' | 'approved' | 'rejected'
type GenderFilter = 'all' | 'male' | 'female'

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserWithInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<UserWithInvite | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [showReject, setShowReject] = useState(false)
  const [verifyFilter, setVerifyFilter] = useState<VerifyFilter>('pending')
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('all')

  useEffect(() => {
    fetch('/api/admin/users')
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setUsers(data) })
      .finally(() => setLoading(false))
  }, [])

  async function patchUser(userId: string, body: Record<string, unknown>) {
    setActionId(userId)
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        const updated = await res.json()
        setUsers((prev) => prev.map((u) => (u.id === userId ? updated : u)))
        if (selected?.id === userId) setSelected(updated)
      }
    } finally {
      setActionId(null)
    }
  }

  async function handleApprove(user: UserWithInvite) {
    await patchUser(user.id, { approved: true })
  }

  async function handleReject(user: UserWithInvite, reason: string) {
    await patchUser(user.id, { approved: false, note: reason })
    setShowReject(false)
    setRejectReason('')
  }

  const filtered = users.filter((u) => {
    if (genderFilter !== 'all' && u.gender !== genderFilter) return false
    if (verifyFilter === 'pending') return !u.is_verified && !u.rejection_reason
    if (verifyFilter === 'approved') return u.is_verified
    if (verifyFilter === 'rejected') return !u.is_verified && !!u.rejection_reason
    return true
  })

  const pendingCount = users.filter((u) => !u.is_verified && !u.rejection_reason && u.onboarding_completed).length

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-900">유저 관리</h2>
        {pendingCount > 0 && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-yellow-50 text-yellow-800 text-xs font-medium border border-yellow-200">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse"></span>
            검토 대기 {pendingCount}명
          </span>
        )}
      </div>

      {/* 필터 */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['pending', 'approved', 'rejected', 'all'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setVerifyFilter(v)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                verifyFilter === v
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {v === 'pending' ? '검토 대기' : v === 'approved' ? '승인됨' : v === 'rejected' ? '거절됨' : '전체'}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {(['all', 'male', 'female'] as const).map((g) => (
            <button
              key={g}
              onClick={() => setGenderFilter(g)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                genderFilter === g
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {g === 'all' ? '전체' : g === 'male' ? '남' : '여'}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-500 ml-auto">{filtered.length}명</span>
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          불러오는 중...
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((user) => (
            <button
              key={user.id}
              onClick={() => setSelected(user)}
              className="group bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-gray-400 hover:shadow-md transition-all"
            >
              <div className="flex gap-3 mb-3">
                {user.photos?.[0] ? (
                  <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-gray-100 flex-shrink-0">
                    <Image
                      src={user.photos[0]}
                      alt={user.name}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-xs flex-shrink-0">
                    사진 없음
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="font-bold text-gray-900 truncate">
                      {user.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {user.gender === 'male' ? '남' : '여'} · {getAge(user.birth_year, user.birth_month, user.birth_day)}세
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">
                    {user.residence_city ? `${user.residence_city} ${user.residence_district ?? ''}` : '거주지 미입력'}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {user.phone ?? '-'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <StatusBadge user={user} />
                {!user.is_active && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-medium">
                    비활성
                  </span>
                )}
                {!user.onboarding_completed && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-medium">
                    온보딩 미완료
                  </span>
                )}
                {user.verified_by_referrer && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                    친구 검증
                  </span>
                )}
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
              조건에 맞는 유저가 없습니다.
            </div>
          )}
        </div>
      )}

      {/* 상세 모달 */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelected(null)}>
          <div
            className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 헤더 */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  {selected.real_name ?? selected.name}
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    {selected.gender === 'male' ? '남' : '여'} · {getAge(selected.birth_year, selected.birth_month, selected.birth_day)}세
                  </span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">{selected.phone ?? '-'}</p>
              </div>
              <button
                onClick={() => { setSelected(null); setShowReject(false) }}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* 상태 요약 */}
              <section>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">상태</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <InfoRow label="운영진 검증">
                    <StatusBadge user={selected} />
                  </InfoRow>
                  <InfoRow label="친구 검증">
                    {selected.verified_by_referrer ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-emerald-700">완료</span>
                        <button
                          onClick={() => patchUser(selected.id, { friend_approved: false })}
                          disabled={actionId === selected.id}
                          className="text-[10px] px-1.5 py-0.5 rounded border border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => patchUser(selected.id, { friend_approved: true })}
                        disabled={actionId === selected.id}
                        className="text-[10px] px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium hover:bg-blue-100 disabled:opacity-50"
                      >
                        친구 대신 승인
                      </button>
                    )}
                  </InfoRow>
                  <InfoRow label="온보딩">
                    <span className={selected.onboarding_completed ? 'text-emerald-700' : 'text-gray-500'}>
                      {selected.onboarding_completed ? '완료' : '미완료'}
                    </span>
                  </InfoRow>
                  <InfoRow label="활성">
                    <span className={selected.is_active ? 'text-blue-700' : 'text-red-600'}>
                      {selected.is_active ? '활성' : '비활성'}
                    </span>
                  </InfoRow>
                </div>
                {selected.rejection_reason && (
                  <p className="mt-3 text-xs text-red-600 bg-red-50 rounded-lg p-2.5">
                    <span className="font-semibold">거절 사유:</span> {selected.rejection_reason}
                  </p>
                )}
              </section>

              {/* 사진 */}
              {selected.photos && selected.photos.length > 0 && (
                <section>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">사진</h4>
                  <div className="grid grid-cols-3 gap-2">
                    {selected.photos.map((photo, i) => (
                      <a key={i} href={photo} target="_blank" rel="noreferrer" className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 hover:ring-2 hover:ring-gray-900 transition-all">
                        <Image src={photo} alt="" fill sizes="200px" className="object-cover" />
                      </a>
                    ))}
                  </div>
                </section>
              )}

              {/* 기본 정보 */}
              <section>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">기본 정보</h4>
                <dl className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
                  <DlRow label="실명" value={selected.real_name} />
                  <DlRow label="닉네임" value={selected.name} />
                  <DlRow label="생년월일" value={`${selected.birth_year}-${String(selected.birth_month).padStart(2, '0')}-${String(selected.birth_day).padStart(2, '0')}`} />
                  <DlRow label="키" value={selected.height ? `${selected.height}cm` : null} />
                  <DlRow label="거주지" value={selected.residence_city ? `${selected.residence_city} ${selected.residence_district ?? ''}` : null} />
                </dl>
              </section>

              {/* 프로필 상세 */}
              <section>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">프로필</h4>
                <dl className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
                  <DlRow label="학력" value={selected.education} />
                  <DlRow label="학교" value={selected.school} />
                  <DlRow label="회사" value={selected.company} />
                  <DlRow label="직업" value={selected.job_title} />
                  <DlRow label="MBTI" value={selected.mbti} />
                  <DlRow label="흡연" value={selected.smoking} />
                  <DlRow label="음주" value={selected.drinking} />
                  <DlRow label="반려동물" value={selected.pet} />
                  <DlRow label="취미" value={selected.hobbies?.length ? selected.hobbies.join(', ') : null} />
                </dl>
              </section>

              {/* 자기소개 */}
              {selected.bio && (
                <section>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">자기소개</h4>
                  <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">{selected.bio}</p>
                </section>
              )}

              {/* 이상형 */}
              <section>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">이상형</h4>
                <dl className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
                  <DlRow label="연령대" value={selected.preferred_age_min && selected.preferred_age_max ? `${selected.preferred_age_min}~${selected.preferred_age_max}년생` : null} />
                  <DlRow label="최소 키" value={selected.preferred_height_min ? `${selected.preferred_height_min}cm` : null} />
                  <DlRow label="거주지" value={selected.preferred_residence?.length ? selected.preferred_residence.join(', ') : null} />
                  <DlRow label="추가 조건" value={selected.preferred_free_text} />
                </dl>
              </section>

              {/* 초대 정보 */}
              <section>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">초대 정보</h4>
                <dl className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
                  <DlRow
                    label="초대한 사람"
                    value={
                      selected.invite
                        ? selected.invite.referrer
                          ? `${selected.invite.referrer.real_name ?? selected.invite.referrer.name} (레퍼럴 유저)`
                          : selected.invite.label
                            ? `${selected.invite.label} (어드민 발급)`
                            : '어드민 발급'
                        : null
                    }
                  />
                  <DlRow label="사용한 초대코드" value={selected.invite?.code ?? null} />
                </dl>
              </section>

              {/* 가입 정보 */}
              <section>
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">가입 정보</h4>
                <dl className="divide-y divide-gray-100 border border-gray-100 rounded-lg overflow-hidden">
                  <DlRow label="가입일" value={new Date(selected.created_at).toLocaleString('ko-KR')} />
                  <DlRow label="마지막 활동" value={selected.last_active_at ? new Date(selected.last_active_at).toLocaleString('ko-KR') : null} />
                  <DlRow label="마케팅 SMS" value={selected.marketing_sms ? '수신 동의' : '미동의'} />
                </dl>
              </section>
            </div>

            {/* 액션 영역 */}
            <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4">
              {showReject ? (
                <div className="space-y-2">
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="거절 사유 (선택사항 — 비워두면 사유 없이 통지)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
                    rows={3}
                  />
                  <p className="text-[11px] text-gray-500">비워두면 "아쉽지만 프로필이 거절되었어요" SMS만 발송됩니다.</p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => { setShowReject(false); setRejectReason('') }}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      취소
                    </button>
                    <button
                      onClick={() => handleReject(selected, rejectReason)}
                      disabled={actionId === selected.id}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                    >
                      {actionId === selected.id ? '처리 중...' : '거절 확정'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  {!selected.is_verified && !selected.rejection_reason && (
                    <>
                      <button
                        onClick={() => setShowReject(true)}
                        className="flex-1 px-4 py-2.5 border border-red-300 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-50"
                      >
                        거절
                      </button>
                      <button
                        onClick={() => handleApprove(selected)}
                        disabled={actionId === selected.id}
                        className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
                      >
                        {actionId === selected.id ? '처리 중...' : '승인'}
                      </button>
                    </>
                  )}
                  {selected.is_verified && (
                    <button
                      onClick={() => patchUser(selected.id, { approved: false, note: '승인 취소' })}
                      disabled={actionId === selected.id}
                      className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
                    >
                      승인 취소
                    </button>
                  )}
                  {selected.rejection_reason && (
                    <button
                      onClick={() => handleApprove(selected)}
                      disabled={actionId === selected.id}
                      className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
                    >
                      재승인
                    </button>
                  )}
                  <button
                    onClick={() => patchUser(selected.id, { is_active: !selected.is_active })}
                    disabled={actionId === selected.id}
                    className={`px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 ${
                      selected.is_active
                        ? 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {selected.is_active ? '비활성화' : '활성화'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ user }: { user: Profile }) {
  if (user.is_verified) {
    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-medium">승인됨</span>
  }
  if (user.rejection_reason) {
    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-medium">거절됨</span>
  }
  return <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-50 text-yellow-700 font-medium border border-yellow-200">검토 대기</span>
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
      <span className="text-xs text-gray-500">{label}</span>
      {children}
    </div>
  )
}

function DlRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex px-3 py-2">
      <dt className="text-xs text-gray-500 w-24 flex-shrink-0">{label}</dt>
      <dd className="text-sm text-gray-900 flex-1 break-words">{value || <span className="text-gray-300">미입력</span>}</dd>
    </div>
  )
}
