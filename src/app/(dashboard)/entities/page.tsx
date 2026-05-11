export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { FLOW_TYPE_LABELS } from '@/lib/utils'
import { Plus, Building2 } from 'lucide-react'

const ENTITY_TYPE_LABELS: Record<string, string> = {
  INDIVIDUAL_TAX:      'Individual Tax',
  SOLE_PROPRIETORSHIP: 'Sole Proprietorship',
  ENTERPRISE:          'Enterprise',
  PARTNERSHIP:         'Partnership',
  SDN_BHD:             'Sdn Bhd',
  BHD:                 'Bhd',
  LLP:                 'LLP',
  FREELANCE:           'Freelance',
}

export default async function EntitiesPage() {
  const entities = await prisma.entity.findMany({
    where: { archived_at: null },
    include: {
      client: { select: { id: true, legal_name: true, display_name: true, client_code: true } },
      bank_accounts: { where: { is_active: true }, select: { id: true } },
      _count: { select: { transactions: true, import_batches: true } },
    },
    orderBy: { created_at: 'desc' },
  })

  const stats = {
    total:    entities.length,
    active:   entities.filter(e => e.is_active).length,
    inactive: entities.filter(e => !e.is_active).length,
    byFlow: {
      INDIVIDUAL_ONLY:     entities.filter(e => e.flow_type === 'INDIVIDUAL_ONLY').length,
      INDIVIDUAL_BUSINESS: entities.filter(e => e.flow_type === 'INDIVIDUAL_BUSINESS').length,
      PARTNERSHIP:         entities.filter(e => e.flow_type === 'PARTNERSHIP').length,
      COMPANY:             entities.filter(e => e.flow_type === 'COMPANY').length,
    },
  }

  return (
    <div>
      {/* Page Header */}
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="page-title">Entities</h1>
          <p className="page-subtitle">{stats.total} entities across {new Set(entities.map(e => e.client_id)).size} clients</p>
        </div>
        <Link href="/entities/new" className="btn-primary">
          <Plus size={16} />
          New Entity
        </Link>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4 mb-8 lg:grid-cols-6">
        <Card size="sm">
          <p className="text-label text-ink-muted uppercase tracking-wide mb-1">Total</p>
          <p className="text-section font-bold text-ink-primary tabular-nums">{stats.total}</p>
        </Card>
        <Card size="sm">
          <p className="text-label text-ink-muted uppercase tracking-wide mb-1">Active</p>
          <p className="text-section font-bold text-status-success tabular-nums">{stats.active}</p>
        </Card>
        <Card size="sm">
          <p className="text-label text-ink-muted uppercase tracking-wide mb-1">Individual</p>
          <p className="text-section font-bold text-ink-primary tabular-nums">{stats.byFlow.INDIVIDUAL_ONLY}</p>
        </Card>
        <Card size="sm">
          <p className="text-label text-ink-muted uppercase tracking-wide mb-1">Indiv+Biz</p>
          <p className="text-section font-bold text-ink-primary tabular-nums">{stats.byFlow.INDIVIDUAL_BUSINESS}</p>
        </Card>
        <Card size="sm">
          <p className="text-label text-ink-muted uppercase tracking-wide mb-1">Partnership</p>
          <p className="text-section font-bold text-ink-primary tabular-nums">{stats.byFlow.PARTNERSHIP}</p>
        </Card>
        <Card size="sm">
          <p className="text-label text-ink-muted uppercase tracking-wide mb-1">Company</p>
          <p className="text-section font-bold text-ink-primary tabular-nums">{stats.byFlow.COMPANY}</p>
        </Card>
      </div>

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th className="py-3 px-6">Entity Name</th>
              <th className="py-3 px-4">Client</th>
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4">Flow</th>
              <th className="py-3 px-4">FYE</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Txns</th>
              <th className="py-3 px-4 text-right">Banks</th>
              <th className="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {entities.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-16">
                  <Building2 size={32} className="text-ink-muted mx-auto mb-3" />
                  <p className="text-body text-ink-muted">No entities yet.</p>
                  <p className="text-label text-ink-muted mt-1">Create a client first, then add entities.</p>
                </td>
              </tr>
            ) : (
              entities.map((entity) => (
                <tr key={entity.id}>
                  <td className="py-3 px-6">
                    <div>
                      <Link href={`/entities/${entity.id}`} className="font-medium text-ink-primary hover:underline">
                        {entity.entity_name}
                      </Link>
                      {entity.tax_reference_no && (
                        <p className="text-label font-mono text-ink-muted">{entity.tax_reference_no}</p>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <Link href={`/clients/${entity.client.id}`} className="hover:underline">
                      <p className="text-body text-ink-secondary">{entity.client.display_name ?? entity.client.legal_name}</p>
                      <p className="text-label font-mono text-ink-muted">{entity.client.client_code}</p>
                    </Link>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-label text-ink-secondary">
                      {ENTITY_TYPE_LABELS[entity.entity_type] ?? entity.entity_type}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant="neutral">{FLOW_TYPE_LABELS[entity.flow_type]}</Badge>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-label font-mono text-ink-secondary">{entity.financial_year_end}</span>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={entity.is_active ? 'success' : 'neutral'}>
                      {entity.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="tabular-nums text-body text-ink-secondary">
                      {entity._count.transactions.toLocaleString()}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="tabular-nums text-body text-ink-secondary">
                      {entity.bank_accounts.length}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <Link href={`/accounting-assistant/${entity.id}`} className="text-label text-ink-secondary hover:text-ink-primary whitespace-nowrap">
                      Workbench →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
