export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { FLOW_TYPE_LABELS } from '@/lib/utils'
import {
  Users, Building2, Receipt, AlertTriangle,
  Clock, CheckCircle, XCircle, TrendingUp, Landmark, Upload
} from 'lucide-react'

export default async function DashboardPage() {
  const [
    totalClients,
    activeEntities,
    totalTransactions,
    unclassifiedTxns,
    flaggedTxns,
    missingDocsTxns,
    openIssues,
    totalBankAccounts,
    recentImports,
    recentClients,
    pendingReviewTxns,
  ] = await Promise.all([
    prisma.client.count({ where: { archived_at: null } }),
    prisma.entity.count({ where: { archived_at: null, is_active: true } }),
    prisma.transaction.count({ where: { archived_at: null } }),
    prisma.transaction.count({ where: { archived_at: null, accounting_category_id: null } }),
    prisma.transaction.count({ where: { archived_at: null, risk_flag: { not: null }, review_status: { not: 'APPROVED' } } }),
    prisma.transaction.count({ where: { archived_at: null, document_status: 'REQUIRED_MISSING' } }),
    prisma.unresolvedIssue.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
    prisma.bankAccount.count({ where: { is_active: true } }),
    prisma.importBatch.findMany({
      where: { archived_at: null },
      include: {
        entity:       { select: { entity_name: true } },
        bank_account: { select: { bank_name: true } },
      },
      orderBy: { imported_at: 'desc' },
      take: 5,
    }),
    prisma.client.findMany({
      where: { archived_at: null },
      orderBy: { created_at: 'desc' },
      take: 6,
      include: {
        entities: { where: { archived_at: null }, select: { id: true, entity_name: true } },
      },
    }),
    prisma.transaction.count({ where: { archived_at: null, review_status: { in: ['UNREVIEWED', 'IN_REVIEW', 'FLAGGED'] } } }),
  ])

  const IMPORT_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
    COMPLETED:  'success',
    PROCESSING: 'info',
    PARTIAL:    'warning',
    FAILED:     'error',
    PENDING:    'neutral',
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Accountant Work Replacement System — Overview</p>
      </div>

      {/* Primary Stats */}
      <div className="grid grid-cols-2 gap-5 mb-6 lg:grid-cols-4">
        <Link href="/clients" className="block">
          <Card className="hover:shadow-card-hover transition-shadow cursor-pointer">
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-ink-primary/5 flex items-center justify-center">
                <Users size={18} className="text-ink-primary" />
              </div>
            </div>
            <p className="text-page-title font-bold text-ink-primary tabular-nums">{totalClients}</p>
            <p className="text-label text-ink-muted uppercase tracking-wide mt-1">Total Clients</p>
          </Card>
        </Link>

        <Link href="/entities" className="block">
          <Card className="hover:shadow-card-hover transition-shadow cursor-pointer">
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-ink-primary/5 flex items-center justify-center">
                <Building2 size={18} className="text-ink-primary" />
              </div>
            </div>
            <p className="text-page-title font-bold text-ink-primary tabular-nums">{activeEntities}</p>
            <p className="text-label text-ink-muted uppercase tracking-wide mt-1">Active Entities</p>
          </Card>
        </Link>

        <Link href="/transactions" className="block">
          <Card className="hover:shadow-card-hover transition-shadow cursor-pointer">
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-ink-primary/5 flex items-center justify-center">
                <Receipt size={18} className="text-ink-primary" />
              </div>
            </div>
            <p className="text-page-title font-bold text-ink-primary tabular-nums">{totalTransactions.toLocaleString()}</p>
            <p className="text-label text-ink-muted uppercase tracking-wide mt-1">Total Transactions</p>
          </Card>
        </Link>

        <Link href="/bank-accounts" className="block">
          <Card className="hover:shadow-card-hover transition-shadow cursor-pointer">
            <div className="flex items-start justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-ink-primary/5 flex items-center justify-center">
                <Landmark size={18} className="text-ink-primary" />
              </div>
            </div>
            <p className="text-page-title font-bold text-ink-primary tabular-nums">{totalBankAccounts}</p>
            <p className="text-label text-ink-muted uppercase tracking-wide mt-1">Bank Accounts</p>
          </Card>
        </Link>
      </div>

      {/* Alert Row */}
      {(unclassifiedTxns > 0 || flaggedTxns > 0 || missingDocsTxns > 0 || openIssues > 0) && (
        <div className="grid grid-cols-2 gap-4 mb-6 lg:grid-cols-4">
          {unclassifiedTxns > 0 && (
            <Link href="/transactions?unclassified_only=true">
              <div className="flex items-center gap-3 p-4 border border-amber-200 bg-amber-50/60 rounded-card hover:shadow-card-hover transition-shadow cursor-pointer">
                <Clock size={16} className="text-status-warning flex-shrink-0" />
                <div>
                  <p className="text-label font-semibold text-status-warning tabular-nums">{unclassifiedTxns.toLocaleString()} Unclassified</p>
                  <p className="text-label text-ink-muted leading-tight">Need accounting category</p>
                </div>
              </div>
            </Link>
          )}
          {pendingReviewTxns > 0 && (
            <Link href="/transactions?review_status=UNREVIEWED">
              <div className="flex items-center gap-3 p-4 border border-border bg-card rounded-card hover:shadow-card-hover transition-shadow cursor-pointer">
                <TrendingUp size={16} className="text-ink-muted flex-shrink-0" />
                <div>
                  <p className="text-label font-semibold text-ink-primary tabular-nums">{pendingReviewTxns.toLocaleString()} Pending Review</p>
                  <p className="text-label text-ink-muted leading-tight">Unreviewed transactions</p>
                </div>
              </div>
            </Link>
          )}
          {flaggedTxns > 0 && (
            <Link href="/transactions?risk_flag=HIGH_VALUE">
              <div className="flex items-center gap-3 p-4 border border-red-200 bg-red-50/60 rounded-card hover:shadow-card-hover transition-shadow cursor-pointer">
                <AlertTriangle size={16} className="text-status-error flex-shrink-0" />
                <div>
                  <p className="text-label font-semibold text-status-error tabular-nums">{flaggedTxns.toLocaleString()} Risk Flagged</p>
                  <p className="text-label text-ink-muted leading-tight">Require review</p>
                </div>
              </div>
            </Link>
          )}
          {missingDocsTxns > 0 && (
            <Link href="/transactions?document_status=REQUIRED_MISSING">
              <div className="flex items-center gap-3 p-4 border border-amber-200 bg-amber-50/60 rounded-card hover:shadow-card-hover transition-shadow cursor-pointer">
                <XCircle size={16} className="text-status-warning flex-shrink-0" />
                <div>
                  <p className="text-label font-semibold text-status-warning tabular-nums">{missingDocsTxns.toLocaleString()} Missing Docs</p>
                  <p className="text-label text-ink-muted leading-tight">Supporting docs needed</p>
                </div>
              </div>
            </Link>
          )}
          {openIssues > 0 && (
            <Link href="/unresolved-issues">
              <div className="flex items-center gap-3 p-4 border border-red-200 bg-red-50/60 rounded-card hover:shadow-card-hover transition-shadow cursor-pointer">
                <AlertTriangle size={16} className="text-status-error flex-shrink-0" />
                <div>
                  <p className="text-label font-semibold text-status-error tabular-nums">{openIssues.toLocaleString()} Open Issues</p>
                  <p className="text-label text-ink-muted leading-tight">Unresolved issues</p>
                </div>
              </div>
            </Link>
          )}
        </div>
      )}

      {/* Lower Grid */}
      <div className="grid grid-cols-5 gap-6">
        {/* Recent Clients */}
        <div className="col-span-3">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Clients</CardTitle>
                <Link href="/clients" className="text-label text-ink-secondary hover:text-ink-primary">
                  View all →
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {recentClients.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-body text-ink-muted">No clients yet.</p>
                  <Link href="/clients/new" className="btn-primary mt-4 inline-flex">
                    Create First Client
                  </Link>
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="py-2.5 px-4">Code</th>
                      <th className="py-2.5 px-4">Client</th>
                      <th className="py-2.5 px-4">Type</th>
                      <th className="py-2.5 px-4 text-right">Entities</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentClients.map((client) => (
                      <tr key={client.id}>
                        <td className="py-2.5 px-4">
                          <span className="font-mono text-label text-ink-muted">{client.client_code}</span>
                        </td>
                        <td className="py-2.5 px-4">
                          <Link href={`/clients/${client.id}`} className="hover:underline">
                            <span className="font-medium text-ink-primary">{client.legal_name}</span>
                          </Link>
                        </td>
                        <td className="py-2.5 px-4">
                          <Badge variant="neutral">{FLOW_TYPE_LABELS[client.primary_flow_type]}</Badge>
                        </td>
                        <td className="py-2.5 px-4 text-right tabular-nums text-ink-secondary">
                          {client.entities.length}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Imports */}
        <div className="col-span-2">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Recent Imports</CardTitle>
                <Link href="/imports" className="text-label text-ink-secondary hover:text-ink-primary">
                  View all →
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {recentImports.length === 0 ? (
                <div className="py-6 text-center">
                  <Upload size={24} className="text-ink-muted mx-auto mb-2" />
                  <p className="text-label text-ink-muted">No imports yet.</p>
                  <Link href="/imports/new" className="btn-secondary mt-3 inline-flex text-label">
                    Upload Statement
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {recentImports.map((batch) => (
                    <Link key={batch.id} href={`/imports/${batch.id}`} className="block group">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-body font-medium text-ink-primary truncate group-hover:underline">
                            {batch.entity?.entity_name}
                          </p>
                          <p className="text-label text-ink-muted">
                            {batch.bank_account?.bank_name} · {batch.statement_month}
                          </p>
                        </div>
                        <Badge variant={IMPORT_STATUS_VARIANT[batch.import_status] ?? 'neutral'}>
                          {batch.import_status}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
