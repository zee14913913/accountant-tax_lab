'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

interface ChecklistItem {
  key: string
  label: string
  required: boolean
  status: 'pending' | 'done' | 'na'
  completed_by?: string
  completed_at?: string
}

interface ChecklistJson {
  flow_type: string
  items: ChecklistItem[]
}

interface PnlSnapshot {
  id: string
  period_start: string
  period_end: string
  flow_type: string
  basis: string
  revenue_total: string | null
  cogs_total: string | null
  gross_profit: string | null
  opex_total: string | null
  other_income_total: string | null
  finance_cost_total: string | null
  net_profit: string | null
  is_final: boolean
  generated_at: string
  monthly_close: { id: string; status: string } | null
}

interface MonthlyCloseDetail {
  id: string
  entity_id: string
  period_start: string
  period_end: string
  status: 'DRAFT' | 'IN_REVIEW' | 'CLOSED' | 'REOPENED' | 'ARCHIVED'
  checklist_json: ChecklistJson
  closed_by: string | null
  closed_at: string | null
  reopened_by: string | null
  reopened_at: string | null
  notes: string | null
  created_at: string
  entity: {
    id: string
    entity_name: string
    flow_type: string
    client: { display_name: string | null; legal_name: string }
  }
  pnl_snapshots: PnlSnapshot[]
}

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'info' | 'error' | 'neutral'> = {
  DRAFT: 'neutral',
  IN_REVIEW: 'info',
  CLOSED: 'success',
  REOPENED: 'warning',
  ARCHIVED: 'neutral',
}

function formatMYR(val: string | null) {
  if (val === null || val === undefined) return '—'
  const n = parseFloat(val)
  return `RM ${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-MY', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function MonthlyCloseDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [record, setRecord] = useState<MonthlyCloseDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [actorId] = useState('current-user') // Replace with session user
  const [reopenReason, setReopenReason] = useState('')
  const [showReopenModal, setShowReopenModal] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchRecord = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/monthly-close/${id}`)
      if (!res.ok) throw new Error('Not found')
      const json = await res.json()
      setRecord(json.data)
    } catch {
      setError('Failed to load record.')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchRecord() }, [fetchRecord])

  async function handleClose() {
    setActionLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/monthly-close/${id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor_id: actorId }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to close period')
      } else {
        await fetchRecord()
      }
    } catch {
      setError('Unexpected error')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleReopen() {
    if (!reopenReason.trim()) {
      setError('Please provide a reason for reopening.')
      return
    }
    setActionLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/monthly-close/${id}/reopen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actor_id: actorId, reason: reopenReason }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to reopen period')
      } else {
        setShowReopenModal(false)
        setReopenReason('')
        await fetchRecord()
      }
    } catch {
      setError('Unexpected error')
    } finally {
      setActionLoading(false)
    }
  }

  async function toggleChecklistItem(key: string, current: 'pending' | 'done' | 'na') {
    if (!record) return
    const next = current === 'done' ? 'pending' : 'done'
    const updatedItems = record.checklist_json.items.map(item =>
      item.key === key
        ? { ...item, status: next, completed_by: next === 'done' ? actorId : undefined, completed_at: next === 'done' ? new Date().toISOString() : undefined }
        : item
    )
    const newChecklist = { ...record.checklist_json, items: updatedItems }
    await fetch(`/api/monthly-close/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checklist_json: newChecklist }),
    })
    setRecord(prev => prev ? { ...prev, checklist_json: newChecklist } : prev)
  }

  if (loading) {
    return <div className="page-content p-10 text-center text-ink-muted">Loading…</div>
  }
  if (!record) {
    return <div className="page-content p-10 text-center text-ink-muted">Record not found.</div>
  }

  const checklist = record.checklist_json
  const doneCount = checklist.items.filter(i => i.status === 'done').length
  const totalItems = checklist.items.length
  const allRequiredDone = checklist.items.filter(i => i.required).every(i => i.status === 'done')

  const latestSnapshot = record.pnl_snapshots[0] ?? null

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <button onClick={() => router.back()} className="btn-ghost text-label">← Back</button>
            <Badge variant={STATUS_VARIANT[record.status] ?? 'neutral'}>
              {record.status.replace('_', ' ')}
            </Badge>
          </div>
          <h1 className="page-title">
            {new Date(record.period_start).toLocaleDateString('en-MY', { year: 'numeric', month: 'long' })}
          </h1>
          <p className="text-label text-ink-muted mt-1">
            {record.entity.entity_name} — {record.entity.client.display_name ?? record.entity.client.legal_name}
          </p>
        </div>
        <div className="flex gap-2">
          {record.status !== 'CLOSED' && record.status !== 'ARCHIVED' && (
            <button
              onClick={handleClose}
              disabled={actionLoading || !allRequiredDone}
              className="btn-primary disabled:opacity-50"
              title={!allRequiredDone ? 'All required checklist items must be done first' : ''}
            >
              {actionLoading ? 'Closing…' : 'Execute Close'}
            </button>
          )}
          {record.status === 'CLOSED' && (
            <button
              onClick={() => setShowReopenModal(true)}
              className="btn-secondary"
            >
              Reopen Period
            </button>
          )}
          <Link
            href={`/pnl/${record.entity_id}`}
            className="btn-ghost"
          >
            View P&amp;L →
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-status-error/10 border border-status-error/30 rounded-button text-body text-status-error">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Checklist */}
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>
                Closing Checklist — {doneCount}/{totalItems} Done
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border">
                {checklist.items.map(item => (
                  <div
                    key={item.key}
                    className="flex items-center gap-3 px-5 py-3"
                  >
                    <button
                      onClick={() => toggleChecklistItem(item.key, item.status)}
                      disabled={record.status === 'CLOSED' || record.status === 'ARCHIVED'}
                      className={`w-5 h-5 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${
                        item.status === 'done'
                          ? 'bg-status-success border-status-success text-white'
                          : 'border-border bg-card'
                      } disabled:cursor-not-allowed`}
                    >
                      {item.status === 'done' && (
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-body ${item.status === 'done' ? 'line-through text-ink-muted' : 'text-ink-body'}`}>
                        {item.label}
                        {item.required && (
                          <span className="ml-1 text-label text-status-error">*</span>
                        )}
                      </p>
                      {item.status === 'done' && item.completed_by && (
                        <p className="text-label text-ink-muted">
                          Done by {item.completed_by} · {item.completed_at ? new Date(item.completed_at).toLocaleDateString('en-MY') : ''}
                        </p>
                      )}
                    </div>
                    {item.status !== 'done' && !item.required && (
                      <span className="badge badge-neutral text-label">Optional</span>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* P&L Summary */}
          {latestSnapshot && (
            <Card>
              <CardHeader>
                <CardTitle>
                  P&amp;L Snapshot — {latestSnapshot.is_final ? 'Final' : 'Draft'}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="data-table">
                  <tbody>
                    <tr>
                      <td className="text-ink-muted">Revenue</td>
                      <td className="text-right tabular-nums">{formatMYR(latestSnapshot.revenue_total)}</td>
                    </tr>
                    {latestSnapshot.cogs_total !== null && (
                      <tr>
                        <td className="text-ink-muted">Cost of Sales</td>
                        <td className="text-right tabular-nums text-status-error">({formatMYR(latestSnapshot.cogs_total)})</td>
                      </tr>
                    )}
                    {latestSnapshot.gross_profit !== null && (
                      <tr className="font-medium">
                        <td>Gross Profit</td>
                        <td className="text-right tabular-nums">{formatMYR(latestSnapshot.gross_profit)}</td>
                      </tr>
                    )}
                    <tr>
                      <td className="text-ink-muted">Operating Expenses</td>
                      <td className="text-right tabular-nums text-status-error">({formatMYR(latestSnapshot.opex_total)})</td>
                    </tr>
                    {latestSnapshot.other_income_total !== null && (
                      <tr>
                        <td className="text-ink-muted">Other Income</td>
                        <td className="text-right tabular-nums">{formatMYR(latestSnapshot.other_income_total)}</td>
                      </tr>
                    )}
                    {latestSnapshot.finance_cost_total !== null && (
                      <tr>
                        <td className="text-ink-muted">Finance Cost</td>
                        <td className="text-right tabular-nums text-status-error">({formatMYR(latestSnapshot.finance_cost_total)})</td>
                      </tr>
                    )}
                    <tr className="font-semibold border-t-2 border-ink-body">
                      <td>Net Profit / (Loss)</td>
                      <td className={`text-right tabular-nums ${parseFloat(latestSnapshot.net_profit ?? '0') >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                        {formatMYR(latestSnapshot.net_profit)}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <div className="px-5 py-3 text-label text-ink-muted border-t border-divider">
                  Generated {formatDate(latestSnapshot.generated_at)} · Basis: {latestSnapshot.basis}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          <Card>
            <CardHeader><CardTitle>Period Details</CardTitle></CardHeader>
            <CardContent>
              <dl className="space-y-3">
                <div>
                  <dt className="text-label text-ink-muted">Period</dt>
                  <dd className="text-body">
                    {new Date(record.period_start).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })}
                    {' – '}
                    {new Date(record.period_end).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </dd>
                </div>
                <div>
                  <dt className="text-label text-ink-muted">Entity</dt>
                  <dd className="text-body">
                    <Link href={`/accounting-assistant/${record.entity_id}`} className="underline underline-offset-2">
                      {record.entity.entity_name}
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt className="text-label text-ink-muted">Client</dt>
                  <dd className="text-body">{record.entity.client.display_name ?? record.entity.client.legal_name}</dd>
                </div>
                <div>
                  <dt className="text-label text-ink-muted">Created</dt>
                  <dd className="text-body">{formatDate(record.created_at)}</dd>
                </div>
                {record.closed_at && (
                  <div>
                    <dt className="text-label text-ink-muted">Closed</dt>
                    <dd className="text-body">{formatDate(record.closed_at)}</dd>
                  </div>
                )}
                {record.reopened_at && (
                  <div>
                    <dt className="text-label text-ink-muted">Reopened</dt>
                    <dd className="text-body">{formatDate(record.reopened_at)}</dd>
                  </div>
                )}
              </dl>
              {record.notes && (
                <div className="mt-4 pt-4 border-t border-divider">
                  <dt className="text-label text-ink-muted mb-1">Notes</dt>
                  <dd className="text-body whitespace-pre-wrap">{record.notes}</dd>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Checklist Progress */}
          <Card>
            <CardHeader><CardTitle>Progress</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex justify-between text-label">
                  <span className="text-ink-muted">Overall</span>
                  <span className="tabular-nums">{doneCount} / {totalItems}</span>
                </div>
                <div className="w-full bg-panel rounded-full h-2">
                  <div
                    className="bg-ink-body h-2 rounded-full transition-all"
                    style={{ width: totalItems > 0 ? `${(doneCount / totalItems) * 100}%` : '0%' }}
                  />
                </div>
                <div className="flex justify-between text-label">
                  <span className="text-ink-muted">Required Items</span>
                  <span className={`tabular-nums ${allRequiredDone ? 'text-status-success' : 'text-status-warning'}`}>
                    {checklist.items.filter(i => i.required && i.status === 'done').length} / {checklist.items.filter(i => i.required).length}
                  </span>
                </div>
                {!allRequiredDone && (
                  <p className="text-label text-status-warning">
                    ⚠ All required items must be completed before closing.
                  </p>
                )}
                {allRequiredDone && record.status !== 'CLOSED' && (
                  <p className="text-label text-status-success">
                    ✓ Ready to close
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Snapshots list */}
          {record.pnl_snapshots.length > 1 && (
            <Card>
              <CardHeader><CardTitle>P&amp;L History</CardTitle></CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-divider">
                  {record.pnl_snapshots.map(s => (
                    <div key={s.id} className="px-4 py-2 flex justify-between items-center">
                      <div>
                        <p className="text-body tabular-nums">
                          {formatMYR(s.net_profit)}
                        </p>
                        <p className="text-label text-ink-muted">
                          {new Date(s.generated_at).toLocaleDateString('en-MY')}
                        </p>
                      </div>
                      {s.is_final && <Badge variant="success">Final</Badge>}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Reopen Modal */}
      {showReopenModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="card w-full max-w-md mx-4 p-6">
            <h2 className="section-title mb-2">Reopen Period</h2>
            <p className="text-body text-ink-muted mb-4">
              Reopening this period will allow editing of transactions and documents. An audit log entry will be created.
            </p>
            <label className="form-label">Reason for Reopening *</label>
            <textarea
              value={reopenReason}
              onChange={e => setReopenReason(e.target.value)}
              className="form-input w-full mt-1 h-24 resize-none"
              placeholder="e.g. Missing invoice discovered — need to add transaction…"
            />
            {error && <p className="text-label text-status-error mt-2">{error}</p>}
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => { setShowReopenModal(false); setError(null) }} className="btn-ghost">
                Cancel
              </button>
              <button onClick={handleReopen} disabled={actionLoading} className="btn-primary disabled:opacity-50">
                {actionLoading ? 'Reopening…' : 'Confirm Reopen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
