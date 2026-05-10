export const dynamic = 'force-dynamic'

import { prisma } from '@/lib/prisma'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { FLOW_TYPE_LABELS } from '@/lib/utils'
import Link from 'next/link'

export default async function DashboardPage() {
  const [
    totalClients,
    activeEntities,
    recentClients,
  ] = await Promise.all([
    prisma.client.count({ where: { archived_at: null } }),
    prisma.entity.count({ where: { archived_at: null, is_active: true } }),
    prisma.client.findMany({
      where: { archived_at: null },
      orderBy: { created_at: 'desc' },
      take: 5,
      include: { entities: { where: { archived_at: null }, take: 1 } },
    }),
  ])

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Accountant Work Replacement System</p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-6 mb-8 lg:grid-cols-4">
        <Card>
          <p className="text-label text-ink-muted uppercase tracking-wide mb-2">Total Clients</p>
          <p className="text-page-title text-ink-primary">{totalClients}</p>
        </Card>
        <Card>
          <p className="text-label text-ink-muted uppercase tracking-wide mb-2">Active Entities</p>
          <p className="text-page-title text-ink-primary">{activeEntities}</p>
        </Card>
        <Card>
          <p className="text-label text-ink-muted uppercase tracking-wide mb-2">Pending Review</p>
          <p className="text-page-title text-ink-primary">—</p>
        </Card>
        <Card>
          <p className="text-label text-ink-muted uppercase tracking-wide mb-2">Unresolved Issues</p>
          <p className="text-page-title text-ink-primary">—</p>
        </Card>
      </div>

      {/* Recent Clients */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Recent Clients</CardTitle>
            <Link href="/clients" className="text-label text-ink-secondary hover:text-ink-primary">
              View all →
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentClients.length === 0 ? (
            <p className="text-ink-muted py-4">No clients yet.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th className="py-3 px-0">Client</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Entities</th>
                </tr>
              </thead>
              <tbody>
                {recentClients.map((client) => (
                  <tr key={client.id}>
                    <td className="py-3 px-0">
                      <Link href={`/clients/${client.id}`} className="hover:underline">
                        <span className="font-medium text-ink-primary">{client.legal_name}</span>
                        <span className="ml-2 font-mono text-label text-ink-muted">{client.client_code}</span>
                      </Link>
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="neutral">{FLOW_TYPE_LABELS[client.primary_flow_type]}</Badge>
                    </td>
                    <td className="py-3 px-4 text-ink-secondary">
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
  )
}
