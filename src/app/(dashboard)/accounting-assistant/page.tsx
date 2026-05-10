export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { FLOW_TYPE_LABELS } from '@/lib/utils'
import { ClipboardCheck, AlertTriangle, CheckCircle, Clock } from 'lucide-react'

// Server-side: compute a lightweight ready-state for each entity
async function getEntityReadyState(entityId: string) {
  const [unclassified, flagged, missingDocs, openIssues, totalTxns] = await Promise.all([
    prisma.transaction.count({ where: { entity_id: entityId, archived_at: null, accounting_category_id: null } }),
    prisma.transaction.count({ where: { entity_id: entityId, archived_at: null, risk_flag: { not: null }, review_status: { not: 'APPROVED' } } }),
    prisma.transaction.count({ where: { entity_id: entityId, archived_at: null, document_status: 'REQUIRED_MISSING' } }),
    prisma.unresolvedIssue.count({ where: { entity_id: entityId, status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
    prisma.transaction.count({ where: { entity_id: entityId, archived_at: null } }),
  ])

  const blockers = unclassified + missingDocs
  const warnings = flagged + openIssues

  return {
    status: totalTxns === 0 ? 'NO_DATA' : blockers > 0 ? 'NOT_READY' : warnings > 0 ? 'NEEDS_ATTENTION' : 'READY',
    unclassified, flagged, missingDocs, openIssues, totalTxns,
  }
}

export default async function AccountingAssistantPage() {
  const entities = await prisma.entity.findMany({
    where:   { archived_at: null, is_active: true },
    include: { client: { select: { legal_name: true, client_code: true } } },
    orderBy: { created_at: 'desc' },
  })

  // Fetch ready states in parallel
  const readyStates = await Promise.all(
    entities.map(e => getEntityReadyState(e.id))
  )

  const entityData = entities.map((e, i) => ({ entity: e, ready: readyStates[i] }))

  const stats = {
    total:           entities.length,
    ready:           readyStates.filter(r => r.status === 'READY').length,
    needs_attention: readyStates.filter(r => r.status === 'NEEDS_ATTENTION').length,
    not_ready:       readyStates.filter(r => r.status === 'NOT_READY').length,
    no_data:         readyStates.filter(r => r.status === 'NO_DATA').length,
  }

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <h1 className="page-title">Work Assistant</h1>
        <p className="page-subtitle">Accounting preparation status across all entities</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 mb-8 lg:grid-cols-4">
        <Card size="sm">
          <div className="flex items-center gap-3">
            <CheckCircle size={20} className="text-status-success" />
            <div>
              <p className="text-label text-ink-muted uppercase tracking-wide">Ready</p>
              <p className="text-section font-bold text-ink-primary">{stats.ready}</p>
            </div>
          </div>
        </Card>
        <Card size="sm">
          <div className="flex items-center gap-3">
            <AlertTriangle size={20} className="text-status-warning" />
            <div>
              <p className="text-label text-ink-muted uppercase tracking-wide">Needs Attention</p>
              <p className="text-section font-bold text-ink-primary">{stats.needs_attention}</p>
            </div>
          </div>
        </Card>
        <Card size="sm">
          <div className="flex items-center gap-3">
            <ClipboardCheck size={20} className="text-status-error" />
            <div>
              <p className="text-label text-ink-muted uppercase tracking-wide">Not Ready</p>
              <p className="text-section font-bold text-ink-primary">{stats.not_ready}</p>
            </div>
          </div>
        </Card>
        <Card size="sm">
          <div className="flex items-center gap-3">
            <Clock size={20} className="text-ink-muted" />
            <div>
              <p className="text-label text-ink-muted uppercase tracking-wide">No Data</p>
              <p className="text-section font-bold text-ink-primary">{stats.no_data}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Entity Cards Grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {entityData.length === 0 ? (
          <div className="col-span-3 card text-center py-16">
            <p className="text-ink-muted text-body">No entities found. Create clients and entities first.</p>
          </div>
        ) : (
          entityData.map(({ entity, ready }) => (
            <Link
              key={entity.id}
              href={`/accounting-assistant/${entity.id}`}
              className="block"
            >
              <Card className="hover:shadow-card-hover transition-shadow duration-200 cursor-pointer">
                {/* Entity Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1 min-w-0 mr-3">
                    <h3 className="text-card-title text-ink-primary truncate">{entity.entity_name}</h3>
                    <p className="text-label text-ink-muted mt-0.5">
                      {entity.client?.legal_name} · {entity.client?.client_code}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                    <Badge variant={
                      ready.status === 'READY'            ? 'success' :
                      ready.status === 'NEEDS_ATTENTION'  ? 'warning' :
                      ready.status === 'NOT_READY'        ? 'error' : 'neutral'
                    }>
                      {ready.status === 'NO_DATA' ? 'No Data' : ready.status.replace('_', ' ')}
                    </Badge>
                    <Badge variant="neutral">
                      {FLOW_TYPE_LABELS[entity.flow_type]}
                    </Badge>
                  </div>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-4 gap-2 mt-3">
                  <div className="text-center">
                    <p className={`text-section font-bold tabular-nums ${ready.unclassified > 0 ? 'text-status-warning' : 'text-ink-muted'}`}>
                      {ready.unclassified}
                    </p>
                    <p className="text-label text-ink-muted mt-0.5 leading-tight">Unclassified</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-section font-bold tabular-nums ${ready.missingDocs > 0 ? 'text-status-warning' : 'text-ink-muted'}`}>
                      {ready.missingDocs}
                    </p>
                    <p className="text-label text-ink-muted mt-0.5 leading-tight">Missing Docs</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-section font-bold tabular-nums ${ready.flagged > 0 ? 'text-status-error' : 'text-ink-muted'}`}>
                      {ready.flagged}
                    </p>
                    <p className="text-label text-ink-muted mt-0.5 leading-tight">Flagged</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-section font-bold tabular-nums ${ready.openIssues > 0 ? 'text-status-error' : 'text-ink-muted'}`}>
                      {ready.openIssues}
                    </p>
                    <p className="text-label text-ink-muted mt-0.5 leading-tight">Open Issues</p>
                  </div>
                </div>

                {/* Total txns */}
                <div className="mt-4 pt-3 border-t border-divider flex items-center justify-between">
                  <span className="text-label text-ink-muted">
                    {ready.totalTxns.toLocaleString()} transactions total
                  </span>
                  <span className="text-label text-ink-secondary font-medium">Open →</span>
                </div>
              </Card>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
