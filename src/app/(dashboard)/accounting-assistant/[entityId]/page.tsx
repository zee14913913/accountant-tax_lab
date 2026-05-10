export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, FLOW_TYPE_LABELS, FLOW_TYPE_FORM } from '@/lib/utils'
import { ArrowLeft, CheckCircle, AlertTriangle, XCircle, ChevronRight } from 'lucide-react'

// Checklist item component
function ChecklistRow({ item }: { item: { key: string; label: string; required: boolean; status: string } }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-divider last:border-0">
      <div className={`w-5 h-5 rounded-badge flex items-center justify-center flex-shrink-0 ${
        item.status === 'DONE' ? 'bg-status-success text-white' : 'border-2 border-border'
      }`}>
        {item.status === 'DONE' && <CheckCircle size={12} />}
      </div>
      <span className={`text-body flex-1 ${item.status === 'DONE' ? 'text-ink-muted line-through' : 'text-ink-primary'}`}>
        {item.label}
      </span>
      {item.required && item.status !== 'DONE' && (
        <Badge variant="error">Required</Badge>
      )}
      {!item.required && item.status !== 'DONE' && (
        <Badge variant="neutral">Optional</Badge>
      )}
    </div>
  )
}

export default async function EntityWorkbenchPage({ params }: { params: { entityId: string } }) {
  const entity = await prisma.entity.findFirst({
    where: { id: params.entityId, archived_at: null },
    include: {
      client:          { select: { id: true, legal_name: true, client_code: true } },
      filing_profiles: { where: { is_active: true }, orderBy: { due_month: 'asc' } },
      bank_accounts:   { where: { is_active: true } },
      partners:        { where: { is_active: true } },
    },
  })

  if (!entity) notFound()

  const flowType = entity.flow_type

  // Fetch data in parallel
  const [
    totalTxns, unclassifiedTxns, reviewedTxns, flaggedTxns, missingDocsTxns,
    recentTxns, openIssues, fixedAssets, reliefItems, checklistTemplate,
  ] = await Promise.all([
    prisma.transaction.count({ where: { entity_id: entity.id, archived_at: null } }),
    prisma.transaction.count({ where: { entity_id: entity.id, archived_at: null, accounting_category_id: null } }),
    prisma.transaction.count({ where: { entity_id: entity.id, archived_at: null, review_status: { in: ['REVIEWED', 'APPROVED'] } } }),
    prisma.transaction.count({ where: { entity_id: entity.id, archived_at: null, risk_flag: { not: null } } }),
    prisma.transaction.count({ where: { entity_id: entity.id, archived_at: null, document_status: 'REQUIRED_MISSING' } }),
    prisma.transaction.findMany({
      where:   { entity_id: entity.id, archived_at: null, review_status: 'UNREVIEWED' },
      orderBy: { txn_date: 'desc' },
      take:    10,
      include: { accounting_category: { select: { code: true, name: true } } },
    }),
    prisma.unresolvedIssue.findMany({
      where:   { entity_id: entity.id, status: { in: ['OPEN', 'IN_PROGRESS'] } },
      orderBy: [{ priority: 'asc' }, { created_at: 'desc' }],
      take:    10,
    }),
    ['INDIVIDUAL_BUSINESS', 'COMPANY', 'PARTNERSHIP'].includes(flowType)
      ? prisma.fixedAsset.findMany({ where: { entity_id: entity.id, status: 'ACTIVE' }, orderBy: { acquisition_date: 'desc' } })
      : Promise.resolve([]),
    ['INDIVIDUAL_ONLY', 'INDIVIDUAL_BUSINESS'].includes(flowType)
      ? prisma.taxReliefItem.findMany({ where: { entity_id: entity.id }, orderBy: { assessment_year: 'desc' } })
      : Promise.resolve([]),
    prisma.checklistTemplate.findFirst({
      where: { flow_type: flowType, phase: 'MONTHLY_CLOSE', is_active: true },
    }),
  ])

  const readyStatus = unclassifiedTxns === 0 && missingDocsTxns === 0 && totalTxns > 0
    ? 'READY' : unclassifiedTxns === 0 && totalTxns > 0 ? 'NEEDS_ATTENTION' : 'NOT_READY'

  const checklistItems: Array<{ key: string; label: string; required: boolean; status: string }> =
    checklistTemplate?.items_json
      ? (checklistTemplate.items_json as Array<{ key: string; label: string; required: boolean; status: string }>)
      : []

  return (
    <div>
      {/* Back Nav */}
      <div className="mb-6">
        <Link href="/accounting-assistant" className="btn-ghost text-ink-muted">
          <ArrowLeft size={16} />
          Back to Work Assistant
        </Link>
      </div>

      {/* Page Header */}
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="page-title">{entity.entity_name}</h1>
          <p className="page-subtitle">
            {entity.client?.legal_name} · {entity.client?.client_code} · {FLOW_TYPE_LABELS[flowType]}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={
            readyStatus === 'READY'           ? 'success' :
            readyStatus === 'NEEDS_ATTENTION' ? 'warning' : 'error'
          }>
            {readyStatus.replace('_', ' ')}
          </Badge>
          <span className="text-label text-ink-muted font-mono">{FLOW_TYPE_FORM[flowType]}</span>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4 mb-8 lg:grid-cols-5">
        {[
          { label: 'Total Txns',    value: totalTxns,       color: 'text-ink-primary' },
          { label: 'Unclassified', value: unclassifiedTxns, color: unclassifiedTxns > 0 ? 'text-status-warning' : 'text-ink-muted' },
          { label: 'Reviewed',     value: reviewedTxns,     color: 'text-status-success' },
          { label: 'Flagged',      value: flaggedTxns,      color: flaggedTxns > 0 ? 'text-status-error' : 'text-ink-muted' },
          { label: 'Missing Docs', value: missingDocsTxns,  color: missingDocsTxns > 0 ? 'text-status-warning' : 'text-ink-muted' },
        ].map(s => (
          <Card key={s.label} size="sm">
            <p className="text-label text-ink-muted uppercase tracking-wide mb-1">{s.label}</p>
            <p className={`text-section font-bold tabular-nums ${s.color}`}>{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column: Checklist + Issues */}
        <div className="lg:col-span-1 space-y-4">
          {/* Monthly Close Checklist */}
          <Card>
            <CardHeader>
              <CardTitle>Monthly Close Checklist</CardTitle>
              <p className="text-label text-ink-muted mt-0.5">{FLOW_TYPE_LABELS[flowType]}</p>
            </CardHeader>
            <CardContent>
              {checklistItems.length === 0 ? (
                <p className="text-label text-ink-muted">No checklist template found for this entity type.</p>
              ) : (
                <div>
                  {checklistItems.map(item => (
                    <ChecklistRow key={item.key} item={item} />
                  ))}
                  <div className="mt-4 pt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-label text-ink-muted">Progress</span>
                      <span className="text-label font-medium text-ink-primary">
                        {checklistItems.filter(i => i.status === 'DONE').length} / {checklistItems.length}
                      </span>
                    </div>
                    <div className="w-full bg-panel rounded-full h-1.5 mt-2">
                      <div
                        className="bg-ink-primary h-1.5 rounded-full"
                        style={{ width: `${(checklistItems.filter(i => i.status === 'DONE').length / checklistItems.length) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Open Issues */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Unresolved Issues</CardTitle>
                <Link href="/unresolved-issues" className="text-label text-ink-secondary hover:text-ink-primary">
                  View all →
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {openIssues.length === 0 ? (
                <p className="text-label text-ink-muted">No open issues. Well done.</p>
              ) : (
                <div className="space-y-2">
                  {openIssues.map(issue => (
                    <div key={issue.id} className="flex items-start gap-3 p-3 bg-panel rounded-card">
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                        issue.priority === 'HIGH' ? 'bg-status-error' :
                        issue.priority === 'MEDIUM' ? 'bg-status-warning' : 'bg-ink-muted'
                      }`} />
                      <div>
                        <p className="text-label font-medium text-ink-primary">{issue.title}</p>
                        <p className="text-label text-ink-muted">{issue.issue_type.replace(/_/g, ' ')} · {issue.period ?? 'No period'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Filing Profiles */}
          <Card size="sm">
            <h3 className="text-card-title text-ink-primary mb-3">Filing Obligations</h3>
            {entity.filing_profiles.length === 0 ? (
              <p className="text-label text-ink-muted">No filing profiles set up.</p>
            ) : (
              <div className="space-y-2">
                {entity.filing_profiles.map(fp => (
                  <div key={fp.id} className="flex items-center justify-between">
                    <div>
                      <p className="text-label font-medium text-ink-primary">{fp.relevant_form ?? fp.filing_type}</p>
                      <p className="text-label text-ink-muted">{fp.filing_category.replace(/_/g, ' ')}</p>
                    </div>
                    {fp.due_month && (
                      <span className="text-label font-mono text-ink-secondary">{fp.due_month}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right Column: Transactions + Flow-specific */}
        <div className="lg:col-span-2 space-y-4">
          {/* Unreviewed Transactions */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Unreviewed Transactions</CardTitle>
                <Link
                  href={`/transactions?entity_id=${entity.id}&review_status=UNREVIEWED`}
                  className="text-label text-ink-secondary hover:text-ink-primary"
                >
                  View all {unclassifiedTxns > 0 ? `(${unclassifiedTxns} unclassified)` : ''} →
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {recentTxns.length === 0 ? (
                <p className="text-label text-ink-muted">All transactions reviewed.</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="py-2 px-0">Date</th>
                      <th className="py-2 px-4">Description</th>
                      <th className="py-2 px-4">Category</th>
                      <th className="py-2 px-4 text-right">Amount</th>
                      <th className="py-2 px-4"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTxns.map(txn => (
                      <tr key={txn.id}>
                        <td className="py-2 px-0">
                          <span className="font-mono text-label text-ink-secondary">
                            {new Date(txn.txn_date).toLocaleDateString('en-MY', { day: '2-digit', month: 'short' })}
                          </span>
                        </td>
                        <td className="py-2 px-4 max-w-xs">
                          <p className="text-body text-ink-primary truncate">{txn.description}</p>
                        </td>
                        <td className="py-2 px-4">
                          {txn.accounting_category ? (
                            <span className="text-label text-ink-secondary">{txn.accounting_category.code}</span>
                          ) : (
                            <span className="text-label text-status-warning font-medium">Unclassified</span>
                          )}
                        </td>
                        <td className="py-2 px-4 text-right">
                          <span className={`tabular-nums text-label font-medium ${txn.direction === 'DEBIT' ? 'text-status-error' : 'text-status-success'}`}>
                            {txn.direction === 'DEBIT' ? '−' : '+'}{formatCurrency(Number(txn.amount))}
                          </span>
                        </td>
                        <td className="py-2 px-4">
                          <Link href={`/transactions/${txn.id}`} className="text-label text-ink-secondary hover:text-ink-primary">
                            →
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {/* PARTNERSHIP: Partners Panel */}
          {flowType === 'PARTNERSHIP' && entity.partners.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Partners</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="py-2 px-0">Name</th>
                      <th className="py-2 px-4">IC No.</th>
                      <th className="py-2 px-4 text-right">Profit Share</th>
                      <th className="py-2 px-4 text-right">Capital</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entity.partners.map(p => (
                      <tr key={p.id}>
                        <td className="py-2 px-0 font-medium text-ink-primary">{p.partner_name}</td>
                        <td className="py-2 px-4 font-mono text-label text-ink-secondary">{p.identification_no ?? '—'}</td>
                        <td className="py-2 px-4 text-right tabular-nums text-body">{Number(p.profit_share_percentage).toFixed(2)}%</td>
                        <td className="py-2 px-4 text-right tabular-nums text-body">
                          {p.capital_contribution ? formatCurrency(Number(p.capital_contribution)) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* INDIVIDUAL_ONLY / INDIVIDUAL_BUSINESS: Relief Items */}
          {(flowType === 'INDIVIDUAL_ONLY' || flowType === 'INDIVIDUAL_BUSINESS') && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Personal Tax Relief Items</CardTitle>
                  <Link href={`/tax-prep/${entity.id}`} className="text-label text-ink-secondary hover:text-ink-primary">
                    Manage →
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                {reliefItems.length === 0 ? (
                  <p className="text-label text-ink-muted">No relief items recorded yet.</p>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th className="py-2 px-0">Relief Category</th>
                        <th className="py-2 px-4">YA</th>
                        <th className="py-2 px-4 text-right">Claimed</th>
                        <th className="py-2 px-4 text-right">Max</th>
                        <th className="py-2 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reliefItems.map(r => (
                        <tr key={r.id}>
                          <td className="py-2 px-0 font-medium text-ink-primary">{r.relief_category}</td>
                          <td className="py-2 px-4 font-mono text-label text-ink-secondary">{r.assessment_year}</td>
                          <td className="py-2 px-4 text-right tabular-nums">{formatCurrency(Number(r.claimed_amount))}</td>
                          <td className="py-2 px-4 text-right tabular-nums text-ink-muted">
                            {r.max_allowed ? formatCurrency(Number(r.max_allowed)) : '—'}
                          </td>
                          <td className="py-2 px-4">
                            <Badge variant={r.status === 'CONFIRMED' ? 'success' : r.status === 'SUBMITTED' ? 'info' : 'neutral'}>
                              {r.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </CardContent>
            </Card>
          )}

          {/* Fixed Assets (INDIVIDUAL_BUSINESS / COMPANY / PARTNERSHIP) */}
          {fixedAssets.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Fixed Assets (Active)</CardTitle>
                  <Link href={`/entities/${entity.id}/fixed-assets`} className="text-label text-ink-secondary hover:text-ink-primary">
                    View all →
                  </Link>
                </div>
              </CardHeader>
              <CardContent>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="py-2 px-0">Asset</th>
                      <th className="py-2 px-4">Category</th>
                      <th className="py-2 px-4 text-right">Cost</th>
                      <th className="py-2 px-4 text-right">NBV</th>
                      <th className="py-2 px-4 text-right">CA Annual</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fixedAssets.map(fa => (
                      <tr key={fa.id}>
                        <td className="py-2 px-0">
                          <p className="text-body text-ink-primary font-medium">{fa.asset_name}</p>
                          {fa.asset_code && <p className="text-label font-mono text-ink-muted">{fa.asset_code}</p>}
                        </td>
                        <td className="py-2 px-4">
                          <span className="text-label text-ink-secondary">{fa.asset_category.replace(/_/g, ' ')}</span>
                        </td>
                        <td className="py-2 px-4 text-right tabular-nums">{formatCurrency(Number(fa.cost))}</td>
                        <td className="py-2 px-4 text-right tabular-nums">
                          {fa.net_book_value ? formatCurrency(Number(fa.net_book_value)) : '—'}
                        </td>
                        <td className="py-2 px-4 text-right tabular-nums">
                          {fa.ca_annual_allowance ? formatCurrency(Number(fa.ca_annual_allowance)) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          <Card size="sm">
            <h3 className="text-card-title text-ink-primary mb-3">Quick Actions</h3>
            <div className="grid grid-cols-2 gap-2">
              <Link href={`/transactions?entity_id=${entity.id}&unclassified_only=true`} className="btn-secondary justify-center py-2">
                Classify Transactions
              </Link>
              <Link href={`/imports/new`} className="btn-secondary justify-center py-2">
                Import Statement
              </Link>
              <Link href={`/monthly-close?entity_id=${entity.id}`} className="btn-secondary justify-center py-2">
                Monthly Close
              </Link>
              <Link href={`/tax-prep/${entity.id}`} className="btn-secondary justify-center py-2">
                Tax Prep
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
