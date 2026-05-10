import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Plus, Upload } from 'lucide-react'

function importStatusVariant(status: string): 'success' | 'warning' | 'error' | 'info' | 'neutral' {
  const map: Record<string, 'success' | 'warning' | 'error' | 'info' | 'neutral'> = {
    COMPLETED:  'success',
    PROCESSING: 'info',
    PARTIAL:    'warning',
    FAILED:     'error',
    PENDING:    'neutral',
    ARCHIVED:   'neutral',
  }
  return map[status] ?? 'neutral'
}

export default async function ImportsPage() {
  const batches = await prisma.importBatch.findMany({
    where: { archived_at: null },
    include: {
      entity:       { select: { entity_name: true, flow_type: true } },
      bank_account: { select: { bank_name: true, account_no: true } },
      _count:       { select: { transactions: true } },
    },
    orderBy: { imported_at: 'desc' },
    take: 100,
  })

  const stats = {
    total:      batches.length,
    completed:  batches.filter(b => b.import_status === 'COMPLETED').length,
    processing: batches.filter(b => b.import_status === 'PROCESSING').length,
    pending:    batches.filter(b => b.import_status === 'PENDING').length,
    failed:     batches.filter(b => b.import_status === 'FAILED').length,
  }

  return (
    <div>
      {/* Page Header */}
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="page-title">Imports</h1>
          <p className="page-subtitle">Bank statement import batches</p>
        </div>
        <Link href="/imports/new" className="btn-primary">
          <Upload size={16} />
          New Import
        </Link>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4 mb-8 lg:grid-cols-5">
        {[
          { label: 'Total',      value: stats.total,      variant: 'neutral'  },
          { label: 'Completed',  value: stats.completed,  variant: 'success'  },
          { label: 'Processing', value: stats.processing, variant: 'info'     },
          { label: 'Pending',    value: stats.pending,    variant: 'neutral'  },
          { label: 'Failed',     value: stats.failed,     variant: 'error'    },
        ].map(s => (
          <Card key={s.label} size="sm">
            <p className="text-label text-ink-muted uppercase tracking-wide mb-1">{s.label}</p>
            <p className="text-section text-ink-primary font-bold">{s.value}</p>
          </Card>
        ))}
      </div>

      {/* Import Batches Table */}
      <Card className="p-0 overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th className="py-3 px-6">Entity</th>
              <th className="py-3 px-4">Bank Account</th>
              <th className="py-3 px-4">Month</th>
              <th className="py-3 px-4">Source</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Txns</th>
              <th className="py-3 px-4 text-right">Unparsed</th>
              <th className="py-3 px-4">Imported</th>
              <th className="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {batches.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-16 text-ink-muted">
                  No import batches yet. Upload a bank statement to get started.
                </td>
              </tr>
            ) : (
              batches.map((batch) => (
                <tr key={batch.id}>
                  <td className="py-3 px-6">
                    <div>
                      <p className="font-medium text-ink-primary">{batch.entity?.entity_name}</p>
                      <p className="text-label text-ink-muted">{batch.entity?.flow_type?.replace('_', ' ')}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div>
                      <p className="text-body text-ink-primary">{batch.bank_account?.bank_name}</p>
                      <p className="text-label font-mono text-ink-muted">{batch.bank_account?.account_no}</p>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-mono text-body text-ink-primary">{batch.statement_month}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-label text-ink-secondary">
                      {batch.source_type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={importStatusVariant(batch.import_status)}>
                      {batch.import_status}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="tabular-nums text-body text-ink-primary">
                      {batch._count.transactions}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    {batch.unparsed_count && batch.unparsed_count > 0 ? (
                      <span className="tabular-nums text-label text-status-warning font-medium">
                        {batch.unparsed_count}
                      </span>
                    ) : (
                      <span className="text-label text-ink-muted">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-label text-ink-muted">
                      {new Date(batch.imported_at).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <Link href={`/imports/${batch.id}`} className="text-label text-ink-secondary hover:text-ink-primary">
                      View →
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
