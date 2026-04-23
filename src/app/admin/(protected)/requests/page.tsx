'use client'

import { useEffect, useState } from 'react'
import type { DatingRequest, DatingRequestStatus } from '@/types/database'

interface RequestWithProfiles extends DatingRequest {
  requester: { id: string; name: string; gender: string } | null
  target: { id: string; name: string; gender: string } | null
}

const statusConfig: Record<DatingRequestStatus, { label: string; className: string }> = {
  pending: { label: '대기중', className: 'bg-yellow-100 text-yellow-700' },
  accepted: { label: '수락됨', className: 'bg-green-100 text-green-700' },
  rejected: { label: '거절됨', className: 'bg-red-100 text-red-600' },
  expired: { label: '만료됨', className: 'bg-gray-100 text-gray-500' },
  cancelled: { label: '취소됨', className: 'bg-gray-100 text-gray-500' },
  cancelled_unpaid: { label: '결제만료로 취소', className: 'bg-gray-100 text-gray-500' },
}

export default function AdminRequestsPage() {
  const [requests, setRequests] = useState<RequestWithProfiles[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/admin/requests')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setRequests(data)
      })
      .finally(() => setLoading(false))
  }, [])

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900 mb-6">요청/매칭</h2>

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
                  <th className="text-left px-4 py-3 font-medium text-gray-600">신청자</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">상대방</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">상태</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">신청일</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">업데이트</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((req) => {
                  const status = statusConfig[req.status] ?? { label: req.status, className: 'bg-gray-100 text-gray-500' }
                  return (
                    <tr key={req.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        {req.requester ? (
                          <div>
                            <span className="font-medium text-gray-900">{req.requester.name}</span>
                            <span className="text-gray-400 text-xs ml-1">
                              ({req.requester.gender === 'male' ? '남' : '여'})
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {req.target ? (
                          <div>
                            <span className="font-medium text-gray-900">{req.target.name}</span>
                            <span className="text-gray-400 text-xs ml-1">
                              ({req.target.gender === 'male' ? '남' : '여'})
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${status.className}`}>
                          {status.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                        {new Date(req.created_at).toLocaleString('ko-KR', {
                          year: '2-digit', month: '2-digit', day: '2-digit',
                          hour: '2-digit', minute: '2-digit', hour12: false,
                        })}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                        {req.status === 'accepted'
                          ? new Date(req.updated_at).toLocaleString('ko-KR', {
                              year: '2-digit', month: '2-digit', day: '2-digit',
                              hour: '2-digit', minute: '2-digit', hour12: false,
                            })
                          : '-'}
                      </td>
                    </tr>
                  )
                })}
                {requests.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                      소개팅 요청이 없습니다.
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
