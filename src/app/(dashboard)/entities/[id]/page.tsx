export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { FLOW_TYPE_LABELS, formatDate, formatCurrency } from '@/lib/utils'
import {
  ArrowLeft,
  Landmark,
  FileText,
  Upload,
  Receipt,
  Calendar,
  CheckSquare,
  Square,
  Users,
  Plus,
  TrendingUp,
  Building2,
} from 'lucide-react'

// ─── Label maps ────────────────────────────────────────────────────────────────

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

const E_INVOICE_LABELS: Record<string, string> = {
  PHASE_1:   'Phase 1',
  PHASE_2:   'Phase 2',
  PHASE_3:   'Phase 3',
  NOT_YET:   'Not Yet',
  VOLUNTARY: 'Voluntary',
  EXEMPT:    'Exempt',
}

const FRAMEWORK_LABELS: Record<string, string> = {
  MFRS_FULL: 'MFRS Full',
  MFRS_SME:  'MFRS SME',
  CASH_BASIS: 'Cash Basis',
  NONE:       'None',
}

const CLOSE_STATUS_VARIANT: Record<string, 'success' | 'warning' | 'error' | 'neutral' | 'info'> = {
  CLOSED:    'success',
  IN_REVIEW: 'warning',
  DRAFT:     'neutral',
  REOPENED:  'warning',
  ARCHIVED:  'neutral',
}

// ─── Checklist Item ────────────────────────────────────────────────────────────

function ChecklistItem({ label, done = false }: { label: string; done?: boolean }) {
  return (
    <li className="flex items-start gap-2.5 text-body">
      {done
        ? <CheckSquare size={15} className="text-status-success mt-0.5 flex-shrink-0" />
        : <Square       size={15} className="text-ink-muted   mt-0.5 flex-shrink-0" />
      }
      <span className={done ? 'text-ink-muted line-through' : 'text-ink-secondary'}>{label}</span>
    </li>
  )
}

// ─── Flow-type sections ────────────────────────────────────────────────────────

function IndividualOnlySection() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-ink-muted" />
          <CardTitle>Personal Tax Profile</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-label text-ink-muted uppercase tracking-wide mb-3">Filing Details</p>
            <dl className="space-y-2.5">
              <div className="flex items-center justify-between">
                <dt className="text-label text-ink-muted">Filing Form</dt>
                <dd className="font-mono text-body font-medium text-ink-primary">Form BE</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-label text-ink-muted">Deadline</dt>
                <dd className="text-body text-ink-primary">30 April 2026</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-label text-ink-muted">Channel</dt>
                <dd className="text-body text-ink-primary">e-Filing (MyTax)</dd>
              </div>
            </dl>
          </div>
          <div>
            <p className="text-label text-ink-muted uppercase tracking-wide mb-3">Preparation Checklist</p>
            <ul className="space-y-2">
              <ChecklistItem label="Employment income docs collected" />
              <ChecklistItem label="Relief docs collected" />
              <ChecklistItem label="Previous filing reference noted" />
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function IndividualBusinessSection() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-ink-muted" />
          <CardTitle>Business Profile + Personal Tax</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-label text-ink-muted uppercase tracking-wide mb-3">Filing Details</p>
            <dl className="space-y-2.5">
              <div className="flex items-center justify-between">
                <dt className="text-label text-ink-muted">Business Form</dt>
                <dd className="font-mono text-body font-medium text-ink-primary">Form B</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-label text-ink-muted">Employer Form</dt>
                <dd className="font-mono text-body font-medium text-ink-primary">Form EA</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-label text-ink-muted">Deadline</dt>
                <dd className="text-body text-ink-primary">30 June 2026</dd>
              </div>
            </dl>
          </div>
          <div>
            <p className="text-label text-ink-muted uppercase tracking-wide mb-3">Preparation Checklist</p>
            <ul className="space-y-2">
              <ChecklistItem label="Business bank accounts set up" />
              <ChecklistItem label="Bank statements imported" />
              <ChecklistItem label="Transactions classified" />
              <ChecklistItem label="Form EA collected from employer" />
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function PartnershipSection({
  partners,
  entityId,
}: {
  partners: Array<{
    id: string
    partner_name: string
    identification_no: string | null
    profit_share_percentage: unknown
    is_active: boolean
  }>
  entityId: string
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-ink-muted" />
            <CardTitle>Partnership Profile</CardTitle>
          </div>
          <Link
            href={`/entities/${entityId}/partners/new`}
            className="btn-secondary text-label"
          >
            <Plus size={14} />
            Add Partner
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <p className="text-label text-ink-muted uppercase tracking-wide mb-3">Filing Details</p>
            <dl className="space-y-2.5">
              <div className="flex items-center justify-between">
                <dt className="text-label text-ink-muted">Filing Form</dt>
                <dd className="font-mono text-body font-medium text-ink-primary">Form P</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-label text-ink-muted">Deadline</dt>
                <dd className="text-body text-ink-primary">30 June 2026</dd>
              </div>
            </dl>
          </div>
          <div>
            <p className="text-label text-ink-muted uppercase tracking-wide mb-3">Preparation Checklist</p>
            <ul className="space-y-2">
              <ChecklistItem label="Partnership deed uploaded" />
              <ChecklistItem label="All partners' details complete" done={partners.length > 0} />
              <ChecklistItem label="Bank statements imported" />
            </ul>
          </div>
        </div>

        {/* Partners table */}
        <div className="border border-border rounded-card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th className="py-2.5 px-4">Partner Name</th>
                <th className="py-2.5 px-4">IC / Passport</th>
                <th className="py-2.5 px-4 text-right">Profit Share %</th>
                <th className="py-2.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {partners.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-8 text-ink-muted text-label">
                    No partners added yet.
                  </td>
                </tr>
              ) : (
                partners.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2.5 px-4 font-medium text-ink-primary">{p.partner_name}</td>
                    <td className="py-2.5 px-4 font-mono text-ink-secondary text-label">
                      {p.identification_no ?? '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-ink-primary">
                      {Number(p.profit_share_percentage).toFixed(2)}%
                    </td>
                    <td className="py-2.5 px-4">
                      <Badge variant={p.is_active ? 'success' : 'neutral'}>
                        {p.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

function CompanySection({
  monthlyCloses,
}: {
  monthlyCloses: Array<{
    id: string
    period_end: Date
    status: string
    closed_at: Date | null
  }>
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 size={16} className="text-ink-muted" />
          <CardTitle>Company Overview</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <p className="text-label text-ink-muted uppercase tracking-wide mb-3">Filing Details</p>
            <dl className="space-y-2.5">
              <div className="flex items-center justify-between">
                <dt className="text-label text-ink-muted">Filing Form</dt>
                <dd className="font-mono text-body font-medium text-ink-primary">Form C</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-label text-ink-muted">Deadline</dt>
                <dd className="text-body text-ink-primary">7 months from FYE</dd>
              </div>
            </dl>
          </div>
          <div>
            <p className="text-label text-ink-muted uppercase tracking-wide mb-3">Preparation Checklist</p>
            <ul className="space-y-2">
              <ChecklistItem label="Bank accounts set up" done={false} />
              <ChecklistItem label="Monthly closes up to date" done={monthlyCloses.some(m => m.status === 'CLOSED')} />
              <ChecklistItem label="Auditor appointed" />
            </ul>
          </div>
        </div>

        {/* Monthly close mini-table */}
        <p className="text-label text-ink-muted uppercase tracking-wide mb-3">Monthly Close Status (Last 6)</p>
        <div className="border border-border rounded-card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th className="py-2.5 px-4">Period</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4">Closed Date</th>
              </tr>
            </thead>
            <tbody>
              {monthlyCloses.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-8 text-ink-muted text-label">
                    No monthly closes yet.
                  </td>
                </tr>
              ) : (
                monthlyCloses.map((mc) => (
                  <tr key={mc.id}>
                    <td className="py-2.5 px-4 font-mono text-ink-secondary text-label">
                      {formatDate(mc.period_end, 'short')}
                    </td>
                    <td className="py-2.5 px-4">
                      <Badge variant={CLOSE_STATUS_VARIANT[mc.status] ?? 'neutral'}>
                        {mc.status.replace('_', ' ')}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-4 text-ink-secondary text-label">
                      {mc.closed_at ? formatDate(mc.closed_at, 'short') : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default async function EntityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const entity = await prisma.entity.findUnique({
    where: { id },
    include: {
      client: true,
      bank_accounts: { where: { archived_at: null } },
      partners: { where: { is_active: true } },
      monthly_closes: { orderBy: { period_end: 'desc' }, take: 6 },
      transactions: {
        where: { accounting_category_id: null },
        take: 5,
        orderBy: { txn_date: 'desc' },
      },
      _count: {
        select: {
          transactions: true,
          supporting_documents: true,
        },
      },
    },
  })

  if (!entity) notFound()

  // Mask account number — keep last 4 digits
  function maskAccountNo(no: string): string {
    if (no.length <= 4) return no
    return '•••• ' + no.slice(-4)
  }

  return (
    <div className="max-w-5xl">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div className="flex items-center gap-3 mb-2">
          <Link href="/entities" className="text-ink-muted hover:text-ink-primary transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="page-title truncate">{entity.entity_name}</h1>
              <Badge variant="neutral">{ENTITY_TYPE_LABELS[entity.entity_type] ?? entity.entity_type}</Badge>
              <Badge variant={entity.is_active ? 'success' : 'neutral'}>
                {entity.is_active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-body text-ink-secondary">{FLOW_TYPE_LABELS[entity.flow_type]}</span>
              <span className="text-ink-muted">·</span>
              <Link href={`/clients/${entity.client_id}`} className="text-body text-ink-secondary hover:text-ink-primary">
                {entity.client.display_name ?? entity.client.legal_name}
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">

        {/* ── Overview Cards Row ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Card size="sm">
            <p className="text-label text-ink-muted uppercase tracking-wide mb-1">Financial Year End</p>
            <p className="text-section font-bold text-ink-primary tabular-nums">{entity.financial_year_end}</p>
          </Card>
          <Card size="sm">
            <p className="text-label text-ink-muted uppercase tracking-wide mb-1">Base Currency</p>
            <p className="text-section font-bold text-ink-primary font-mono">{entity.base_currency}</p>
          </Card>
          <Card size="sm">
            <p className="text-label text-ink-muted uppercase tracking-wide mb-1">Reporting Framework</p>
            <p className="text-body font-semibold text-ink-primary mt-1">
              {FRAMEWORK_LABELS[entity.reporting_framework] ?? entity.reporting_framework}
            </p>
          </Card>
          <Card size="sm">
            <p className="text-label text-ink-muted uppercase tracking-wide mb-1">e-Invoice Phase</p>
            <p className="text-body font-semibold text-ink-primary mt-1">
              {entity.e_invoice_phase ? E_INVOICE_LABELS[entity.e_invoice_phase] ?? entity.e_invoice_phase : '—'}
            </p>
          </Card>
        </div>

        {/* ── Quick Stats Row ─────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-4">
          <Card size="sm">
            <div className="flex items-center gap-3">
              <Receipt size={18} className="text-ink-muted" />
              <div>
                <p className="text-label text-ink-muted uppercase tracking-wide">Transactions</p>
                <p className="text-section font-bold text-ink-primary tabular-nums">
                  {entity._count.transactions.toLocaleString()}
                </p>
              </div>
            </div>
          </Card>
          <Card size="sm">
            <div className="flex items-center gap-3">
              <Landmark size={18} className="text-ink-muted" />
              <div>
                <p className="text-label text-ink-muted uppercase tracking-wide">Bank Accounts</p>
                <p className="text-section font-bold text-ink-primary tabular-nums">
                  {entity.bank_accounts.length}
                </p>
              </div>
            </div>
          </Card>
          <Card size="sm">
            <div className="flex items-center gap-3">
              <FileText size={18} className="text-ink-muted" />
              <div>
                <p className="text-label text-ink-muted uppercase tracking-wide">Documents</p>
                <p className="text-section font-bold text-ink-primary tabular-nums">
                  {entity._count.supporting_documents.toLocaleString()}
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* ── Flow-type specific section ───────────────────────────────────── */}
        {entity.flow_type === 'INDIVIDUAL_ONLY' && <IndividualOnlySection />}
        {entity.flow_type === 'INDIVIDUAL_BUSINESS' && <IndividualBusinessSection />}
        {entity.flow_type === 'PARTNERSHIP' && (
          <PartnershipSection partners={entity.partners} entityId={entity.id} />
        )}
        {entity.flow_type === 'COMPANY' && (
          <CompanySection monthlyCloses={entity.monthly_closes} />
        )}

        {/* ── Bank Accounts ────────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Landmark size={16} className="text-ink-muted" />
              <CardTitle>Bank Accounts</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {entity.bank_accounts.length === 0 ? (
              <div className="py-10 text-center">
                <Landmark size={28} className="text-ink-muted mx-auto mb-2" />
                <p className="text-body text-ink-muted">No bank accounts set up.</p>
                <Link href="/bank-accounts/new" className="text-label text-ink-secondary hover:text-ink-primary mt-1 inline-block">
                  Add a bank account →
                </Link>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="py-2.5 px-4">Account Name</th>
                    <th className="py-2.5 px-4">Bank</th>
                    <th className="py-2.5 px-4">Account No</th>
                    <th className="py-2.5 px-4">Currency</th>
                    <th className="py-2.5 px-4">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {entity.bank_accounts.map((ba) => (
                    <tr key={ba.id}>
                      <td className="py-2.5 px-4 font-medium text-ink-primary">{ba.account_name}</td>
                      <td className="py-2.5 px-4 text-ink-secondary">{ba.bank_name}</td>
                      <td className="py-2.5 px-4 font-mono text-ink-secondary text-label">
                        {maskAccountNo(ba.account_no)}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-ink-secondary text-label">{ba.currency}</td>
                      <td className="py-2.5 px-4">
                        <Badge variant="neutral">{ba.account_type.replace('_', ' ')}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* ── Recent Unclassified Transactions ────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Receipt size={16} className="text-ink-muted" />
                <CardTitle>Recent Unclassified Transactions</CardTitle>
              </div>
              <Link
                href={`/transactions?entity_id=${entity.id}`}
                className="text-label text-ink-secondary hover:text-ink-primary"
              >
                View all →
              </Link>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {entity.transactions.length === 0 ? (
              <div className="py-10 text-center">
                <Receipt size={28} className="text-ink-muted mx-auto mb-2" />
                <p className="text-body text-ink-muted">All transactions are classified.</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Description</th>
                    <th className="py-2.5 px-4">Direction</th>
                    <th className="py-2.5 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {entity.transactions.map((txn) => (
                    <tr key={txn.id}>
                      <td className="py-2.5 px-4 font-mono text-ink-secondary text-label whitespace-nowrap">
                        {formatDate(txn.txn_date, 'short')}
                      </td>
                      <td className="py-2.5 px-4 text-ink-primary max-w-xs truncate">
                        {txn.description}
                      </td>
                      <td className="py-2.5 px-4">
                        <Badge variant={txn.direction === 'CREDIT' ? 'success' : 'error'}>
                          {txn.direction}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums font-medium text-ink-primary">
                        {formatCurrency(Number(txn.amount), entity.base_currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>

        {/* ── Quick Actions ────────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Link
                href={`/imports/new?entity_id=${entity.id}`}
                className="btn-secondary"
              >
                <Upload size={15} />
                Import Bank Statement
              </Link>
              <Link
                href={`/transactions?entity_id=${entity.id}`}
                className="btn-secondary"
              >
                <Receipt size={15} />
                View All Transactions
              </Link>
              <Link
                href={`/monthly-close?entity_id=${entity.id}`}
                className="btn-secondary"
              >
                <Calendar size={15} />
                Monthly Close
              </Link>
              <Link
                href={`/tax-prep/${entity.id}`}
                className="btn-secondary"
              >
                <FileText size={15} />
                Tax Prep
              </Link>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}
