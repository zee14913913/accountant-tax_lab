'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface AuditorPackage {
  id: string
  pack_name: string
  status: 'DRAFT' | 'FINALISED' | 'SENT' | 'ARCHIVED'
  period_start: string
  period_end: string
  assessment_year: number | null
  prepared_by: string
  created_at: string
  entity: {
    entity_name: string
    flow_type: string
    client: { display_name: string | null; legal_name: string }
  }
  _count: { items: number }
}

interface Meta {
  total: number
  limit: number
  offset: number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'info' | 'error' | 'neutral'> = {
  DRAFT:     'neutral',
  FINALISED: 'success',
  SENT:      'info',
  ARCHIVED:  'neutral',
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT:     'Draft',
  FINALISED: 'Finalised',
  SENT:      'Sent',
  ARCHIVED:  'Archived',
}

const STATUS_OPTIONS = ['', 'DRAFT', 'FINALISED', 'SENT', 'ARCHIVED'] as const
const PAGE_SIZE = 20

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function AuditorPackPage() {
  const [packages, setPackages] = useState<AuditorPackage[]>([])
  const [meta, setMeta]         = useState<Meta>({ total: 0, limit: PAGE_SIZE, offset: 0 })
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)

  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch]             = useState('')
  const [offset, setOffset]             = useState(0)

  const fetchPackages = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      params.set('limit',  String(PAGE_SIZE))
      params.set('offset', String(offset))

      const res  = await fetch(`/api/auditor-pack?${params}`)
      const json = await res.json()
      setPackages(json.data ?? [])
      setMeta(json.meta ?? { total: 0, limit: PAGE_SIZE, offset })
    } catch {
      setError('Failed to load packages')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, offset])

  useEffect(() => { fetchPackages() }, [fetchPackages])

  // Client-side search filter
  const filtered = search
    ? packages.filter(p =>
        p.entity.entity_name.toLowerCase().includes(search.toLowerCase()) ||
        p.pack_name.toLowerCase().includes(search.toLowerCase())
      )
    : packages

  const totalPages = Math.ceil(meta.total / PAGE_SIZE)
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1

  return (
    <div className="page-content">
      {/* Page Header */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Auditor Pack</h1>
          <p className="page-subtitle">Review packs prepared for external audit and submission</p>
        </div>
        <Link href="/auditor-pack/new" className="btn-primary">
          + New Package
        </Link>
      </div>

      {/* Filter Bar */}
      <div className="card-sm mb-6 flex flex-wrap items-center gap-3">
        <input
          type="text"
          placeholder="Search by entity or pack name…"
          className="form-input w-60"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select
          className="form-input w-44"
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setOffset(0) }}
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.slice(1).map(s => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        {(statusFilter || search) && (
          <button
            className="btn-ghost text-sm"
            onClick={() => { setStatusFilter(''); setSearch(''); setOffset(0) }}
          >
            Clear filters
          </button>
        )}
        <span className="ml-auto text-label text-ink-secondary">
          {meta.total} package{meta.total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-ink-secondary text-body">Loading packages…</div>
        ) : error ? (
          <div className="p-12 text-center text-status-error text-body">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-ink-secondary text-body">No packages found.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr className="border-b border-border bg-panel">
                <th className="px-5 py-3 text-left">Pack Name</th>
                <th className="px-5 py-3 text-left">Entity</th>
                <th className="px-5 py-3 text-left">Period</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Items</th>
                <th className="px-5 py-3 text-left">Prepared By</th>
                <th className="px-5 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((pkg, idx) => (
                <tr
                  key={pkg.id}
                  className={`border-b border-border hover:bg-panel/50 transition-colors ${idx % 2 === 0 ? '' : 'bg-panel/20'}`}
                >
                  <td className="px-5 py-3">
                    <span className="font-medium text-ink-primary">{pkg.pack_name}</span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="text-body text-ink-primary">{pkg.entity.entity_name}</div>
                    <div className="text-label text-ink-muted">
                      {pkg.entity.client.display_name ?? pkg.entity.client.legal_name}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-body text-ink-secondary">
                    {formatDate(pkg.period_start, 'short')} – {formatDate(pkg.period_end, 'short')}
                  </td>
                  <td className="px-5 py-3">
                    <Badge variant={STATUS_VARIANT[pkg.status] ?? 'neutral'}>
                      {STATUS_LABEL[pkg.status] ?? pkg.status}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-body text-ink-secondary tabular-nums">
                    {pkg._count.items} item{pkg._count.items !== 1 ? 's' : ''}
                  </td>
                  <td className="px-5 py-3 text-body text-ink-secondary">{pkg.prepared_by}</td>
                  <td className="px-5 py-3">
                    <Link href={`/auditor-pack/${pkg.id}`} className="btn-ghost text-sm">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-label text-ink-secondary">
            Page {currentPage} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              className="btn-secondary text-sm"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              Previous
            </button>
            <button
              className="btn-secondary text-sm"
              disabled={offset + PAGE_SIZE >= meta.total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
