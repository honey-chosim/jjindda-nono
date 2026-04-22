'use client'

import { useEffect, useState } from 'react'
import type { Profile } from '@/types/database'

function getAge(birthYear: number, birthMonth: number, birthDay: number): number {
  const today = new Date()
  const birth = new Date(birthYear, birthMonth - 1, birthDay)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)

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
      }
    } finally {
      setActionId(null)
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-6">유저 관리</h2>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          불러오는 중...
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">실명</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">전화번호</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">성별</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">나이</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">거주지</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">가입일</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">온보딩</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">친구 검증</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">운영진 검증</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">상태</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">액션</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{user.name}</td>
                    <td className="px-4 py-3 text-gray-600">{user.phone ?? '-'}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {user.gender === 'male' ? '남' : '여'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {getAge(user.birth_year, user.birth_month, user.birth_day)}세
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {user.residence_city
                        ? `${user.residence_city} ${user.residence_district ?? ''}`.trim()
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(user.created_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        user.onboarding_completed ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {user.onboarding_completed ? '완료' : '미완료'}
                      </span>
                    </td>
                    {/* 친구 검증 */}
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        user.verified_by_referrer
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}>
                        {user.verified_by_referrer ? '완료' : '대기중'}
                      </span>
                    </td>
                    {/* 운영진 검증 */}
                    <td className="px-4 py-3">
                      {user.is_verified ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                          승인됨
                        </span>
                      ) : user.rejection_reason ? (
                        <span className="inline-block px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-600" title={user.rejection_reason}>
                          거절됨
                        </span>
                      ) : (
                        <div className="flex gap-1">
                          <button
                            onClick={() => patchUser(user.id, { approved: true })}
                            disabled={actionId === user.id}
                            className="px-2 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 transition-colors"
                          >
                            승인
                          </button>
                          <button
                            onClick={() => patchUser(user.id, { approved: false })}
                            disabled={actionId === user.id}
                            className="px-2 py-1 rounded-md text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors"
                          >
                            거절
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                        user.is_active ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-600'
                      }`}>
                        {user.is_active ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => patchUser(user.id, { is_active: !user.is_active })}
                        disabled={actionId === user.id}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                          user.is_active
                            ? 'bg-red-50 text-red-600 hover:bg-red-100'
                            : 'bg-green-50 text-green-700 hover:bg-green-100'
                        }`}
                      >
                        {actionId === user.id ? '...' : user.is_active ? '비활성화' : '활성화'}
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-gray-400">
                      유저가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
