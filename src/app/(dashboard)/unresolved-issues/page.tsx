'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type IssueStatus   = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'WAIVED' | 'ESCALATED'
type IssuePriority = 'HIGH' | 'MEDIUM' | 'LOW'
type IssueType     =
  | 'MISSING_DOCUMENT'
  | 'UNCLASSIFIED_TRANSACTION'
  | 'RECONCILIATION_DIFFERENCE'
  | 'TAX_SENSITIVE_ITEM'
  | 'DIRECTOR_RELATED_TRANSACTION'
  | 'RELATED_PARTY_TRANSACTION'
  | 'HIGH_VALUE_TRANSACTION'
  | 'DATA_INCONSISTENCY'
  | 'OTHER'

interface Issue {
  id: string
  title: string
  description: string | null
  issue_type: IssueType
  priority: IssuePriority
  status: IssueStatus
  period: string | null
  assigned_to: string | null
  related_txn_id: string | null
  related_doc_id: string | null
  resolution: string | null
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
  entity_id: string
  entity: { entity_name: string; flow_type: string }
}

interface Entity {
  id: string
  entity_name: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ISSUE_TYPE_LABELS: Record<IssueType, string> = {
  MISSING_DOCUMENT:             'Missing Document',
  UNCLASSIFIED_TRANSACTION:     'Unclassified Txn',
  RECONCILIATION_DIFFERENCE:    'Reconciliation Diff',
  TAX_SENSITIVE_ITEM:           'Tax Sensitive',
  DIRECTOR_RELATED_TRANSACTION: 'Director Related',
  RELATED_PARTY_TRANSACTION:    'Related Party',
  HIGH_VALUE_TRANSACTION:       'High Value',
  DATA_INCONSISTENCY:           'Data Inconsistency',
  OTHER:                        'Other',
}

const STATUS_VARIANT: Record<IssueStatus, 'success' | 'warning' | 'error' | 'neutral'> = {
  OPEN:        'error',
  IN_PROGRESS: 'warning',
  RESOLVED:    'success',
  WAIVED:      'neutral',
  ESCALATED:   'error',
}

const STATUS_LABEL: Record<IssueStatus, string> = {
  OPEN:        'Open',
  IN_PROGRESS: 'In Progress',
  RESOLVED:    'Resolved',
  WAIVED:      'Waived',
  ESCALATED:   'Escalated',
}

const PRIORITY_VARIANT: Record<IssuePriority, 'error' | 'warning' | 'neutral'> = {
  HIGH:   'error',
  MEDIUM: 'warning',
  LOW:    'neutral',
}

const ALL_STATUSES: IssueStatus[]  = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'WAIVED', 'ESCALATED']
const ALL_PRIORITIES: IssuePriority[] = ['HIGH', 'MEDIUM', 'LOW']
const ALL_TYPES: IssueType[] = [
  'MISSING_DOCUMENT', 'UNCLASSIFIED_TRANSACTION', 'RECONCILIATION_DIFFERENCE',
  'TAX_SENSITIVE_ITEM', 'DIRECTOR_RELATED_TRANSACTION', 'RELATED_PARTY_TRANSACTION',
  'HIGH_VALUE_TRANSACTION', 'DATA_INCONSISTENCY', 'OTHER',
]

function issueAge(createdAt: string): number {
  return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000)
}

const PAGE_SIZE = 25

// ---------------------------------------------------------------------------
// Inline Resolution Panel
// ---------------------------------------------------------------------------
interface ResolutionPanelProps {
  issue: Issue
  onUpdate: (updated: Issue) => void
  onClose: () => void
}

function ResolutionPanel({ issue, onUpdate, onClose }: ResolutionPanelProps) {
  const [resolution, setResolution] = useState(issue.resolution ?? '')
  const [saving, setSaving]         = useState(false)

  const patch = async (data: Record<string, unknown>) => {
    setSaving(true)
    try {
      const res  = await fetch(`/api/unresolved-issues/${issue.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...data, actor_id: 'current_user' }),
      })
      const json = await res.json()
      if (res.ok) onUpdate(json.data)
    } finally {
      setSaving(false)
    }
  }

  return (
    <tr>
      <td colSpan={9} className="bg-panel px-5 py-4 border-b border-border">
        <div className="max-w-3xl space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="section-title mb-0">{issue.title}</h3>
            <button className="btn-ghost text-sm" onClick={onClose}>Close ✕</button>
          </div>

          {issue.description && (
            <p className="text-body text-ink-secondary">{issue.description}</p>
          )}

          <div className="flex gap-4 text-label text-ink-muted flex-wrap">
            {issue.related_txn_id && (
              <Link href={`/transactions/${issue.related_txn_id}`} className="underline hover:text-ink-primary">
                → Related Transaction
              </Link>
            )}
            {issue.related_doc_id && (
              <Link href={`/documents/${issue.related_doc_id}`} className="underline hover:text-ink-primary">
                → Related Document
              </Link>
            )}
            {issue.period && <span>Period: {issue.period}</span>}
            {issue.assigned_to && <span>Assigned to: {issue.assigned_to}</span>}
          </div>

          {/* Resolution area */}
          <div>
            <label className="form-label">Resolution Notes</label>
            <textarea
              className="form-input w-full min-h-[72px] resize-y text-sm"
              placeholder="Describe how this issue was resolved…"
              value={resolution}
              onChange={e => setResolution(e.target.value)}
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {issue.status !== 'IN_PROGRESS' && issue.status !== 'RESOLVED' && issue.status !== 'WAIVED' && (
              <button
                className="btn-secondary text-sm"
                disabled={saving}
                onClick={() => patch({ status: 'IN_PROGRESS' })}
              >
                Mark In Progress
              </button>
            )}
            {issue.status !== 'RESOLVED' && (
              <button
                className="btn-primary text-sm"
                disabled={saving}
                onClick={() => patch({ status: 'RESOLVED', resolution, resolved_by: 'current_user' })}
              >
                {saving ? 'Saving…' : 'Mark Resolved'}
              </button>
            )}
            {issue.status !== 'WAIVED' && issue.status !== 'RESOLVED' && (
              <button
                className="btn-ghost text-sm"
                disabled={saving}
                onClick={() => { if (confirm('Waive this issue?')) patch({ status: 'WAIVED', resolution }) }}
              >
                Waive
              </button>
            )}
            {issue.status === 'OPEN' && (
              <button
                className="btn-ghost text-sm"
                disabled={saving}
                onClick={() => patch({ status: 'ESCALATED' })}
              >
                Escalate
              </button>
            )}
          </div>
        </div>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function UnresolvedIssuesPage() {
  const [issues, setIssues]     = useState<Issue[]>([])
  const [entities, setEntities] = useState<Entity[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [total, setTotal]       = useState(0)

  // Filters
  const [entityId, setEntityId]           = useState('')
  const [statuses, setStatuses]           = useState<IssueStatus[]>([])
  const [priorities, setPriorities]       = useState<IssuePriority[]>([])
  const [issueType, setIssueType]         = useState('')
  const [period, setPeriod]               = useState('')
  const [offset, setOffset]               = useState(0)

  // Expanded row for inline panel
  const [expandedId, setExpandedId] = useState<string | null>(null)

  // Stats
  const [statsAll, setStatsAll]             = useState(0)
  const [statsHigh, setStatsHigh]           = useState(0)
  const [statsInProgress, setStatsInProgress] = useState(0)
  const [statsResolvedMonth, setStatsResolvedMonth] = useState(0)

  // Fetch entities for filter dropdown
  useEffect(() => {
    fetch('/api/entities')
      .then(r => r.json())
      .then(j => setEntities(j.data ?? []))
      .catch(() => {/* non-fatal */})
  }, [])

  // Fetch issues
  const fetchIssues = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (entityId)   params.set('entity_id', entityId)
      if (statuses.length === 1) params.set('status', statuses[0])
      if (priorities.length === 1) params.set('priority', priorities[0])
      if (issueType)  params.set('issue_type', issueType)
      if (period)     params.set('period', period)
      params.set('limit',  String(PAGE_SIZE))
      params.set('offset', String(offset))

      const res  = await fetch(`/api/unresolved-issues?${params}`)
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Failed to load'); return }

      const data: Issue[] = json.data ?? []
      setIssues(data)
      setTotal(json.total ?? data.length)

      // Compute stats from current full list (no filter applied stats call)
      // We do a separate unfiltered call for stats
    } catch {
      setError('Network error loading issues')
    } finally {
      setLoading(false)
    }
  }, [entityId, statuses, priorities, issueType, period, offset])

  useEffect(() => { fetchIssues() }, [fetchIssues])

  // Fetch stats separately (unfiltered)
  useEffect(() => {
    Promise.all([
      fetch('/api/unresolved-issues?limit=1000').then(r => r.json()),
    ]).then(([all]) => {
      const allIssues: Issue[] = all.data ?? []
      const now = new Date()
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)

      setStatsAll(allIssues.filter(i => i.status === 'OPEN' || i.status === 'IN_PROGRESS' || i.status === 'ESCALATED').length)
      setStatsHigh(allIssues.filter(i => i.priority === 'HIGH' && i.status !== 'RESOLVED' && i.status !== 'WAIVED').length)
      setStatsInProgress(allIssues.filter(i => i.status === 'IN_PROGRESS').length)
      setStatsResolvedMonth(allIssues.filter(i =>
        i.status === 'RESOLVED' && i.resolved_at && new Date(i.resolved_at) >= thisMonthStart
      ).length)
    }).catch(() => {/* non-fatal */})
  }, [])

  const handleIssueUpdate = (updated: Issue) => {
    setIssues(prev => prev.map(i => i.id === updated.id ? updated : i))
  }

  const toggleStatus = (s: IssueStatus) => {
    setStatuses(prev =>
      prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]
    )
    setOffset(0)
  }

  const togglePriority = (p: IssuePriority) => {
    setPriorities(prev =>
      prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
    )
    setOffset(0)
  }

  const totalPages  = Math.ceil(total / PAGE_SIZE)
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="page-title">Unresolved Issues</h1>
          {total > 0 && (
            <Badge variant="error">{total}</Badge>
          )}
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <div className="card-sm text-center">
          <div className="text-2xl font-bold tabular-nums text-ink-primary">{statsAll}</div>
          <div className="text-label text-ink-muted mt-1">Open</div>
        </div>
        <div className="card-sm text-center">
          <div className="text-2xl font-bold tabular-nums text-status-error">{statsHigh}</div>
          <div className="text-label text-ink-muted mt-1">High Priority</div>
        </div>
        <div className="card-sm text-center">
          <div className="text-2xl font-bold tabular-nums text-status-warning">{statsInProgress}</div>
          <div className="text-label text-ink-muted mt-1">In Progress</div>
        </div>
        <div className="card-sm text-center">
          <div className="text-2xl font-bold tabular-nums text-status-success">{statsResolvedMonth}</div>
          <div className="text-label text-ink-muted mt-1">Resolved This Month</div>
        </div>
      </div>

      {/* Filters */}
      <div className="card-sm mb-6 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          {/* Entity dropdown */}
          <div>
            <label className="form-label">Entity</label>
            <select
              className="form-input w-52"
              value={entityId}
              onChange={e => { setEntityId(e.target.value); setOffset(0) }}
            >
              <option value="">All Entities</option>
              {entities.map(ent => (
                <option key={ent.id} value={ent.id}>{ent.entity_name}</option>
              ))}
            </select>
          </div>

          {/* Issue type */}
          <div>
            <label className="form-label">Issue Type</label>
            <select
              className="form-input w-52"
              value={issueType}
              onChange={e => { setIssueType(e.target.value); setOffset(0) }}
            >
              <option value="">All Types</option>
              {ALL_TYPES.map(t => (
                <option key={t} value={t}>{ISSUE_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>

          {/* Period */}
          <div>
            <label className="form-label">Period</label>
            <input
              type="text"
              className="form-input w-32"
              placeholder="e.g. 2024-01"
              value={period}
              onChange={e => { setPeriod(e.target.value); setOffset(0) }}
            />
          </div>
        </div>

        {/* Status chips */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-label text-ink-muted">Status:</span>
          {ALL_STATUSES.map(s => (
            <button
              key={s}
              onClick={() => toggleStatus(s)}
              className={`text-label px-3 py-1 rounded-full border transition-colors ${
                statuses.includes(s)
                  ? 'bg-ink-primary text-white border-ink-primary'
                  : 'border-border text-ink-secondary hover:border-ink-primary'
              }`}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>

        {/* Priority chips */}
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-label text-ink-muted">Priority:</span>
          {ALL_PRIORITIES.map(p => (
            <button
              key={p}
              onClick={() => togglePriority(p)}
              className={`text-label px-3 py-1 rounded-full border transition-colors ${
                priorities.includes(p)
                  ? 'bg-ink-primary text-white border-ink-primary'
                  : 'border-border text-ink-secondary hover:border-ink-primary'
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        {(entityId || statuses.length || priorities.length || issueType || period) && (
          <button
            className="btn-ghost text-sm"
            onClick={() => {
              setEntityId(''); setStatuses([]); setPriorities([])
              setIssueType(''); setPeriod(''); setOffset(0)
            }}
          >
            Clear all filters
          </button>
        )}
      </div>

      {/* Issues Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-ink-secondary text-body">Loading issues…</div>
        ) : error ? (
          <div className="p-12 text-center text-status-error text-body">{error}</div>
        ) : issues.length === 0 ? (
          <div className="p-12 text-center text-ink-secondary text-body">No issues found.</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr className="border-b border-border bg-panel">
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Entity</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Assigned</th>
                <th className="px-4 py-3 text-right">Age</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((issue, idx) => (
                <>
                  <tr
                    key={issue.id}
                    className={`border-b border-border cursor-pointer hover:bg-panel/60 transition-colors ${
                      expandedId === issue.id ? 'bg-panel/60' : idx % 2 === 0 ? '' : 'bg-panel/20'
                    }`}
                    onClick={() => setExpandedId(prev => prev === issue.id ? null : issue.id)}
                  >
                    <td className="px-4 py-3">
                      <Badge variant={PRIORITY_VARIANT[issue.priority]}>
                        {issue.priority}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <div className="font-medium text-ink-primary truncate">{issue.title}</div>
                      {issue.description && (
                        <div className="text-label text-ink-muted truncate">{issue.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-body text-ink-secondary whitespace-nowrap">
                      {issue.entity.entity_name}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-label text-ink-secondary">
                        {ISSUE_TYPE_LABELS[issue.issue_type] ?? issue.issue_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-label text-ink-muted tabular-nums">
                      {issue.period ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANT[issue.status]}>
                        {STATUS_LABEL[issue.status]}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-label text-ink-secondary">
                      {issue.assigned_to ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right text-label text-ink-muted tabular-nums">
                      {issueAge(issue.created_at)}d
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="btn-ghost text-sm"
                        onClick={e => {
                          e.stopPropagation()
                          setExpandedId(prev => prev === issue.id ? null : issue.id)
                        }}
                      >
                        {expandedId === issue.id ? 'Close' : 'View'}
                      </button>
                    </td>
                  </tr>

                  {expandedId === issue.id && (
                    <ResolutionPanel
                      key={`panel-${issue.id}`}
                      issue={issue}
                      onUpdate={updated => {
                        handleIssueUpdate(updated)
                        setExpandedId(null)
                      }}
                      onClose={() => setExpandedId(null)}
                    />
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-label text-ink-secondary">
            Page {currentPage} of {totalPages} &nbsp;·&nbsp; {total} total
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
              disabled={offset + PAGE_SIZE >= total}
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
