export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency } from '@/lib/utils'
import { ArrowLeft, Play, Archive } from 'lucide-react'

function importStatusVariant(status: string): 'success' | 'warning' | 'error' | 'info' | 'neutral' {
  const map: Record<string, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
    COMPLETED: 'success', PROCESSING: 'info', PARTIAL: 'warning',
    FAILED: 'error', PENDING: 'neutral', ARCHIVED: 'neutral',
  }
  return map[status] ?? 'neutral'
}

function riskVariant(flag: string | null): 'error' | 'warning' | 'neutral' | undefined {
  if (!flag) return undefined
  const high = ['HIGH_VALUE', 'DIRECTOR_RELATED', 'RELATED_PARTY']
  const mid  = ['ROUND_NUMBER', 'TAX_SENSITIVE', 'MISSING_DOCS', 'DUPLICATE_SUSPECT']
  if (high.includes(flag)) return 'error'
  if (mid.includes(flag))  return 'warning'
  return 'neutral'
}

export default async function ImportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: importId } = await params
  const batch = await prisma.importBatch.findFirst({
    where: { id: importId, archived_at: null },
    include: {
      entity:       { select: { id: true, entity_name: true, flow_type: true, client: { select: { legal_name: true } } } },
      bank_account: { select: { id: true, bank_name: true, account_name: true, account_no: true, currency: true } },
      transactions: {
        where:   { archived_at: null },
        orderBy: { txn_date: 'desc' },
        include: {
          accounting_category: { select: { code: true, name: true } },
          tax_category:        { select: { code: true } },
        },
      },
    },
  })

  if (!batch) notFound()

  const totalCredit  = batch.transactions.filter(t => t.direction === 'CREDIT').reduce((s, t) => s + Number(t.amount), 0)
  const totalDebit   = batch.transactions.filter(t => t.direction === 'DEBIT').reduce((s, t) => s + Number(t.amount), 0)
  const unclassified = batch.transactions.filter(t => !t.accounting_category_id).length
  const flagged      = batch.transactions.filter(t => t.risk_flag).length
  const missingDocs  = batch.transactions.filter(t => t.document_status === 'REQUIRED_MISSING').length

  return (
    <div>
      {/* Back Nav */}
      <div className="mb-6">
        <Link href="/imports" className="btn-ghost text-ink-muted">
          <ArrowLeft size={16} />
          Back to Imports
        </Link>
      </div>

      {/* Page Header */}
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="page-title">{batch.statement_month} — {batch.bank_account?.bank_name}</h1>
          <p className="page-subtitle">
            {batch.entity?.entity_name} · {batch.entity?.client?.legal_name} · {batch.source_file_name}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={importStatusVariant(batch.import_status)}>
            {batch.import_status}
          </Badge>
          {(batch.import_status === 'PENDING' || batch.import_status === 'FAILED') && (
            <button className="btn-primary">
              <Play size={14} />
              Process Now
            </button>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4 mb-8 lg:grid-cols-5">
        <Card size="sm">
          <p className="text-label text-ink-muted uppercase tracking-wide mb-1">Total Transactions</p>
          <p className="text-section font-bold text-ink-primary">{batch.transactions.length}</p>
        </Card>
        <Card size="sm">
          <p className="text-label text-ink-muted uppercase tracking-wide mb-1">Total Credit</p>
          <p className="text-section font-bold text-status-success tabular-nums">
            {formatCurrency(totalCredit)}
          </p>
        </Card>
        <Card size="sm">
          <p className="text-label text-ink-muted uppercase tracking-wide mb-1">Total Debit</p>
          <p className="text-section font-bold text-status-error tabular-nums">
            {formatCurrency(totalDebit)}
          </p>
        </Card>
        <Card size="sm">
          <p className="text-label text-ink-muted uppercase tracking-wide mb-1">Unclassified</p>
          <p className={`text-section font-bold tabular-nums ${unclassified > 0 ? 'text-status-warning' : 'text-ink-muted'}`}>
            {unclassified}
          </p>
        </Card>
        <Card size="sm">
          <p className="text-label text-ink-muted uppercase tracking-wide mb-1">Flagged</p>
          <p className={`text-section font-bold tabular-nums ${flagged > 0 ? 'text-status-error' : 'text-ink-muted'}`}>
            {flagged}
          </p>
        </Card>
      </div>

      {/* Transactions Table */}
      <Card className="p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-divider flex items-center justify-between">
          <h2 className="text-card-title text-ink-primary">Transactions</h2>
          <div className="flex items-center gap-2">
            {missingDocs > 0 && (
              <Badge variant="warning">{missingDocs} missing docs</Badge>
            )}
            <span className="text-label text-ink-muted">{batch.transactions.length} rows</span>
          </div>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th className="py-3 px-6">Date</th>
              <th className="py-3 px-4">Description</th>
              <th className="py-3 px-4">Ref</th>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4">Flag</th>
              <th className="py-3 px-4 text-right">Debit</th>
              <th className="py-3 px-4 text-right">Credit</th>
              <th className="py-3 px-4 text-right">Balance</th>
              <th className="py-3 px-4">Doc</th>
              <th className="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {batch.transactions.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-16 text-ink-muted">
                  No transactions in this batch.
                  {batch.import_status === 'PENDING' && ' Click "Process Now" to parse the file.'}
                </td>
              </tr>
            ) : (
              batch.transactions.map((txn) => (
                <tr key={txn.id}>
                  <td className="py-3 px-6">
                    <span className="font-mono text-label text-ink-secondary">
                      {new Date(txn.txn_date).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </td>
                  <td className="py-3 px-4 max-w-xs">
                    <p className="text-body text-ink-primary leading-snug line-clamp-2">{txn.description}</p>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-label font-mono text-ink-muted">{txn.reference_no ?? '—'}</span>
                  </td>
                  <td className="py-3 px-4">
                    {txn.accounting_category ? (
                      <span className="text-label text-ink-secondary">
                        {txn.accounting_category.code} · {txn.accounting_category.name}
                      </span>
                    ) : (
                      <span className="text-label text-status-warning font-medium">Unclassified</span>
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
                  <td className="py-3 px-4 text-right">
                    {txn.balance_after != null ? (
                      <span className="tabular-nums text-label text-ink-secondary">
                        {formatCurrency(Number(txn.balance_after))}
                      </span>
                    ) : <span className="text-ink-muted">—</span>}
                  </td>
                  <td className="py-3 px-4">
                    {txn.document_status === 'REQUIRED_MISSING' ? (
                      <Badge variant="warning">Missing</Badge>
                    ) : txn.document_status === 'VERIFIED' ? (
                      <Badge variant="success">Verified</Badge>
                    ) : txn.document_status === 'UPLOADED' ? (
                      <Badge variant="info">Uploaded</Badge>
                    ) : (
                      <span className="text-label text-ink-muted">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <Link href={`/transactions/${txn.id}`} className="text-label text-ink-secondary hover:text-ink-primary">
                      →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {/* Batch Info Card */}
      <div className="mt-6">
        <Card size="sm">
          <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
            <div>
              <p className="text-label text-ink-muted mb-1">Source File</p>
              <p className="text-body text-ink-primary">{batch.source_file_name}</p>
            </div>
            <div>
              <p className="text-label text-ink-muted mb-1">Parser</p>
              <p className="text-body text-ink-primary">{batch.parser_name ?? '—'} {batch.parser_version ? `v${batch.parser_version}` : ''}</p>
            </div>
            <div>
              <p className="text-label text-ink-muted mb-1">Source Count</p>
              <p className="text-body text-ink-primary">{batch.source_transaction_count ?? '—'}</p>
            </div>
            <div>
              <p className="text-label text-ink-muted mb-1">Imported At</p>
              <p className="text-body text-ink-primary">
                {new Date(batch.imported_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>
          {batch.notes && (
            <div className="mt-4 pt-4 border-t border-divider">
              <p className="text-label text-ink-muted mb-1">Notes</p>
              <p className="text-body text-ink-secondary">{batch.notes}</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
