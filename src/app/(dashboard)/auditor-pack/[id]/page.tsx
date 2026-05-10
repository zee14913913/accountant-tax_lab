'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type PackStatus = 'DRAFT' | 'FINALISED' | 'SENT' | 'ARCHIVED'
type ItemStatus = 'PENDING' | 'GENERATED' | 'FAILED' | 'SKIPPED'

interface AuditorPackageItem {
  id: string
  item_type: string
  item_label: string
  status: ItemStatus
  file_url: string | null
  file_name: string | null
  generated_at: string | null
  error_message: string | null
  sort_order: number
}

interface AuditorPackage {
  id: string
  pack_name: string
  status: PackStatus
  period_start: string
  period_end: string
  assessment_year: number | null
  prepared_by: string
  finalised_by: string | null
  finalised_at: string | null
  sent_to: string | null
  sent_at: string | null
  notes: string | null
  entity: {
    entity_name: string
    flow_type: string
    client: { display_name: string | null; legal_name: string }
  }
  items: AuditorPackageItem[]
}

interface Issue {
  id: string
  title: string
  priority: 'HIGH' | 'MEDIUM' | 'LOW'
  status: string
  issue_type: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const ITEM_TYPE_LABELS: Record<string, string> = {
  PNL_STATEMENT:           'P&L Statement',
  BALANCE_SHEET_SUMMARY:   'Balance Sheet Summary',
  TRANSACTION_LIST:        'Transaction List',
  DOCUMENT_MANIFEST:       'Document Manifest',
  CHECKLIST_EXPORT:        'Closing Checklist',
  TAX_COMPUTATION:         'Tax Computation',
  UNRESOLVED_ISSUES_REPORT:'Unresolved Issues Report',
  AUDIT_TRAIL:             'Audit Trail',
  FIXED_ASSET_SCHEDULE:    'Fixed Asset Schedule',
  PARTNER_LEDGER:          'Partner Ledger',
  CUSTOM:                  'Custom Item',
}

const PACK_STATUS_VARIANT: Record<PackStatus, 'success' | 'warning' | 'info' | 'neutral'> = {
  DRAFT:     'neutral',
  FINALISED: 'success',
  SENT:      'info',
  ARCHIVED:  'neutral',
}

const PACK_STATUS_LABEL: Record<PackStatus, string> = {
  DRAFT:     'Draft',
  FINALISED: 'Finalised',
  SENT:      'Sent',
  ARCHIVED:  'Archived',
}

const ITEM_STATUS_VARIANT: Record<ItemStatus, 'success' | 'warning' | 'error' | 'neutral'> = {
  PENDING:   'neutral',
  GENERATED: 'success',
  FAILED:    'error',
  SKIPPED:   'neutral',
}

// ---------------------------------------------------------------------------
// Item Card
// ---------------------------------------------------------------------------
function ItemCard({ item }: { item: AuditorPackageItem }) {
  const label = ITEM_TYPE_LABELS[item.item_type] ?? item.item_label ?? item.item_type

  return (
    <div className="card-sm flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <span className="text-body font-medium text-ink-primary">{label}</span>
        <Badge variant={ITEM_STATUS_VARIANT[item.status]}>
          {item.status.charAt(0) + item.status.slice(1).toLowerCase()}
        </Badge>
      </div>

      {item.status === 'PENDING' && (
        <p className="text-label text-ink-muted">Awaiting generation…</p>
      )}

      {item.status === 'FAILED' && item.error_message && (
        <p className="text-label text-status-error">{item.error_message}</p>
      )}

      {item.status === 'GENERATED' && (
        <div className="space-y-1">
          {item.file_name && (
            <p className="text-label text-ink-secondary truncate">{item.file_name}</p>
          )}
          {item.generated_at && (
            <p className="text-label text-ink-muted">
              Generated {formatDate(item.generated_at, 'medium')}
            </p>
          )}
          {item.file_url && (
            <a
              href={item.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost text-sm mt-1"
            >
              ↓ Download
            </a>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------
export default function AuditorPackDetailPage() {
  const params = useParams<{ id: string }>()
  const [pack, setPack]             = useState<AuditorPackage | null>(null)
  const [issues, setIssues]         = useState<Issue[]>([])
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [notes, setNotes]           = useState('')
  const [savingNotes, setSavingNotes] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  const loadPack = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`/api/auditor-pack/${params.id}`)
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Failed to load package'); return }
      setPack(json.data)
      setNotes(json.data.notes ?? '')

      // Load open issues for this entity
      const issRes  = await fetch(`/api/unresolved-issues?entity_id=${json.data.entity_id ?? ''}&status=OPEN`)
      const issJson = await issRes.json()
      setIssues(issJson.data ?? [])
    } catch {
      setError('Network error loading package')
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => { loadPack() }, [loadPack])

  const patchPack = async (data: Record<string, unknown>) => {
    setActionLoading(true)
    try {
      const res  = await fetch(`/api/auditor-pack/${params.id}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ ...data, actor_id: 'current_user' }),
      })
      const json = await res.json()
      if (!res.ok) { alert(json.error ?? 'Failed to update'); return }
      setPack(json.data)
      setNotes(json.data.notes ?? '')
    } finally {
      setActionLoading(false)
    }
  }

  const handleGenerate = async () => {
    setActionLoading(true)
    try {
      await fetch(`/api/auditor-pack/${params.id}/generate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ actor_id: 'current_user' }),
      })
      alert('Pack generation queued. Items will update when ready.')
    } finally {
      setActionLoading(false)
    }
  }

  const handleSaveNotes = async () => {
    setSavingNotes(true)
    await patchPack({ notes })
    setSavingNotes(false)
  }

  if (loading) {
    return (
      <div className="page-content">
        <div className="p-16 text-center text-ink-secondary text-body">Loading package…</div>
      </div>
    )
  }

  if (error || !pack) {
    return (
      <div className="page-content">
        <div className="p-16 text-center text-status-error text-body">{error ?? 'Package not found'}</div>
      </div>
    )
  }

  const generatedCount = pack.items.filter(i => i.status === 'GENERATED').length
  const totalItems      = pack.items.length
  const allGenerated    = totalItems > 0 && generatedCount === totalItems
  const highOpenIssues  = issues.filter(i => i.priority === 'HIGH')

  const entityId = (pack as AuditorPackage & { entity_id?: string }).entity_id

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="page-title">{pack.pack_name}</h1>
            <Badge variant={PACK_STATUS_VARIANT[pack.status]}>
              {PACK_STATUS_LABEL[pack.status]}
            </Badge>
          </div>
          <p className="page-subtitle mt-1">
            {pack.entity.entity_name} &nbsp;·&nbsp;
            {formatDate(pack.period_start, 'short')} – {formatDate(pack.period_end, 'short')}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {(pack.status === 'DRAFT' || pack.status === 'FINALISED') && (
            <button
              className="btn-secondary"
              onClick={handleGenerate}
              disabled={actionLoading}
            >
              Generate All
            </button>
          )}

          {pack.status === 'DRAFT' && allGenerated && (
            <button
              className="btn-primary"
              onClick={() => patchPack({ status: 'FINALISED' })}
              disabled={actionLoading}
            >
              Finalise
            </button>
          )}

          {pack.status === 'FINALISED' && (
            <button
              className="btn-primary"
              onClick={() => patchPack({ status: 'SENT' })}
              disabled={actionLoading}
            >
              Mark Sent
            </button>
          )}

          {(pack.status === 'DRAFT' || pack.status === 'FINALISED' || pack.status === 'SENT') && (
            <button
              className="btn-ghost"
              onClick={() => { if (confirm('Archive this package?')) patchPack({ status: 'ARCHIVED' }) }}
              disabled={actionLoading}
            >
              Archive
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Items Grid — 2/3 width */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="section-title">
            Package Items
            <span className="ml-2 text-ink-muted font-normal text-body">
              {generatedCount}/{totalItems} generated
            </span>
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {pack.items.map(item => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        </div>

        {/* Sidebar — 1/3 width */}
        <div className="space-y-4">
          {/* Details Card */}
          <div className="card">
            <h2 className="section-title">Pack Details</h2>
            <dl className="space-y-3 text-body">
              <div>
                <dt className="text-label text-ink-muted">Entity</dt>
                <dd className="text-ink-primary">{pack.entity.entity_name}</dd>
              </div>
              <div>
                <dt className="text-label text-ink-muted">Client</dt>
                <dd className="text-ink-secondary">
                  {pack.entity.client.display_name ?? pack.entity.client.legal_name}
                </dd>
              </div>
              <div>
                <dt className="text-label text-ink-muted">Period</dt>
                <dd className="text-ink-secondary">
                  {formatDate(pack.period_start, 'medium')} – {formatDate(pack.period_end, 'medium')}
                </dd>
              </div>
              {pack.assessment_year && (
                <div>
                  <dt className="text-label text-ink-muted">Assessment Year</dt>
                  <dd className="text-ink-secondary tabular-nums">{pack.assessment_year}</dd>
                </div>
              )}
              <div>
                <dt className="text-label text-ink-muted">Prepared By</dt>
                <dd className="text-ink-secondary">{pack.prepared_by}</dd>
              </div>
              {pack.finalised_by && (
                <div>
                  <dt className="text-label text-ink-muted">Finalised By</dt>
                  <dd className="text-ink-secondary">
                    {pack.finalised_by}
                    {pack.finalised_at && (
                      <span className="block text-label text-ink-muted">
                        {formatDate(pack.finalised_at, 'medium')}
                      </span>
                    )}
                  </dd>
                </div>
              )}
              {pack.sent_to && (
                <div>
                  <dt className="text-label text-ink-muted">Sent To</dt>
                  <dd className="text-ink-secondary">
                    {pack.sent_to}
                    {pack.sent_at && (
                      <span className="block text-label text-ink-muted">
                        {formatDate(pack.sent_at, 'medium')}
                      </span>
                    )}
                  </dd>
                </div>
              )}
            </dl>
          </div>

          {/* Notes Card */}
          <div className="card">
            <h2 className="section-title">Notes</h2>
            <textarea
              className="form-input w-full min-h-[80px] resize-y text-sm"
              placeholder="Add any remarks…"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            />
            <button
              className="btn-secondary mt-2 text-sm"
              onClick={handleSaveNotes}
              disabled={savingNotes}
            >
              {savingNotes ? 'Saving…' : 'Save Notes'}
            </button>
          </div>
        </div>
      </div>

      {/* Unresolved Issues Panel */}
      <div className="card mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-title mb-0">
            Unresolved Issues
            {issues.length > 0 && (
              <Badge variant={highOpenIssues.length > 0 ? 'error' : 'warning'} className="ml-2">
                {issues.length} open
              </Badge>
            )}
          </h2>
          {entityId && (
            <Link href={`/unresolved-issues?entity_id=${entityId}`} className="btn-ghost text-sm">
              View all issues →
            </Link>
          )}
        </div>

        {issues.length === 0 ? (
          <p className="text-body text-ink-secondary">No open issues for this entity.</p>
        ) : (
          <>
            {highOpenIssues.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-card px-4 py-3 mb-4">
                <p className="text-status-error text-body font-medium">
                  ⚠ {highOpenIssues.length} HIGH priority issue{highOpenIssues.length !== 1 ? 's' : ''} unresolved.
                  Review before finalising.
                </p>
              </div>
            )}
            <div className="space-y-2">
              {issues.slice(0, 5).map(issue => (
                <div key={issue.id} className="flex items-center gap-3 text-body">
                  <Badge variant={issue.priority === 'HIGH' ? 'error' : issue.priority === 'MEDIUM' ? 'warning' : 'neutral'}>
                    {issue.priority}
                  </Badge>
                  <span className="text-ink-primary flex-1 truncate">{issue.title}</span>
                  <Badge variant="neutral">{issue.status.replace('_', ' ')}</Badge>
                </div>
              ))}
              {issues.length > 5 && (
                <p className="text-label text-ink-muted mt-2">
                  + {issues.length - 5} more issues
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
