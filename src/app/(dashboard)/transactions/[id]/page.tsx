import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'
import { TransactionClassifyPanel } from '@/components/transactions/TransactionClassifyPanel'

export default async function TransactionDetailPage({ params }: { params: { id: string } }) {
  const txn = await prisma.transaction.findFirst({
    where: { id: params.id, archived_at: null },
    include: {
      entity:              { select: { id: true, entity_name: true, flow_type: true, client: { select: { legal_name: true } } } },
      bank_account:        { select: { bank_name: true, account_name: true, account_no: true } },
      import_batch:        { select: { id: true, statement_month: true, source_file_name: true } },
      accounting_category: true,
      tax_category:        true,
      counterparty:        true,
    },
  })

  if (!txn) notFound()

  // Fetch classification options
  const [accountingCategories, taxCategories, counterparties] = await Promise.all([
    prisma.accountingCategory.findMany({
      where:   { is_active: true },
      orderBy: [{ report_group: 'asc' }, { sort_order: 'asc' }],
    }),
    prisma.taxCategory.findMany({
      where:   { is_active: true },
      orderBy: { code: 'asc' },
    }),
    prisma.counterparty.findMany({
      where:   { is_active: true, client_id: txn.entity?.client_id ?? '' },
      orderBy: { name: 'asc' },
    }),
  ])

  const isDebit  = txn.direction === 'DEBIT'
  const flowType = txn.entity?.flow_type ?? 'COMPANY'

  return (
    <div>
      {/* Back Nav */}
      <div className="mb-6">
        <Link
          href={txn.import_batch ? `/imports/${txn.import_batch.id}` : '/transactions'}
          className="btn-ghost text-ink-muted"
        >
          <ArrowLeft size={16} />
          {txn.import_batch ? `Back to ${txn.import_batch.statement_month} batch` : 'Back to Transactions'}
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Left: Transaction Info (2/5) */}
        <div className="lg:col-span-2 space-y-4">
          {/* Main Info Card */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-label text-ink-muted mb-1">
                    {txn.entity?.entity_name} · {txn.entity?.client?.legal_name}
                  </p>
                  <div className={`text-page-title font-bold tabular-nums ${isDebit ? 'text-status-error' : 'text-status-success'}`}>
                    {isDebit ? '−' : '+'}{formatCurrency(Number(txn.amount))}
                  </div>
                  <p className="text-label text-ink-muted mt-1">
                    {isDebit ? 'Debit' : 'Credit'} on {formatDate(txn.txn_date, 'long')}
                  </p>
                </div>
                <Badge variant={txn.review_status === 'APPROVED' ? 'success' : txn.review_status === 'FLAGGED' ? 'error' : 'neutral'}>
                  {txn.review_status.replace('_', ' ')}
                </Badge>
              </div>
            </CardHeader>

            <div className="divider" />

            <CardContent>
              <div className="space-y-4">
                <div>
                  <p className="text-label text-ink-muted mb-1">Description</p>
                  <p className="text-body text-ink-primary leading-relaxed">{txn.description}</p>
                </div>

                {txn.raw_text && txn.raw_text !== txn.description && (
                  <div>
                    <p className="text-label text-ink-muted mb-1">Raw Text</p>
                    <p className="text-label font-mono text-ink-secondary bg-panel p-2 rounded-badge leading-relaxed">
                      {txn.raw_text}
                    </p>
                  </div>
                )}

                {txn.reference_no && (
                  <div>
                    <p className="text-label text-ink-muted mb-1">Reference</p>
                    <p className="text-body font-mono text-ink-secondary">{txn.reference_no}</p>
                  </div>
                )}

                {txn.balance_after != null && (
                  <div>
                    <p className="text-label text-ink-muted mb-1">Balance After</p>
                    <p className="text-body tabular-nums text-ink-secondary">{formatCurrency(Number(txn.balance_after))}</p>
                  </div>
                )}

                {txn.management_note && (
                  <div>
                    <p className="text-label text-ink-muted mb-1">Management Note</p>
                    <p className="text-body text-ink-secondary italic">{txn.management_note}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Source Info */}
          <Card size="sm">
            <h3 className="text-card-title text-ink-primary mb-3">Source</h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-label text-ink-muted">Bank Account</span>
                <span className="text-label text-ink-secondary">
                  {txn.bank_account?.bank_name} · {txn.bank_account?.account_no}
                </span>
              </div>
              {txn.import_batch && (
                <div className="flex justify-between">
                  <span className="text-label text-ink-muted">Import Batch</span>
                  <Link href={`/imports/${txn.import_batch.id}`} className="text-label text-ink-secondary hover:text-ink-primary">
                    {txn.import_batch.statement_month} ↗
                  </Link>
                </div>
              )}
              {txn.is_manual && (
                <div className="flex justify-between">
                  <span className="text-label text-ink-muted">Entry Type</span>
                  <Badge variant="info">Manual</Badge>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-label text-ink-muted">Created</span>
                <span className="text-label text-ink-secondary">{formatDate(txn.created_at, 'medium')}</span>
              </div>
            </div>
          </Card>

          {/* Risk Flag */}
          {txn.risk_flag && (
            <Card size="sm" className="border-status-warning bg-amber-50">
              <h3 className="text-card-title text-status-warning mb-2">⚠ Risk Flag</h3>
              <p className="text-body text-ink-secondary">{txn.risk_flag.replace(/_/g, ' ')}</p>
              <p className="text-label text-ink-muted mt-1">
                {txn.risk_flag === 'HIGH_VALUE' && 'Transaction amount is RM10,000 or above. Requires review and documentation.'}
                {txn.risk_flag === 'DIRECTOR_RELATED' && 'Transaction appears to involve a director. Verify purpose and proper authorization.'}
                {txn.risk_flag === 'RELATED_PARTY' && 'Possible related party transaction. Ensure arm\'s length terms and proper disclosure.'}
                {txn.risk_flag === 'ROUND_NUMBER' && 'Round number amount may indicate estimated or non-specific transactions.'}
                {txn.risk_flag === 'TAX_SENSITIVE' && 'This transaction may have tax implications. Verify deductibility.'}
                {txn.risk_flag === 'DUPLICATE_SUSPECT' && 'This transaction may be a duplicate. Check against similar entries.'}
              </p>
            </Card>
          )}
        </div>

        {/* Right: Classification Panel (3/5) */}
        <div className="lg:col-span-3">
          <TransactionClassifyPanel
            txn={{
              id:                     txn.id,
              accounting_category_id: txn.accounting_category_id,
              accounting_category:    txn.accounting_category,
              tax_category_id:        txn.tax_category_id,
              tax_category:           txn.tax_category,
              counterparty_id:        txn.counterparty_id,
              counterparty:           txn.counterparty,
              document_status:        txn.document_status,
              review_status:          txn.review_status,
              risk_flag:              txn.risk_flag,
              management_note:        txn.management_note,
              direction:              txn.direction,
              amount:                 Number(txn.amount),
              flow_type:              flowType,
            }}
            accountingCategories={accountingCategories}
            taxCategories={taxCategories}
            counterparties={counterparties}
          />
        </div>
      </div>
    </div>
  )
}
