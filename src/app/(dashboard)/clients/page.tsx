export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { FLOW_TYPE_LABELS, FLOW_TYPE_FORM } from '@/lib/utils'
import { Plus, Search } from 'lucide-react'

export default async function ClientsPage() {
  const clients = await prisma.client.findMany({
    where: { archived_at: null },
    include: {
      entities: { where: { archived_at: null } },
      assigned_owner: { select: { name: true } },
    },
    orderBy: { created_at: 'desc' },
  })

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

      {/* Search & Filter Bar */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            placeholder="Search clients..."
            className="form-input pl-9"
          />
        </div>
        <select className="form-input w-44">
          <option value="">All Types</option>
          <option value="INDIVIDUAL_ONLY">Individual</option>
          <option value="INDIVIDUAL_BUSINESS">Individual + Business</option>
          <option value="PARTNERSHIP">Partnership</option>
          <option value="COMPANY">Company / Sdn Bhd</option>
        </select>
      </div>

      {/* Clients Table */}
      <Card className="p-0 overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th className="py-3 px-6">Client Code</th>
              <th className="py-3 px-4">Legal Name</th>
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4">Tax Form</th>
              <th className="py-3 px-4">Entities</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Assigned To</th>
              <th className="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-16 text-ink-muted">
                  No clients yet. Create your first client to get started.
                </td>
              </tr>
            ) : (
              clients.map((client) => (
                <tr key={client.id}>
                  <td className="py-3 px-6">
                    <span className="font-mono text-label text-ink-secondary">
                      {client.client_code}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <div>
                      <p className="font-medium text-ink-primary">{client.legal_name}</p>
                      {client.display_name && client.display_name !== client.legal_name && (
                        <p className="text-label text-ink-muted">{client.display_name}</p>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant="neutral">
                      {FLOW_TYPE_LABELS[client.primary_flow_type]}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-label text-ink-secondary font-mono">
                      {FLOW_TYPE_FORM[client.primary_flow_type]}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-label text-ink-secondary">
                      {client.entities.length} {client.entities.length === 1 ? 'entity' : 'entities'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={client.status === 'ACTIVE' ? 'success' : 'neutral'}>
                      {client.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-label text-ink-muted">
                      {client.assigned_owner?.name ?? '—'}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <Link
                      href={`/clients/${client.id}`}
                      className="text-label text-ink-secondary hover:text-ink-primary"
                    >
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
