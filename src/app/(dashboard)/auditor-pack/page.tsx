export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Badge } from '@/components/ui/Badge'
import { formatDate, FLOW_TYPE_LABELS } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function packStatusVariant(status: string): 'success' | 'warning' | 'info' | 'neutral' {
  const map: Record<string, 'success' | 'warning' | 'info' | 'neutral'> = {
    DRAFT:     'neutral',
    FINALISED: 'success',
    SENT:      'info',
    ARCHIVED:  'neutral',
  }
  return map[status] ?? 'neutral'
}

function packStatusLabel(status: string): string {
  return status.charAt(0) + status.slice(1).toLowerCase()
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default async function AuditorPackPage() {
  const entities = await prisma.entity.findMany({
    where: { archived_at: null, is_active: true },
    include: {
      client: { select: { legal_name: true, primary_flow_type: true } },
      auditor_packages: { orderBy: { created_at: 'desc' }, take: 1 },
      _count: { select: { transactions: true, supporting_documents: true } },
    },
    orderBy: { entity_name: 'asc' },
  })

  return (
    <div className="page-content">
      {/* Page Header */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Auditor Pack</h1>
          <p className="page-subtitle">
            Review and prepare filing packs per entity for external audit and LHDN submission
          </p>
        </div>
      </div>

      {/* Summary Bar */}
      <div className="card-sm mb-6 flex flex-wrap gap-6">
        <div>
          <p className="text-label text-ink-muted">Total Entities</p>
          <p className="text-section font-semibold text-ink-primary tabular-nums">{entities.length}</p>
        </div>
        <div>
          <p className="text-label text-ink-muted">Packs Prepared</p>
          <p className="text-section font-semibold text-ink-primary tabular-nums">
            {entities.filter(e => e.auditor_packages.length > 0).length}
          </p>
        </div>
        <div>
          <p className="text-label text-ink-muted">Awaiting Pack</p>
          <p className="text-section font-semibold text-ink-primary tabular-nums">
            {entities.filter(e => e.auditor_packages.length === 0).length}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {entities.length === 0 ? (
          <div className="p-16 text-center text-ink-secondary text-body">
            No active entities found. Create an entity first.
          </div>
        ) : (
          <table className="data-table w-full">
            <thead>
              <tr className="border-b border-border bg-panel">
                <th className="px-5 py-3 text-left text-label text-ink-muted">Entity</th>
                <th className="px-5 py-3 text-left text-label text-ink-muted">Client</th>
                <th className="px-5 py-3 text-left text-label text-ink-muted">Flow Type</th>
                <th className="px-5 py-3 text-left text-label text-ink-muted">Package Status</th>
                <th className="px-5 py-3 text-left text-label text-ink-muted">Last Generated</th>
                <th className="px-5 py-3 text-right text-label text-ink-muted">Documents</th>
                <th className="px-5 py-3 text-left text-label text-ink-muted">Action</th>
              </tr>
            </thead>
            <tbody>
              {entities.map((entity, idx) => {
                const latestPack = entity.auditor_packages[0] ?? null
                return (
                  <tr
                    key={entity.id}
                    className={`border-b border-border hover:bg-panel/50 transition-colors ${idx % 2 === 0 ? '' : 'bg-panel/20'}`}
                  >
                    <td className="px-5 py-3">
                      <span className="font-medium text-ink-primary text-body">{entity.entity_name}</span>
                    </td>
                    <td className="px-5 py-3 text-body text-ink-secondary">
                      {entity.client.legal_name}
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant="neutral">
                        {FLOW_TYPE_LABELS[entity.flow_type] ?? entity.flow_type}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      {latestPack ? (
                        <Badge variant={packStatusVariant(latestPack.status)}>
                          {packStatusLabel(latestPack.status)}
                        </Badge>
                      ) : (
                        <span className="text-label text-ink-muted">No pack yet</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-body text-ink-secondary">
                      {latestPack
                        ? formatDate(latestPack.created_at, 'medium')
                        : <span className="text-ink-muted">—</span>
                      }
                    </td>
                    <td className="px-5 py-3 text-right text-body text-ink-secondary tabular-nums">
                      {entity._count.supporting_documents}
                    </td>
                    <td className="px-5 py-3">
                      <Link
                        href={`/auditor-pack/${entity.id}`}
                        className="btn-primary text-sm"
                      >
                        Prepare Pack
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
