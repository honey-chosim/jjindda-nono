'use client'

import { useEffect, useState } from 'react'
import type { Match, DatingRequest, PaymentStatus, ReferralPayout } from '@/types/database'

interface MatchWithProfiles extends Match {
  user1: { id: string; name: string; phone: string | null } | null
  user2: { id: string; name: string; phone: string | null } | null
  request: DatingRequest | null
}

interface PayoutWithUser extends ReferralPayout {
  user: { id: string; name: string; phone: string | null } | null
}

const payoutStatusLabel: Record<string, string> = {
  pending: '검토중',
  approved: '승인됨',
  paid: '지급완료',
  rejected: '거절됨',
}

const payoutStatusColor: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-blue-100 text-blue-700',
  paid: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
}

export default function AdminPaymentsPage() {
  const [tab, setTab] = useState<'matches' | 'payouts'>('matches')
  const [matches, setMatches] = useState<MatchWithProfiles[]>([])
  const [payouts, setPayouts] = useState<PayoutWithUser[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    if (tab === 'matches') {
      fetch('/api/admin/matches')
        .then((r) => r.json())
        .then((data) => { if (Array.isArray(data)) setMatches(data) })
        .finally(() => setLoading(false))
    } else {
      fetch('/api/admin/referral-payouts')
        .then((r) => r.json())
        .then((data) => { if (Array.isArray(data)) setPayouts(data) })
        .finally(() => setLoading(false))
    }
  }, [tab])

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

  async function updatePayout(id: string, status: string) {
    setUpdating(id)
    try {
      const res = await fetch('/api/admin/referral-payouts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      if (res.ok) {
        const updated = await res.json()
        setPayouts((prev) => prev.map((p) => (p.id === id ? { ...p, ...updated } : p)))
      }
    } finally {
      setUpdating(null)
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-4">결제 관리</h2>

      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {([['matches', '소개팅 결제'], ['payouts', '레퍼럴 지급']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          불러오는 중...
        </div>
      ) : tab === 'matches' ? (
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
                      ) : <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-4 py-3">
                      {match.user2 ? (
                        <div>
                          <p className="font-medium text-gray-900">{match.user2.name}</p>
                          <p className="text-gray-400 text-xs">{match.user2.phone ?? '-'}</p>
                        </div>
                      ) : <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(match.created_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => updateMatch(match.id, { payment_status: match.payment_status === 'paid' ? 'pending' : 'paid' })}
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
                        onChange={() => updateMatch(match.id, { kakao_group_created: !match.kakao_group_created })}
                        className="w-4 h-4 rounded border-gray-300 text-gray-900 cursor-pointer disabled:opacity-50"
                      />
                      <span className="ml-2 text-xs text-gray-500">
                        {match.kakao_group_created ? '개설됨' : '미개설'}
                      </span>
                    </td>
                  </tr>
                ))}
                {matches.length === 0 && (
                  <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">매칭이 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">유저</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">금액</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">계좌</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">신청일</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">상태</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">액션</th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      {p.user ? (
                        <div>
                          <p className="font-medium text-gray-900">{p.user.name}</p>
                          <p className="text-gray-400 text-xs">{p.user.phone ?? '-'}</p>
                        </div>
                      ) : <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {p.amount_requested.toLocaleString()}원
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      <p>{p.bank_name} {p.bank_account}</p>
                      <p className="text-gray-400">{p.account_holder}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(p.requested_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${payoutStatusColor[p.status]}`}>
                        {payoutStatusLabel[p.status]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {p.status === 'pending' && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => updatePayout(p.id, 'approved')}
                            disabled={updating === p.id}
                            className="px-2 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                          >
                            승인
                          </button>
                          <button
                            onClick={() => updatePayout(p.id, 'rejected')}
                            disabled={updating === p.id}
                            className="px-2 py-1 rounded-md text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50"
                          >
                            거절
                          </button>
                        </div>
                      )}
                      {p.status === 'approved' && (
                        <button
                          onClick={() => updatePayout(p.id, 'paid')}
                          disabled={updating === p.id}
                          className="px-2 py-1 rounded-md text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50"
                        >
                          지급완료
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {payouts.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">지급 신청이 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
