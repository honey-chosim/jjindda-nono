'use client'

import { useEffect, useState } from 'react'
import type { Match, DatingRequest, PaymentStatus } from '@/types/database'

interface MatchWithProfiles extends Match {
  user1: { id: string; name: string; phone: string | null } | null
  user2: { id: string; name: string; phone: string | null } | null
  request: DatingRequest | null
}

export default function AdminPaymentsPage() {
  const [matches, setMatches] = useState<MatchWithProfiles[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/admin/matches')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setMatches(data)
      })
      .finally(() => setLoading(false))
  }, [])

  async function updateMatch(id: string, patch: Partial<{ payment_status: PaymentStatus; kakao_group_created: boolean }>) {
    setUpdating(id)
    try {
      const res = await fetch(`/api/admin/matches/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (res.ok) {
        const updated = await res.json()
        setMatches((prev) => prev.map((m) => (m.id === id ? { ...m, ...updated } : m)))
      }
    } finally {
      setUpdating(null)
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-6">결제 현황</h2>

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
                  <th className="text-left px-4 py-3 font-medium text-gray-600">유저 1</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">유저 2</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">매칭일</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">결제 상태</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">카톡방 개설</th>
                </tr>
              </thead>
              <tbody>
                {matches.map((match) => (
                  <tr key={match.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {match.user1 ? (
                        <div>
                          <p className="font-medium text-gray-900">{match.user1.name}</p>
                          <p className="text-gray-400 text-xs">{match.user1.phone ?? '-'}</p>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {match.user2 ? (
                        <div>
                          <p className="font-medium text-gray-900">{match.user2.name}</p>
                          <p className="text-gray-400 text-xs">{match.user2.phone ?? '-'}</p>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(match.created_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() =>
                          updateMatch(match.id, {
                            payment_status: match.payment_status === 'paid' ? 'pending' : 'paid',
                          })
                        }
                        disabled={updating === match.id}
                        className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                          match.payment_status === 'paid'
                            ? 'bg-green-100 text-green-700 hover:bg-green-200'
                            : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                        }`}
                      >
                        {updating === match.id ? '...' : match.payment_status === 'paid' ? '입금완료' : '입금대기'}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={match.kakao_group_created}
                        disabled={updating === match.id}
                        onChange={() =>
                          updateMatch(match.id, {
                            kakao_group_created: !match.kakao_group_created,
                          })
                        }
                        className="w-4 h-4 rounded border-gray-300 text-gray-900 cursor-pointer disabled:opacity-50"
                      />
                      <span className="ml-2 text-xs text-gray-500">
                        {match.kakao_group_created ? '개설됨' : '미개설'}
                      </span>
                    </td>
                  </tr>
                ))}
                {matches.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                      매칭이 없습니다.
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
