'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

interface MonthlyCloseRecord {
  id: string
  entity_id: string
  period_start: string
  period_end: string
  status: 'DRAFT' | 'IN_REVIEW' | 'CLOSED' | 'REOPENED' | 'ARCHIVED'
  closed_at: string | null
  reopened_at: string | null
  notes: string | null
  entity: {
    entity_name: string
    flow_type: string
    client: { display_name: string | null; legal_name: string }
  }
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'info' | 'error' | 'neutral'> = {
  DRAFT: 'neutral',
  IN_REVIEW: 'info',
  CLOSED: 'success',
  REOPENED: 'warning',
  ARCHIVED: 'neutral',
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  IN_REVIEW: 'In Review',
  CLOSED: 'Closed',
  REOPENED: 'Reopened',
  ARCHIVED: 'Archived',
}

function formatMonth(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-MY', { year: 'numeric', month: 'long' })
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-MY', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

const FLOW_LABELS: Record<string, string> = {
  INDIVIDUAL_ONLY: 'Individual Only',
  INDIVIDUAL_BUSINESS: 'Individual + Business',
  PARTNERSHIP: 'Partnership',
  COMPANY: 'Company / Sdn Bhd',
}

export default function MonthlyClosePage() {
  const [records, setRecords] = useState<MonthlyCloseRecord[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterEntity, setFilterEntity] = useState('')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 20

  const fetchRecords = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (filterStatus) params.set('status', filterStatus)
      if (filterEntity) params.set('entity_id', filterEntity)
      params.set('limit', String(PAGE_SIZE))
      params.set('offset', String(page * PAGE_SIZE))

      const res = await fetch(`/api/monthly-close?${params.toString()}`)
      if (!res.ok) throw new Error('Failed to fetch')
      const json = await res.json()
      setRecords(json.data ?? [])
      setTotal(json.meta?.total ?? 0)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [filterStatus, filterEntity, page])

  useEffect(() => { fetchRecords() }, [fetchRecords])

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Monthly Close</h1>
          <p className="text-label text-ink-muted mt-1">
            {total.toLocaleString()} period record{total !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/monthly-close/new"
          className="btn-primary"
        >
          + New Period
        </Link>
      </div>

      {/* Filters */}
      <Card className="mb-5">
        <CardContent className="py-3">
          <div className="flex flex-wrap gap-3 items-center">
            <select
              value={filterStatus}
              onChange={e => { setFilterStatus(e.target.value); setPage(0) }}
              className="form-input w-44"
            >
              <option value="">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="CLOSED">Closed</option>
              <option value="REOPENED">Reopened</option>
              <option value="ARCHIVED">Archived</option>
            </select>

            <input
              type="text"
              placeholder="Filter by entity ID…"
              value={filterEntity}
              onChange={e => { setFilterEntity(e.target.value); setPage(0) }}
              className="form-input w-56"
            />

            {(filterStatus || filterEntity) && (
              <button
                onClick={() => { setFilterStatus(''); setFilterEntity(''); setPage(0) }}
                className="btn-ghost text-label"
              >
                Clear
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-10 text-center text-ink-muted text-body">Loading…</div>
          ) : records.length === 0 ? (
            <div className="p-10 text-center text-ink-muted text-body">
              No monthly close records found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Entity</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th className="text-right">Closed</th>
                    <th className="text-right">Reopened</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {records.map(r => (
                    <tr key={r.id}>
                      <td className="font-medium">
                        {formatMonth(r.period_start)}
                      </td>
                      <td>
                        <div className="font-medium">
                          {r.entity.entity_name}
                        </div>
                        <div className="text-label text-ink-muted">
                          {r.entity.client.display_name ?? r.entity.client.legal_name}
                        </div>
                      </td>
                      <td>
                        <span className="text-label text-ink-muted">
                          {FLOW_LABELS[r.entity.flow_type] ?? r.entity.flow_type}
                        </span>
                      </td>
                      <td>
                        <Badge variant={STATUS_VARIANT[r.status] ?? 'neutral'}>
                          {STATUS_LABEL[r.status] ?? r.status}
                        </Badge>
                      </td>
                      <td className="text-right tabular-nums">
                        {formatDate(r.closed_at)}
                      </td>
                      <td className="text-right tabular-nums">
                        {formatDate(r.reopened_at)}
                      </td>
                      <td className="text-right">
                        <Link
                          href={`/monthly-close/${r.id}`}
                          className="btn-ghost text-label"
                        >
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-between items-center mt-4 text-label text-ink-muted">
          <span>
            Page {page + 1} of {totalPages} ({total} records)
          </span>
          <div className="flex gap-2">
            <button
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
              className="btn-ghost disabled:opacity-40"
            >
              ← Prev
            </button>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
              className="btn-ghost disabled:opacity-40"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
