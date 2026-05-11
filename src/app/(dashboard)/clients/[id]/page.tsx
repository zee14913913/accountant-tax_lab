export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { FLOW_TYPE_LABELS, FLOW_TYPE_FORM } from '@/lib/utils'
import {
  ArrowLeft, Building2, Phone, Mail,
  FileText, Plus, Landmark, Receipt
} from 'lucide-react'
import { ClientActions } from '@/components/clients/ClientActions'
import { AddEntityButton } from '@/components/clients/AddEntityButton'

const ENTITY_TYPE_LABELS: Record<string, string> = {
  INDIVIDUAL_TAX:      'Individual Tax',
  SOLE_PROPRIETORSHIP: 'Sole Proprietorship',
  ENTERPRISE:          'Enterprise',
  PARTNERSHIP:         'Partnership',
  SDN_BHD:             'Sdn Bhd',
  BHD:                 'Bhd',
  LLP:                 'LLP',
  FREELANCE:           'Freelance',
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const client = await prisma.client.findFirst({
    where: { id, archived_at: null },
    include: {
      entities: {
        where: { archived_at: null },
        include: {
          bank_accounts: { where: { is_active: true }, select: { id: true, bank_name: true, account_no: true, account_type: true } },
          filing_profiles: { where: { is_active: true }, select: { id: true, filing_category: true, filing_type: true, relevant_form: true } },
          _count: { select: { transactions: true, import_batches: true } },
        },
        orderBy: { created_at: 'asc' },
      },
      counterparties: { where: { is_active: true }, select: { id: true, name: true, type: true } },
      assigned_owner: { select: { id: true, name: true, email: true } },
    },
  })

  if (!client) notFound()

  const totalTransactions = client.entities.reduce((sum, e) => sum + e._count.transactions, 0)

  return (
    <div className="max-w-5xl">
      {/* Page Header */}
      <div className="page-header">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/clients" className="text-ink-muted hover:text-ink-primary transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="page-title truncate">{client.legal_name}</h1>
              <Badge variant={client.status === 'ACTIVE' ? 'success' : 'neutral'}>
                {client.status}
              </Badge>
            </div>
            {client.display_name && client.display_name !== client.legal_name && (
              <p className="page-subtitle pl-0 mt-0.5">{client.display_name}</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left Column — Client Info */}
        <div className="col-span-1 space-y-5">
          {/* Client Profile Card */}
          <Card>
            <CardHeader>
              <CardTitle>Client Profile</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3">
                <div>
                  <dt className="text-label text-ink-muted uppercase tracking-wide mb-0.5">Client Code</dt>
                  <dd className="font-mono text-body text-ink-primary">{client.client_code}</dd>
                </div>
                <div>
                  <dt className="text-label text-ink-muted uppercase tracking-wide mb-0.5">Type</dt>
                  <dd>
                    <Badge variant="neutral">{FLOW_TYPE_LABELS[client.primary_flow_type]}</Badge>
                  </dd>
                </div>
                <div>
                  <dt className="text-label text-ink-muted uppercase tracking-wide mb-0.5">Tax Form</dt>
                  <dd className="font-mono text-body text-ink-primary">{FLOW_TYPE_FORM[client.primary_flow_type]}</dd>
                </div>
                {client.identification_no && (
                  <div>
                    <dt className="text-label text-ink-muted uppercase tracking-wide mb-0.5">IC / Passport</dt>
                    <dd className="font-mono text-body text-ink-primary">{client.identification_no}</dd>
                  </div>
                )}
                {client.registration_no && (
                  <div>
                    <dt className="text-label text-ink-muted uppercase tracking-wide mb-0.5">SSM No</dt>
                    <dd className="font-mono text-body text-ink-primary">{client.registration_no}</dd>
                  </div>
                )}
                {client.tax_no && (
                  <div>
                    <dt className="text-label text-ink-muted uppercase tracking-wide mb-0.5">Tax Ref No</dt>
                    <dd className="font-mono text-body text-ink-primary">{client.tax_no}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          {/* Contact Card */}
          <Card>
            <CardHeader>
              <CardTitle>Contact</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2.5">
                {client.phone ? (
                  <div className="flex items-center gap-2.5 text-body text-ink-secondary">
                    <Phone size={14} className="text-ink-muted flex-shrink-0" />
                    <span>{client.phone}</span>
                  </div>
                ) : null}
                {client.email ? (
                  <div className="flex items-center gap-2.5 text-body text-ink-secondary">
                    <Mail size={14} className="text-ink-muted flex-shrink-0" />
                    <a href={`mailto:${client.email}`} className="hover:text-ink-primary">
                      {client.email}
                    </a>
                  </div>
                ) : null}
                {!client.phone && !client.email && (
                  <p className="text-label text-ink-muted">No contact info recorded.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Summary Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-label text-ink-muted">Entities</span>
                  <span className="text-body font-medium text-ink-primary tabular-nums">{client.entities.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-label text-ink-muted">Transactions</span>
                  <span className="text-body font-medium text-ink-primary tabular-nums">{totalTransactions.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-label text-ink-muted">Counterparties</span>
                  <span className="text-body font-medium text-ink-primary tabular-nums">{client.counterparties.length}</span>
                </div>
                {client.assigned_owner && (
                  <div className="flex items-center justify-between pt-2 border-t border-divider">
                    <span className="text-label text-ink-muted">Assigned to</span>
                    <span className="text-label text-ink-secondary">{client.assigned_owner.name}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <ClientActions clientId={client.id} clientStatus={client.status} />
        </div>

        {/* Right Column — Entities */}
        <div className="col-span-2 space-y-5">
          {/* Entities Header */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-section text-ink-primary font-semibold">Entities</h2>
              <p className="text-label text-ink-muted mt-0.5">
                {client.entities.length} active {client.entities.length === 1 ? 'entity' : 'entities'}
              </p>
            </div>
            <AddEntityButton clientId={client.id} />
          </div>

          {client.entities.length === 0 ? (
            <Card>
              <div className="py-12 text-center">
                <Building2 size={32} className="text-ink-muted mx-auto mb-3" />
                <p className="text-body text-ink-muted">No entities yet.</p>
                <p className="text-label text-ink-muted mt-1">
                  Add an entity to start tracking transactions and filing data.
                </p>
              </div>
            </Card>
          ) : (
            <div className="space-y-4">
              {client.entities.map((entity) => (
                <Card key={entity.id} className="hover:shadow-card-hover transition-shadow">
                  {/* Entity Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-card-title text-ink-primary">{entity.entity_name}</h3>
                        <Badge variant={entity.is_active ? 'success' : 'neutral'}>
                          {entity.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-label text-ink-muted">{ENTITY_TYPE_LABELS[entity.entity_type] ?? entity.entity_type}</span>
                        <span className="text-ink-muted">·</span>
                        <Badge variant="neutral">{FLOW_TYPE_LABELS[entity.flow_type]}</Badge>
                      </div>
                    </div>
                    <Link
                      href={`/accounting-assistant/${entity.id}`}
                      className="btn-secondary text-label"
                    >
                      Open Workbench →
                    </Link>
                  </div>

                  {/* Entity Detail Grid */}
                  <div className="grid grid-cols-3 gap-4 text-label mb-4">
                    {entity.tax_reference_no && (
                      <div>
                        <p className="text-ink-muted uppercase tracking-wide mb-0.5">Tax Ref</p>
                        <p className="font-mono text-ink-primary">{entity.tax_reference_no}</p>
                      </div>
                    )}
                    {entity.registration_no && (
                      <div>
                        <p className="text-ink-muted uppercase tracking-wide mb-0.5">Reg No</p>
                        <p className="font-mono text-ink-primary">{entity.registration_no}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-ink-muted uppercase tracking-wide mb-0.5">FYE</p>
                      <p className="text-ink-primary">{entity.financial_year_end}</p>
                    </div>
                    <div>
                      <p className="text-ink-muted uppercase tracking-wide mb-0.5">Currency</p>
                      <p className="font-mono text-ink-primary">{entity.base_currency}</p>
                    </div>
                    <div>
                      <p className="text-ink-muted uppercase tracking-wide mb-0.5">Framework</p>
                      <p className="text-ink-primary">{entity.reporting_framework.replace('_', ' ')}</p>
                    </div>
                  </div>

                  {/* Stats Row */}
                  <div className="flex items-center gap-6 pt-3 border-t border-divider">
                    <div className="flex items-center gap-2">
                      <Receipt size={13} className="text-ink-muted" />
                      <span className="text-label text-ink-muted">
                        <span className="tabular-nums font-medium text-ink-secondary">{entity._count.transactions.toLocaleString()}</span> transactions
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Landmark size={13} className="text-ink-muted" />
                      <span className="text-label text-ink-muted">
                        <span className="tabular-nums font-medium text-ink-secondary">{entity.bank_accounts.length}</span> bank accounts
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText size={13} className="text-ink-muted" />
                      <span className="text-label text-ink-muted">
                        <span className="tabular-nums font-medium text-ink-secondary">{entity.filing_profiles.length}</span> filing profiles
                      </span>
                    </div>
                  </div>

                  {/* Bank Accounts mini-list */}
                  {entity.bank_accounts.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-divider space-y-1.5">
                      {entity.bank_accounts.map(ba => (
                        <div key={ba.id} className="flex items-center gap-2 text-label text-ink-secondary">
                          <Landmark size={12} className="text-ink-muted" />
                          <span className="font-medium">{ba.bank_name}</span>
                          <span className="font-mono text-ink-muted">{ba.account_no}</span>
                          <span className="text-ink-muted ml-auto">{ba.account_type.replace('_', ' ')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}

          {/* Counterparties */}
          {client.counterparties.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Counterparties ({client.counterparties.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="py-2.5 px-4">Name</th>
                      <th className="py-2.5 px-4">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {client.counterparties.map(cp => (
                      <tr key={cp.id}>
                        <td className="py-2.5 px-4 text-body text-ink-primary">{cp.name}</td>
                        <td className="py-2.5 px-4">
                          <Badge variant="neutral">{cp.type.replace('_', ' ')}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}


