export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Activity } from 'lucide-react'

const ACTION_VARIANT: Record<string, 'success' | 'error' | 'warning' | 'info' | 'neutral'> = {
  CREATE:         'success',
  UPDATE:         'info',
  ARCHIVE:        'warning',
  RESTORE:        'success',
  EXPORT:         'neutral',
  IMPORT:         'info',
  REVIEW_APPROVE: 'success',
  REVIEW_FLAG:    'warning',
  CLOSE:          'neutral',
  REOPEN:         'warning',
}

const TABLE_LABELS: Record<string, string> = {
  clients:         'Client',
  entities:        'Entity',
  bank_accounts:   'Bank Account',
  import_batches:  'Import Batch',
  transactions:    'Transaction',
  documents:       'Document',
  monthly_closes:  'Monthly Close',
  auditor_packages:'Auditor Package',
}

function timeAgo(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diff = Math.floor((now.getTime() - d.getTime()) / 1000)
  if (diff < 60)    return `${diff}s ago`
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return d.toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export default async function ActivityLogPage() {
  const logs = await prisma.auditLog.findMany({
    include: {
      actor: { select: { id: true, name: true, email: true } },
    },
    orderBy: { created_at: 'desc' },
    take: 200,
  })

  const totalToday = logs.filter(l => {
    const d = new Date(l.created_at)
    const now = new Date()
    return d.toDateString() === now.toDateString()
  }).length

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Activity Log</h1>
        <p className="page-subtitle">
          {logs.length.toLocaleString()} total entries · {totalToday} today
        </p>
      </div>

      <Card className="p-0 overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th className="py-3 px-6">Time</th>
              <th className="py-3 px-4">Actor</th>
              <th className="py-3 px-4">Action</th>
              <th className="py-3 px-4">Table</th>
              <th className="py-3 px-4">Record ID</th>
              <th className="py-3 px-4">Changes</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-16">
                  <Activity size={32} className="text-ink-muted mx-auto mb-3" />
                  <p className="text-body text-ink-muted">No audit logs yet.</p>
                  <p className="text-label text-ink-muted mt-1">Actions performed in the system will appear here.</p>
                </td>
              </tr>
            ) : (
              logs.map((log) => {
                // Compute what changed
                const before = log.before_json as Record<string, unknown> | null
                const after  = log.after_json as Record<string, unknown> | null
                let changedFields: string[] = []
                if (before && after && typeof before === 'object' && typeof after === 'object') {
                  changedFields = Object.keys(after).filter(
                    k => JSON.stringify(before[k]) !== JSON.stringify(after[k]) &&
                         k !== 'updated_at'
                  )
                }

                return (
                  <tr key={log.id}>
                    <td className="py-3 px-6 whitespace-nowrap">
                      <span className="text-label font-mono text-ink-muted">{timeAgo(log.created_at)}</span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-label text-ink-secondary">
                        {log.actor?.name ?? log.actor?.email ?? log.actor_id}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant={ACTION_VARIANT[log.action] ?? 'neutral'}>
                        {log.action}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <span className="text-label text-ink-secondary">
                        {TABLE_LABELS[log.table_name] ?? log.table_name}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span className="font-mono text-label text-ink-muted truncate max-w-32 block">
                        {log.record_id}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      {changedFields.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {changedFields.slice(0, 4).map(f => (
                            <span key={f} className="badge-neutral font-mono text-xs">{f}</span>
                          ))}
                          {changedFields.length > 4 && (
                            <span className="text-label text-ink-muted">+{changedFields.length - 4} more</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-label text-ink-muted">—</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </Card>
    </div>
  )
}
