export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { FLOW_TYPE_LABELS, FLOW_TYPE_FORM } from '@/lib/utils'
import { Plus } from 'lucide-react'
import { ClientsTable } from '@/components/clients/ClientsTable'

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({
    where: { archived_at: null },
    include: {
      entities: { where: { archived_at: null }, select: { id: true } },
      assigned_owner: { select: { name: true } },
    },
    orderBy: { created_at: 'desc' },
  })

  const stats = {
    total:               clients.length,
    INDIVIDUAL_ONLY:     clients.filter(c => c.primary_flow_type === 'INDIVIDUAL_ONLY').length,
    INDIVIDUAL_BUSINESS: clients.filter(c => c.primary_flow_type === 'INDIVIDUAL_BUSINESS').length,
    PARTNERSHIP:         clients.filter(c => c.primary_flow_type === 'PARTNERSHIP').length,
    COMPANY:             clients.filter(c => c.primary_flow_type === 'COMPANY').length,
  }

  return (
    <div>
      {/* Page Header */}
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="page-title">Clients</h1>
          <p className="page-subtitle">{clients.length} active clients</p>
        </div>
        <Link href="/clients/new" className="btn-primary">
          <Plus size={16} />
          New Client
        </Link>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 gap-4 mb-8 lg:grid-cols-5">
        <Card size="sm">
          <p className="text-label text-ink-muted uppercase tracking-wide mb-1">All</p>
          <p className="text-section font-bold text-ink-primary tabular-nums">{stats.total}</p>
        </Card>
        <Card size="sm">
          <p className="text-label text-ink-muted uppercase tracking-wide mb-1">Individual</p>
          <p className="text-section font-bold text-ink-primary tabular-nums">{stats.INDIVIDUAL_ONLY}</p>
        </Card>
        <Card size="sm">
          <p className="text-label text-ink-muted uppercase tracking-wide mb-1">Indiv+Biz</p>
          <p className="text-section font-bold text-ink-primary tabular-nums">{stats.INDIVIDUAL_BUSINESS}</p>
        </Card>
        <Card size="sm">
          <p className="text-label text-ink-muted uppercase tracking-wide mb-1">Partnership</p>
          <p className="text-section font-bold text-ink-primary tabular-nums">{stats.PARTNERSHIP}</p>
        </Card>
        <Card size="sm">
          <p className="text-label text-ink-muted uppercase tracking-wide mb-1">Company</p>
          <p className="text-section font-bold text-ink-primary tabular-nums">{stats.COMPANY}</p>
        </Card>
      </div>

      {/* Interactive Table */}
      <ClientsTable clients={clients} />
    </div>
  )
}
