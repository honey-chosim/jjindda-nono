'use client'

import { useEffect, useState } from 'react'
import type { InviteCode } from '@/types/database'

interface InviteCodeWithReferrer extends InviteCode {
  referrer: { id: string; name: string; real_name: string | null } | null
}

export default function AdminInviteCodesPage() {
  const [codes, setCodes] = useState<InviteCodeWithReferrer[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [count, setCount] = useState(1)
  const [label, setLabel] = useState('')
  const [generating, setGenerating] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [newCodes, setNewCodes] = useState<string[]>([])
  const [copied, setCopied] = useState<string | null>(null)

  function loadCodes() {
    return fetch('/api/admin/invite-codes')
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setCodes(data)
      })
  }

  useEffect(() => {
    loadCodes().finally(() => setLoading(false))
  }, [])

  async function handleGenerate() {
    setGenerating(true)
    setNewCodes([])
    try {
      const res = await fetch('/api/admin/invite-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count, label }),
      })
      if (res.ok) {
        const created: InviteCode[] = await res.json()
        setNewCodes(created.map((c) => c.code))
        await loadCodes()
      }
    } finally {
      setGenerating(false)
    }
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      const res = await fetch(`/api/admin/invite-codes/${id}`, { method: 'DELETE' })
      if (res.ok) {
        setCodes((prev) => prev.filter((c) => c.id !== id))
      }
    } finally {
      setDeleting(null)
    }
  }

  async function copyCode(code: string) {
    await navigator.clipboard.writeText(code)
    setCopied(code)
    setTimeout(() => setCopied(null), 2000)
  }

  async function copyAll() {
    await navigator.clipboard.writeText(newCodes.join('\n'))
    setCopied('all')
    setTimeout(() => setCopied(null), 2000)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">초대코드</h2>
        <button
          onClick={() => { setShowModal(true); setNewCodes([]); setLabel('') }}
          className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          코드 생성
        </button>
      </div>

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
                  <th className="text-left px-4 py-3 font-medium text-gray-600">발급자</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">코드</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">생성일</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">상태</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">사용일</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">액션</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((code) => (
                  <tr key={code.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-700 text-sm">
                      {code.referrer ? (
                        <div>
                          <div className="font-medium text-gray-900">{code.referrer.real_name ?? code.referrer.name}</div>
                          <div className="text-[10px] text-gray-400">레퍼럴 유저</div>
                        </div>
                      ) : (
                        <div>
                          <div className="text-gray-500">{code.label ?? '-'}</div>
                          <div className="text-[10px] text-gray-400">어드민 발급</div>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-medium text-gray-900">{code.code}</span>
                        <button
                          onClick={() => copyCode(code.code)}
                          className="text-gray-400 hover:text-gray-600 text-xs"
                          title="복사"
                        >
                          {copied === code.code ? '✓' : '📋'}
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {new Date(code.created_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          code.is_active
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {code.is_active ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {code.used_at ? new Date(code.used_at).toLocaleDateString('ko-KR') : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(code.id)}
                        disabled={deleting === code.id}
                        className="px-3 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 transition-colors disabled:opacity-50"
                      >
                        {deleting === code.id ? '...' : '삭제'}
                      </button>
                    </td>
                  </tr>
                ))}
                {codes.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                      초대코드가 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 코드 생성 모달 */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h3 className="text-lg font-bold text-gray-900 mb-4">초대코드 생성</h3>

            {newCodes.length === 0 ? (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    이름 (어드민 전용, 선택)
                  </label>
                  <input
                    type="text"
                    placeholder="예: 1기 남자 배치"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    생성 개수 (1~20)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={count}
                    onChange={(e) => setCount(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    취소
                  </button>
                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
                  >
                    {generating ? '생성 중...' : '생성'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-600 mb-3">
                  {newCodes.length}개의 코드가 생성되었습니다.
                </p>
                <div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-1 max-h-48 overflow-y-auto">
                  {newCodes.map((code) => (
                    <div key={code} className="flex items-center justify-between">
                      <span className="font-mono text-sm font-medium text-gray-900">{code}</span>
                      <button
                        onClick={() => copyCode(code)}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        {copied === code ? '✓ 복사됨' : '복사'}
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={copyAll}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    {copied === 'all' ? '✓ 모두 복사됨' : '전체 복사'}
                  </button>
                  <button
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800"
                  >
                    닫기
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
