import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Upload, Search } from 'lucide-react'

const SCOPE_LABELS: Record<string, string> = {
  TRANSACTION_LEVEL: 'Transaction',
  ENTITY_LEVEL:      'Entity',
  PERIOD_LEVEL:      'Period',
}

const DOC_TYPE_LABELS: Record<string, string> = {
  INVOICE_ISSUED:           'Invoice Issued',
  INVOICE_RECEIVED:         'Invoice Received',
  RECEIPT:                  'Receipt',
  BANK_STATEMENT:           'Bank Statement',
  CONTRACT:                 'Contract',
  PAYROLL_RECORD:           'Payroll Record',
  SSM_CERTIFICATE:          'SSM Certificate',
  TAX_CLEARANCE:            'Tax Clearance',
  AUDIT_REPORT:             'Audit Report',
  FIXED_ASSET_PURCHASE:     'Fixed Asset Purchase',
  RELIEF_DOCUMENT:          'Relief Document',
  EA_FORM:                  'EA Form',
  DIVIDEND_VOUCHER:         'Dividend Voucher',
  PROFIT_SHARING_AGREEMENT: 'Profit Sharing Agreement',
  DIRECTOR_RESOLUTION:      'Director Resolution',
  OTHER:                    'Other',
}

function ocrVariant(status: string): 'success' | 'warning' | 'error' | 'info' | 'neutral' {
  const map: Record<string, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
    COMPLETED:     'success',
    PROCESSING:    'info',
    PENDING:       'neutral',
    FAILED:        'error',
    NOT_APPLICABLE:'neutral',
  }
  return map[status] ?? 'neutral'
}

function verifyVariant(status: string): 'success' | 'warning' | 'error' | 'neutral' {
  const map: Record<string, 'success' | 'warning' | 'error' | 'neutral'> = {
    VERIFIED:   'success',
    QUERIED:    'warning',
    REJECTED:   'error',
    UNVERIFIED: 'neutral',
  }
  return map[status] ?? 'neutral'
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | undefined }
}) {
  const entity_id      = searchParams.entity_id
  const document_scope = searchParams.document_scope
  const document_type  = searchParams.document_type
  const verification   = searchParams.verification_status
  const period         = searchParams.period
  const page           = parseInt(searchParams.page ?? '1', 10)
  const pageSize       = 50

  const where: Record<string, unknown> = { archived_at: null }
  if (entity_id)      where.entity_id = entity_id
  if (document_scope) where.document_scope = document_scope
  if (document_type)  where.document_type = document_type
  if (verification)   where.verification_status = verification
  if (period)         where.period = period

  const [documents, total] = await Promise.all([
    prisma.supportingDocument.findMany({
      where,
      include: {
        entity:      { select: { entity_name: true, flow_type: true } },
        transaction: { select: { id: true, txn_date: true, description: true, amount: true, direction: true } },
      },
      orderBy: { uploaded_at: 'desc' },
      skip:    (page - 1) * pageSize,
      take:    pageSize,
    }),
    prisma.supportingDocument.count({ where }),
  ])

  const stats = {
    total:      total,
    unverified: await prisma.supportingDocument.count({ where: { ...where, verification_status: 'UNVERIFIED' } }),
    queried:    await prisma.supportingDocument.count({ where: { ...where, verification_status: 'QUERIED' } }),
    ocr_pending: await prisma.supportingDocument.count({ where: { ...where, ocr_status: 'PENDING' } }),
  }

  const totalPages = Math.ceil(total / pageSize)

  return (
    <div>
      {/* Page Header */}
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="page-title">Documents</h1>
          <p className="page-subtitle">{total} supporting documents</p>
        </div>
        <button className="btn-primary">
          <Upload size={16} />
          Upload Document
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4 mb-6 lg:grid-cols-4">
        <Card size="sm">
          <p className="text-label text-ink-muted uppercase tracking-wide mb-1">Total</p>
          <p className="text-section font-bold text-ink-primary">{stats.total}</p>
        </Card>
        <Card size="sm">
          <p className="text-label text-ink-muted uppercase tracking-wide mb-1">Unverified</p>
          <p className={`text-section font-bold ${stats.unverified > 0 ? 'text-status-warning' : 'text-ink-muted'}`}>
            {stats.unverified}
          </p>
        </Card>
        <Card size="sm">
          <p className="text-label text-ink-muted uppercase tracking-wide mb-1">Queried</p>
          <p className={`text-section font-bold ${stats.queried > 0 ? 'text-status-error' : 'text-ink-muted'}`}>
            {stats.queried}
          </p>
        </Card>
        <Card size="sm">
          <p className="text-label text-ink-muted uppercase tracking-wide mb-1">OCR Pending</p>
          <p className={`text-section font-bold ${stats.ocr_pending > 0 ? 'text-status-warning' : 'text-ink-muted'}`}>
            {stats.ocr_pending}
          </p>
        </Card>
      </div>

      {/* Filter Bar */}
      <form method="GET" className="flex flex-wrap items-center gap-3 mb-6">
        <select name="document_scope" defaultValue={document_scope ?? ''} className="form-input w-36 py-1.5 text-label">
          <option value="">All Scopes</option>
          <option value="TRANSACTION_LEVEL">Transaction</option>
          <option value="ENTITY_LEVEL">Entity</option>
          <option value="PERIOD_LEVEL">Period</option>
        </select>

        <select name="verification_status" defaultValue={verification ?? ''} className="form-input w-36 py-1.5 text-label">
          <option value="">Verification</option>
          <option value="UNVERIFIED">Unverified</option>
          <option value="VERIFIED">Verified</option>
          <option value="QUERIED">Queried</option>
          <option value="REJECTED">Rejected</option>
        </select>

        <input name="period" type="month" defaultValue={period ?? ''} className="form-input w-36 py-1.5 text-label" />

        <button type="submit" className="btn-secondary py-1.5">Apply</button>
        <Link href="/documents" className="btn-ghost py-1.5 text-label text-ink-muted">Clear</Link>
      </form>

      {/* Documents Table */}
      <Card className="p-0 overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th className="py-3 px-6">File</th>
              <th className="py-3 px-4">Entity</th>
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4">Scope</th>
              <th className="py-3 px-4">Period</th>
              <th className="py-3 px-4">Linked Transaction</th>
              <th className="py-3 px-4">OCR</th>
              <th className="py-3 px-4">Verified</th>
              <th className="py-3 px-4">Uploaded</th>
              <th className="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {documents.length === 0 ? (
              <tr>
                <td colSpan={10} className="text-center py-16 text-ink-muted">
                  No documents yet. Upload supporting documents to get started.
                </td>
              </tr>
            ) : (
              documents.map((doc) => (
                <tr key={doc.id}>
                  <td className="py-3 px-6 max-w-xs">
                    <p className="text-body text-ink-primary leading-snug truncate">{doc.file_name}</p>
                    {doc.file_size_bytes && (
                      <p className="text-label text-ink-muted">
                        {(doc.file_size_bytes / 1024).toFixed(0)} KB
                      </p>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-label text-ink-secondary">{doc.entity?.entity_name}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-label text-ink-secondary">
                      {DOC_TYPE_LABELS[doc.document_type] ?? doc.document_type}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant="neutral">
                      {SCOPE_LABELS[doc.document_scope]}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-label font-mono text-ink-secondary">{doc.period ?? '—'}</span>
                  </td>
                  <td className="py-3 px-4">
                    {doc.transaction ? (
                      <Link href={`/transactions/${doc.transaction.id}`} className="text-label text-ink-secondary hover:text-ink-primary">
                        {new Date(doc.transaction.txn_date).toLocaleDateString('en-MY', { day: '2-digit', month: 'short' })} ·&nbsp;
                        {doc.transaction.direction === 'DEBIT' ? '-' : '+'}
                        {Number(doc.transaction.amount).toLocaleString('en-MY', { minimumFractionDigits: 2 })} ↗
                      </Link>
                    ) : (
                      <span className="text-label text-ink-muted">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={ocrVariant(doc.ocr_status)}>
                      {doc.ocr_status.replace('_', ' ')}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={verifyVariant(doc.verification_status)}>
                      {doc.verification_status}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-label text-ink-muted">
                      {new Date(doc.uploaded_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <Link href={`/documents/${doc.id}`} className="text-label text-ink-secondary hover:text-ink-primary">
                      View →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-divider flex items-center justify-between">
            <p className="text-label text-ink-muted">
              Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
            </p>
            <div className="flex items-center gap-2">
              {page > 1 && <Link href={`?page=${page - 1}`} className="btn-secondary py-1.5 text-label">← Prev</Link>}
              <span className="text-label text-ink-secondary px-3">Page {page} of {totalPages}</span>
              {page < totalPages && <Link href={`?page=${page + 1}`} className="btn-secondary py-1.5 text-label">Next →</Link>}
            </div>
          </div>
        )}
      </Card>
    </div>
  )
}
