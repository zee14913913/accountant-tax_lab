'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { FLOW_TYPE_LABELS, FLOW_TYPE_FORM } from '@/lib/utils'
import { Search } from 'lucide-react'

interface Client {
  id: string
  client_code: string
  legal_name: string
  display_name: string | null
  primary_flow_type: string
  status: string
  entities: { id: string }[]
  assigned_owner: { name: string | null } | null
}

interface ClientsTableProps {
  clients: Client[]
}

export function ClientsTable({ clients }: ClientsTableProps) {
  const [search, setSearch]     = useState('')
  const [flowFilter, setFlow]   = useState('')
  const [statusFilter, setStatus] = useState('ACTIVE')

  const filtered = useMemo(() => {
    return clients.filter(c => {
      if (statusFilter && c.status !== statusFilter) return false
      if (flowFilter && c.primary_flow_type !== flowFilter) return false
      if (search) {
        const q = search.toLowerCase()
        return (
          c.legal_name.toLowerCase().includes(q) ||
          (c.display_name?.toLowerCase().includes(q) ?? false) ||
          c.client_code.toLowerCase().includes(q)
        )
      }
      return true
    })
  }, [clients, search, flowFilter, statusFilter])

  return (
    <div>
      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or code…"
            className="form-input pl-9 w-full"
          />
        </div>
        <select
          value={flowFilter}
          onChange={e => setFlow(e.target.value)}
          className="form-input w-48"
        >
          <option value="">All Types</option>
          <option value="INDIVIDUAL_ONLY">Individual</option>
          <option value="INDIVIDUAL_BUSINESS">Individual + Business</option>
          <option value="PARTNERSHIP">Partnership</option>
          <option value="COMPANY">Company / Sdn Bhd</option>
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatus(e.target.value)}
          className="form-input w-36"
        >
          <option value="">All Statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        {(search || flowFilter || statusFilter !== 'ACTIVE') && (
          <button
            onClick={() => { setSearch(''); setFlow(''); setStatus('ACTIVE') }}
            className="btn-ghost text-label text-ink-muted"
          >
            Clear
          </button>
        )}
        <span className="text-label text-ink-muted ml-auto">
          {filtered.length} of {clients.length}
        </span>
      </div>

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th className="py-3 px-5">Code</th>
              <th className="py-3 px-4">Legal Name</th>
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4">Tax Form</th>
              <th className="py-3 px-4 text-right">Entities</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4">Assigned</th>
              <th className="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-16 text-ink-muted">
                  {clients.length === 0
                    ? 'No clients yet. Create your first client to get started.'
                    : 'No clients match your search.'}
                </td>
              </tr>
            ) : (
              filtered.map((client) => (
                <tr key={client.id}>
                  <td className="py-3 px-5">
                    <span className="font-mono text-label text-ink-secondary">{client.client_code}</span>
                  </td>
                  <td className="py-3 px-4">
                    <Link href={`/clients/${client.id}`} className="hover:underline">
                      <p className="font-medium text-ink-primary">{client.legal_name}</p>
                      {client.display_name && client.display_name !== client.legal_name && (
                        <p className="text-label text-ink-muted">{client.display_name}</p>
                      )}
                    </Link>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant="neutral">
                      {FLOW_TYPE_LABELS[client.primary_flow_type] ?? client.primary_flow_type}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-mono text-label text-ink-secondary">
                      {FLOW_TYPE_FORM[client.primary_flow_type] ?? '—'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right tabular-nums">
                    <span className="text-label text-ink-secondary">{client.entities.length}</span>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={client.status === 'ACTIVE' ? 'success' : 'neutral'}>
                      {client.status}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-label text-ink-muted">{client.assigned_owner?.name ?? '—'}</span>
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
