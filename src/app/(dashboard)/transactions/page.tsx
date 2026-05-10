export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'
import { Filter, Download, Plus } from 'lucide-react'

function reviewStatusVariant(status: string): 'success' | 'warning' | 'error' | 'info' | 'neutral' {
  const map: Record<string, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
    APPROVED:    'success',
    REVIEWED:    'info',
    IN_REVIEW:   'info',
    FLAGGED:     'error',
    UNREVIEWED:  'neutral',
  }
  return map[status] ?? 'neutral'
}

function docStatusVariant(status: string): 'success' | 'warning' | 'error' | 'neutral' {
  const map: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {
    VERIFIED:         'success',
    UPLOADED:         'info' as 'neutral',
    REQUIRED_MISSING: 'warning',
    NOT_REQUIRED:     'neutral',
  }
  return map[status] ?? 'neutral'
}

function riskVariant(flag: string | null): 'error' | 'warning' | 'neutral' {
  if (!flag) return 'neutral'
  const high = ['HIGH_VALUE', 'DIRECTOR_RELATED', 'RELATED_PARTY']
  if (high.includes(flag)) return 'error'
  return 'warning'
}

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined }
}) {
  const entity_id         = searchParams.entity_id
  const review_status     = searchParams.review_status
  const document_status   = searchParams.document_status
  const risk_flag         = searchParams.risk_flag
  const direction         = searchParams.direction
  const unclassified_only = searchParams.unclassified_only === 'true'
  const month             = searchParams.month
  const page              = parseInt(searchParams.page ?? '1', 10)
  const pageSize          = 100

  const where: Record<string, unknown> = { archived_at: null }
  if (entity_id)         where.entity_id = entity_id
  if (review_status)     where.review_status = review_status
  if (document_status)   where.document_status = document_status
  if (risk_flag)         where.risk_flag = risk_flag
  if (direction)         where.direction = direction
  if (unclassified_only) where.accounting_category_id = null

  if (month) {
    const [year, mo] = month.split('-').map(Number)
    where.txn_date = { gte: new Date(year, mo - 1, 1), lt: new Date(year, mo, 1) }
  }

  const [transactions, total, summaryStats] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        entity:              { select: { entity_name: true } },
        accounting_category: { select: { code: true, name: true, report_group: true } },
        tax_category:        { select: { code: true, deductible_type: true } },
        counterparty:        { select: { name: true, type: true } },
      },
      orderBy: [{ txn_date: 'desc' }],
      skip:    (page - 1) * pageSize,
      take:    pageSize,
    }),
    prisma.transaction.count({ where }),
    // Summary stats (full dataset, ignore pagination)
    prisma.transaction.aggregate({
      where: { ...where },
      _count: { id: true },
      _sum:   { amount: true },
    }),
  ])

  const unclassifiedCount = await prisma.transaction.count({
    where: { ...where, accounting_category_id: null },
  })
  const flaggedCount = await prisma.transaction.count({
    where: { ...where, risk_flag: { not: null } },
  })
  const missingDocsCount = await prisma.transaction.count({
    where: { ...where, document_status: 'REQUIRED_MISSING' },
  })

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div>
      {/* Page Header */}
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="page-title">Transactions</h1>
          <p className="page-subtitle">{total.toLocaleString()} transactions</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="btn-secondary">
            <Download size={16} />
            Export
          </button>
          <Link href="/transactions/new" className="btn-primary">
            <Plus size={16} />
            Manual Entry
          </Link>
        </div>
      </div>

      {/* Alert Stats */}
      {(unclassifiedCount > 0 || flaggedCount > 0 || missingDocsCount > 0) && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {unclassifiedCount > 0 && (
            <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-100 rounded-card">
              <div className="w-2 h-2 rounded-full bg-status-warning flex-shrink-0" />
              <div>
                <p className="text-label font-medium text-status-warning">{unclassifiedCount} Unclassified</p>
                <p className="text-label text-ink-muted">Need accounting category</p>
              </div>
            </div>
          )}
          {flaggedCount > 0 && (
            <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-100 rounded-card">
              <div className="w-2 h-2 rounded-full bg-status-error flex-shrink-0" />
              <div>
                <p className="text-label font-medium text-status-error">{flaggedCount} Risk Flagged</p>
                <p className="text-label text-ink-muted">Require review</p>
              </div>
            </div>
          )}
          {missingDocsCount > 0 && (
            <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-100 rounded-card">
              <div className="w-2 h-2 rounded-full bg-status-warning flex-shrink-0" />
              <div>
                <p className="text-label font-medium text-status-warning">{missingDocsCount} Missing Docs</p>
                <p className="text-label text-ink-muted">Supporting documents needed</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filter Bar */}
      <form method="GET" className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex items-center gap-2 text-label text-ink-muted">
          <Filter size={14} />
          <span>Filters:</span>
        </div>

        <select name="direction" defaultValue={direction ?? ''} className="form-input w-28 py-1.5 text-label">
          <option value="">Direction</option>
          <option value="CREDIT">Credit</option>
          <option value="DEBIT">Debit</option>
        </select>

        <select name="review_status" defaultValue={review_status ?? ''} className="form-input w-36 py-1.5 text-label">
          <option value="">Review Status</option>
          <option value="UNREVIEWED">Unreviewed</option>
          <option value="IN_REVIEW">In Review</option>
          <option value="REVIEWED">Reviewed</option>
          <option value="FLAGGED">Flagged</option>
          <option value="APPROVED">Approved</option>
        </select>

        <select name="document_status" defaultValue={document_status ?? ''} className="form-input w-40 py-1.5 text-label">
          <option value="">Doc Status</option>
          <option value="NOT_REQUIRED">Not Required</option>
          <option value="REQUIRED_MISSING">Missing</option>
          <option value="UPLOADED">Uploaded</option>
          <option value="VERIFIED">Verified</option>
        </select>

        <select name="risk_flag" defaultValue={risk_flag ?? ''} className="form-input w-40 py-1.5 text-label">
          <option value="">Risk Flag</option>
          <option value="HIGH_VALUE">High Value</option>
          <option value="DIRECTOR_RELATED">Director Related</option>
          <option value="RELATED_PARTY">Related Party</option>
          <option value="ROUND_NUMBER">Round Number</option>
          <option value="TAX_SENSITIVE">Tax Sensitive</option>
          <option value="MISSING_DOCS">Missing Docs</option>
          <option value="DUPLICATE_SUSPECT">Duplicate</option>
        </select>

        <input
          name="month"
          type="month"
          defaultValue={month ?? ''}
          className="form-input w-36 py-1.5 text-label"
          placeholder="Filter by month"
        />

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="unclassified_only"
            name="unclassified_only"
            value="true"
            defaultChecked={unclassified_only}
            className="w-4 h-4"
          />
          <label htmlFor="unclassified_only" className="text-label text-ink-secondary cursor-pointer">
            Unclassified only
          </label>
        </div>

        <button type="submit" className="btn-secondary py-1.5">
          Apply
        </button>
        <Link href="/transactions" className="btn-ghost py-1.5 text-label text-ink-muted">
          Clear
        </Link>
      </form>

      {/* Transactions Table */}
      <Card className="p-0 overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th className="py-3 px-6">Date</th>
              <th className="py-3 px-4">Entity</th>
              <th className="py-3 px-4">Description</th>
              <th className="py-3 px-4">Counterparty</th>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4">Tax</th>
              <th className="py-3 px-4">Flag</th>
              <th className="py-3 px-4 text-right">Debit</th>
              <th className="py-3 px-4 text-right">Credit</th>
              <th className="py-3 px-4">Review</th>
              <th className="py-3 px-4">Doc</th>
              <th className="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 ? (
              <tr>
                <td colSpan={12} className="text-center py-16 text-ink-muted">
                  No transactions match your filters.
                </td>
              </tr>
            ) : (
              transactions.map((txn) => (
                <tr key={txn.id}>
                  <td className="py-3 px-6 whitespace-nowrap">
                    <span className="font-mono text-label text-ink-secondary">
                      {new Date(txn.txn_date).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-label text-ink-secondary">{txn.entity?.entity_name}</span>
                  </td>
                  <td className="py-3 px-4 max-w-xs">
                    <p className="text-body text-ink-primary leading-snug line-clamp-2">{txn.description}</p>
                    {txn.reference_no && (
                      <p className="text-label font-mono text-ink-muted">{txn.reference_no}</p>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {txn.counterparty ? (
                      <div>
                        <p className="text-label text-ink-secondary">{txn.counterparty.name}</p>
                        <p className="text-label text-ink-muted">{txn.counterparty.type}</p>
                      </div>
                    ) : (
                      <span className="text-label text-ink-muted">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {txn.accounting_category ? (
                      <div>
                        <span className="text-label font-mono text-ink-secondary">{txn.accounting_category.code}</span>
                        <p className="text-label text-ink-muted leading-tight">{txn.accounting_category.name}</p>
                      </div>
                    ) : (
                      <span className="text-label text-status-warning font-medium">Unclassified</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {txn.tax_category ? (
                      <span className="text-label font-mono text-ink-secondary">{txn.tax_category.code}</span>
                    ) : (
                      <span className="text-label text-ink-muted">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {txn.risk_flag ? (
                      <Badge variant={riskVariant(txn.risk_flag)}>
                        {txn.risk_flag.replace(/_/g, ' ')}
                      </Badge>
                    ) : (
                      <span className="text-label text-ink-muted">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {txn.direction === 'DEBIT' ? (
                      <span className="tabular-nums text-body text-status-error font-medium">
                        {formatCurrency(Number(txn.amount))}
                      </span>
                    ) : <span className="text-ink-muted">—</span>}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {txn.direction === 'CREDIT' ? (
                      <span className="tabular-nums text-body text-status-success font-medium">
                        {formatCurrency(Number(txn.amount))}
                      </span>
                    ) : <span className="text-ink-muted">—</span>}
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={reviewStatusVariant(txn.review_status)}>
                      {txn.review_status.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    {txn.document_status !== 'NOT_REQUIRED' ? (
                      <Badge variant={docStatusVariant(txn.document_status)}>
                        {txn.document_status.replace('_', ' ')}
                      </Badge>
                    ) : (
                      <span className="text-label text-ink-muted">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <Link href={`/transactions/${txn.id}`} className="text-label text-ink-secondary hover:text-ink-primary whitespace-nowrap">
                      Classify →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-divider flex items-center justify-between">
            <p className="text-label text-ink-muted">
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total.toLocaleString()}
            </p>
            <div className="flex items-center gap-2">
              {page > 1 && (
                <Link href={`?page=${page - 1}`} className="btn-secondary py-1.5 text-label">
                  ← Prev
                </Link>
              )}
              <span className="text-label text-ink-secondary px-3">Page {page} of {totalPages}</span>
              {page < totalPages && (
                <Link href={`?page=${page + 1}`} className="btn-secondary py-1.5 text-label">
                  Next →
                </Link>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
