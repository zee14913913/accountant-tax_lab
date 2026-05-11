export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, formatDate, FLOW_TYPE_LABELS } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Shared Helpers
// ---------------------------------------------------------------------------
function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="section-title mt-8 mb-3 pb-2 border-b border-border text-ink-primary">
      {title}
    </h2>
  )
}

function CheckItem({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span
        className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
          ok ? 'bg-status-success/20 text-status-success' : 'bg-status-error/20 text-status-error'
        }`}
      >
        {ok ? '✓' : '✗'}
      </span>
      <span className={`text-body ${ok ? 'text-ink-secondary' : 'text-ink-primary font-medium'}`}>
        {label}
      </span>
    </div>
  )
}

function AmountCell({ amount }: { amount: number | null | undefined }) {
  const n = Number(amount ?? 0)
  return (
    <td className={`px-4 py-2.5 text-right tabular-nums text-body ${n < 0 ? 'text-status-error' : 'text-ink-primary'}`}>
      {n === 0 ? '—' : formatCurrency(n)}
    </td>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default async function AuditorPackEntityPage({
  params,
}: {
  params: Promise<{ entityId: string }>
}) {
  const { entityId } = await params

  // Core entity fetch
  const entity = await prisma.entity.findFirst({
    where: { id: entityId, archived_at: null },
    include: {
      client: { select: { legal_name: true, identification_no: true, tax_no: true, primary_flow_type: true } },
      partners: { where: { is_active: true }, orderBy: { partner_name: 'asc' } },
      filing_profiles: { where: { is_active: true } },
    },
  })

  if (!entity) notFound()

  // Parallel data fetch based on what we need
  const [
    transactions,
    latestPnl,
    unresolvedIssues,
    supportingDocs,
    monthlyCloses,
    taxReliefItems,
  ] = await Promise.all([
    prisma.transaction.findMany({
      where: { entity_id: entityId, archived_at: null },
      include: {
        accounting_category: { select: { name: true, code: true, report_group: true } },
        tax_category: { select: { name: true, deductible_type: true } },
      },
      orderBy: { txn_date: 'desc' },
    }),
    prisma.pnlSnapshot.findFirst({
      where: { entity_id: entityId },
      orderBy: { generated_at: 'desc' },
    }),
    prisma.unresolvedIssue.findMany({
      where: { entity_id: entityId, status: { notIn: ['RESOLVED', 'WAIVED'] } },
      orderBy: [{ priority: 'asc' }, { created_at: 'asc' }],
    }),
    prisma.supportingDocument.findMany({
      where: { entity_id: entityId, archived_at: null },
      select: { document_type: true, verification_status: true },
    }),
    prisma.monthlyClose.findMany({
      where: { entity_id: entityId, archived_at: null },
      orderBy: { period_start: 'desc' },
      take: 12,
    }),
    prisma.taxReliefItem.findMany({
      where: { entity_id: entityId },
      orderBy: { relief_category: 'asc' },
    }),
  ])

  // Computed stats
  const unclassifiedCount = transactions.filter(t => !t.accounting_category_id).length
  const missingDocsCount  = transactions.filter(t => t.document_status === 'REQUIRED_MISSING').length
  const taxSensitiveItems = transactions.filter(t => t.risk_flag === 'TAX_SENSITIVE')

  const allClosed     = monthlyCloses.length > 0 && monthlyCloses.every(c => c.status === 'CLOSED')
  const noOpenIssues  = unresolvedIssues.length === 0
  const allClassified = unclassifiedCount === 0
  const noMissingDocs = missingDocsCount === 0

  // P&L numbers
  const revenue  = Number(latestPnl?.revenue_total ?? 0)
  const expenses = Number(latestPnl?.opex_total ?? 0) + Number(latestPnl?.cogs_total ?? 0)
  const netProfit = Number(latestPnl?.net_profit ?? 0)

  // Doc counts by type
  const docsByType = supportingDocs.reduce<Record<string, number>>((acc, d) => {
    acc[d.document_type] = (acc[d.document_type] ?? 0) + 1
    return acc
  }, {})

  // Category breakdown for expenses
  type CatGroup = { name: string; code: string; group: string; total: number }
  const categoryMap = new Map<string, CatGroup>()
  for (const txn of transactions) {
    if (!txn.accounting_category) continue
    const key = txn.accounting_category.code
    const existing = categoryMap.get(key)
    const amt = txn.direction === 'DEBIT' ? -Number(txn.amount) : Number(txn.amount)
    if (existing) {
      existing.total += amt
    } else {
      categoryMap.set(key, {
        name:  txn.accounting_category.name,
        code:  txn.accounting_category.code,
        group: txn.accounting_category.report_group,
        total: amt,
      })
    }
  }
  const categoryBreakdown = Array.from(categoryMap.values()).sort((a, b) => a.name.localeCompare(b.name))

  const packTitle =
    entity.flow_type === 'INDIVIDUAL_ONLY'     ? 'Personal Filing Support Pack' :
    entity.flow_type === 'INDIVIDUAL_BUSINESS' ? 'Business Summary + Filing Pack' :
    entity.flow_type === 'PARTNERSHIP'         ? 'Form P Support Pack' :
    /* COMPANY */                                'Auditor / Licensed Team Package'

  return (
    <div className="page-content max-w-5xl">
      {/* Back Nav */}
      <div className="mb-6">
        <Link href="/auditor-pack" className="btn-ghost text-ink-muted text-sm">
          ← Back to Auditor Pack
        </Link>
      </div>

      {/* Page Header */}
      <div className="page-header flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="page-title">{packTitle}</h1>
            <Badge variant="neutral">{FLOW_TYPE_LABELS[entity.flow_type] ?? entity.flow_type}</Badge>
          </div>
          <p className="page-subtitle mt-1">
            {entity.entity_name} &nbsp;·&nbsp; {entity.client.legal_name}
          </p>
        </div>
        <button
          className="btn-primary print:hidden"
          onClick={() => {}}
          // Export: window.print()
          data-print
        >
          Export to PDF
        </button>
      </div>

      {/* ================================================================
          INDIVIDUAL_ONLY — Personal Filing Support Pack
          ================================================================ */}
      {entity.flow_type === 'INDIVIDUAL_ONLY' && (
        <>
          {/* 1. Client Overview */}
          <SectionHeader title="1. Client Overview" />
          <div className="card grid grid-cols-2 sm:grid-cols-4 gap-6">
            <div>
              <p className="text-label text-ink-muted">Full Name</p>
              <p className="text-body text-ink-primary font-medium">{entity.client.legal_name}</p>
            </div>
            <div>
              <p className="text-label text-ink-muted">IC / Passport No.</p>
              <p className="text-body text-ink-primary">{entity.client.identification_no ?? '—'}</p>
            </div>
            <div>
              <p className="text-label text-ink-muted">Tax File No.</p>
              <p className="text-body text-ink-primary">{entity.tax_reference_no ?? entity.client.tax_no ?? '—'}</p>
            </div>
            <div>
              <p className="text-label text-ink-muted">Assessment Year</p>
              <p className="text-body text-ink-primary tabular-nums">
                {entity.filing_profiles[0]?.assessment_year ?? new Date().getFullYear() - 1}
              </p>
            </div>
          </div>

          {/* 2. Income Summary Table */}
          <SectionHeader title="2. Income Summary" />
          <div className="card p-0 overflow-hidden">
            <table className="data-table w-full">
              <thead>
                <tr className="border-b border-border bg-panel">
                  <th className="px-4 py-3 text-left text-label text-ink-muted">Income Source</th>
                  <th className="px-4 py-3 text-right text-label text-ink-muted">Amount (RM)</th>
                  <th className="px-4 py-3 text-left text-label text-ink-muted">Document Status</th>
                </tr>
              </thead>
              <tbody>
                {categoryBreakdown.filter(c => c.group === 'REVENUE' || c.group === 'OTHER_INCOME').length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-ink-muted text-body">No income transactions classified yet.</td>
                  </tr>
                ) : (
                  categoryBreakdown
                    .filter(c => c.group === 'REVENUE' || c.group === 'OTHER_INCOME')
                    .map(c => (
                      <tr key={c.code} className="border-b border-border">
                        <td className="px-4 py-2.5 text-body text-ink-primary">{c.name}</td>
                        <AmountCell amount={c.total} />
                        <td className="px-4 py-2.5">
                          <Badge variant="neutral">Classified</Badge>
                        </td>
                      </tr>
                    ))
                )}
                {categoryBreakdown.filter(c => c.group === 'REVENUE' || c.group === 'OTHER_INCOME').length > 0 && (
                  <tr className="border-t-2 border-border bg-panel">
                    <td className="px-4 py-2.5 font-semibold text-body text-ink-primary">Total</td>
                    <AmountCell
                      amount={categoryBreakdown
                        .filter(c => c.group === 'REVENUE' || c.group === 'OTHER_INCOME')
                        .reduce((s, c) => s + c.total, 0)}
                    />
                    <td />
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 3. Relief Claims Register */}
          <SectionHeader title="3. Relief Claims Register" />
          <div className="card p-0 overflow-hidden">
            <table className="data-table w-full">
              <thead>
                <tr className="border-b border-border bg-panel">
                  <th className="px-4 py-3 text-left text-label text-ink-muted">Relief Category</th>
                  <th className="px-4 py-3 text-right text-label text-ink-muted">Claimed (RM)</th>
                  <th className="px-4 py-3 text-right text-label text-ink-muted">Max Allowed</th>
                  <th className="px-4 py-3 text-left text-label text-ink-muted">Status</th>
                </tr>
              </thead>
              <tbody>
                {taxReliefItems.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-ink-muted text-body">No relief items recorded yet.</td>
                  </tr>
                ) : (
                  taxReliefItems.map(r => (
                    <tr key={r.id} className="border-b border-border">
                      <td className="px-4 py-2.5 text-body text-ink-primary">{r.relief_category}</td>
                      <AmountCell amount={Number(r.claimed_amount)} />
                      <AmountCell amount={r.max_allowed ? Number(r.max_allowed) : null} />
                      <td className="px-4 py-2.5">
                        <Badge variant={r.status === 'SUBMITTED' ? 'success' : r.status === 'CONFIRMED' ? 'info' : 'neutral'}>
                          {r.status.charAt(0) + r.status.slice(1).toLowerCase()}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 4. Outstanding Items */}
          <SectionHeader title="4. Outstanding Items" />
          <OutstandingItems
            unresolvedIssues={unresolvedIssues}
            unclassifiedCount={unclassifiedCount}
            missingDocsCount={missingDocsCount}
          />

          {/* 5. Pack Status */}
          <SectionHeader title="5. Pack Status — Ready for Licensed Tax Agent Review?" />
          <div className="card space-y-1">
            <CheckItem label="All income transactions classified" ok={allClassified} />
            <CheckItem label="Relief claims entered and confirmed" ok={taxReliefItems.filter(r => r.status === 'CONFIRMED' || r.status === 'SUBMITTED').length > 0} />
            <CheckItem label="No missing supporting documents" ok={noMissingDocs} />
            <CheckItem label="No unresolved issues" ok={noOpenIssues} />
          </div>
        </>
      )}

      {/* ================================================================
          INDIVIDUAL_BUSINESS — Business Summary + Filing Pack
          ================================================================ */}
      {entity.flow_type === 'INDIVIDUAL_BUSINESS' && (
        <>
          {/* 1. Business Profile */}
          <SectionHeader title="1. Business Profile" />
          <div className="card grid grid-cols-2 sm:grid-cols-4 gap-6">
            <div>
              <p className="text-label text-ink-muted">Business Name</p>
              <p className="text-body text-ink-primary font-medium">{entity.entity_name}</p>
            </div>
            <div>
              <p className="text-label text-ink-muted">Registration No.</p>
              <p className="text-body text-ink-primary">{entity.registration_no ?? '—'}</p>
            </div>
            <div>
              <p className="text-label text-ink-muted">Tax Reference</p>
              <p className="text-body text-ink-primary">{entity.tax_reference_no ?? '—'}</p>
            </div>
            <div>
              <p className="text-label text-ink-muted">Financial Year End</p>
              <p className="text-body text-ink-primary tabular-nums">{entity.financial_year_end}</p>
            </div>
          </div>

          {/* 2. Business Income Summary */}
          <SectionHeader title="2. Business Income Summary" />
          <div className="card">
            <div className="grid grid-cols-3 gap-6 text-center">
              <div>
                <p className="text-label text-ink-muted mb-1">Revenue</p>
                <p className="text-section font-bold text-ink-primary tabular-nums">
                  {formatCurrency(revenue)}
                </p>
              </div>
              <div>
                <p className="text-label text-ink-muted mb-1">Total Expenses</p>
                <p className="text-section font-bold text-ink-primary tabular-nums">
                  {formatCurrency(expenses)}
                </p>
              </div>
              <div>
                <p className="text-label text-ink-muted mb-1">Net Profit</p>
                <p className={`text-section font-bold tabular-nums ${netProfit >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                  {formatCurrency(netProfit)}
                </p>
              </div>
            </div>
            {!latestPnl && (
              <p className="text-label text-ink-muted mt-4 text-center">No P&L snapshot generated yet. Go to P&L → Generate.</p>
            )}
          </div>

          {/* 3. Expense Category Breakdown */}
          <SectionHeader title="3. Expense Category Breakdown" />
          <CategoryBreakdownTable categories={categoryBreakdown} />

          {/* 4. Tax-Sensitive Items */}
          <SectionHeader title="4. Tax-Sensitive Items" />
          <TaxSensitiveTable items={taxSensitiveItems} />

          {/* 5. Personal Filing Summary */}
          <SectionHeader title="5. Personal Filing Summary" />
          <div className="card">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-label text-ink-muted mb-2">Employment / Other Income</p>
                <p className="text-body text-ink-secondary">
                  {categoryBreakdown.filter(c => c.group === 'OTHER_INCOME').length > 0
                    ? formatCurrency(categoryBreakdown.filter(c => c.group === 'OTHER_INCOME').reduce((s, c) => s + c.total, 0))
                    : '—'
                  }
                </p>
              </div>
              <div>
                <p className="text-label text-ink-muted mb-2">Tax Reliefs (confirmed)</p>
                <p className="text-body text-ink-secondary">
                  {taxReliefItems.filter(r => r.status !== 'DRAFT').length} item(s) — {formatCurrency(
                    taxReliefItems.filter(r => r.status !== 'DRAFT').reduce((s, r) => s + Number(r.claimed_amount), 0)
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* 6. Outstanding Items */}
          <SectionHeader title="6. Outstanding Items" />
          <OutstandingItems
            unresolvedIssues={unresolvedIssues}
            unclassifiedCount={unclassifiedCount}
            missingDocsCount={missingDocsCount}
          />

          {/* 7. Pack Status */}
          <SectionHeader title="7. Pack Status — Ready for Licensed Tax Agent?" />
          <div className="card space-y-1">
            <CheckItem label="All transactions classified" ok={allClassified} />
            <CheckItem label="P&L snapshot generated" ok={latestPnl !== null} />
            <CheckItem label="No missing supporting documents" ok={noMissingDocs} />
            <CheckItem label="No unresolved issues" ok={noOpenIssues} />
            <CheckItem label="Personal relief items confirmed" ok={taxReliefItems.some(r => r.status !== 'DRAFT')} />
          </div>
        </>
      )}

      {/* ================================================================
          PARTNERSHIP — Form P Support Pack
          ================================================================ */}
      {entity.flow_type === 'PARTNERSHIP' && (
        <>
          {/* 1. Partnership Profile */}
          <SectionHeader title="1. Partnership Profile" />
          <div className="card grid grid-cols-2 sm:grid-cols-4 gap-6">
            <div>
              <p className="text-label text-ink-muted">Partnership Name</p>
              <p className="text-body text-ink-primary font-medium">{entity.entity_name}</p>
            </div>
            <div>
              <p className="text-label text-ink-muted">Registration No.</p>
              <p className="text-body text-ink-primary">{entity.registration_no ?? '—'}</p>
            </div>
            <div>
              <p className="text-label text-ink-muted">Tax Reference</p>
              <p className="text-body text-ink-primary">{entity.tax_reference_no ?? '—'}</p>
            </div>
            <div>
              <p className="text-label text-ink-muted">Financial Year End</p>
              <p className="text-body text-ink-primary tabular-nums">{entity.financial_year_end}</p>
            </div>
          </div>

          {/* 2. Partnership P&L */}
          <SectionHeader title="2. Partnership P&L" />
          <div className="card">
            <div className="grid grid-cols-3 gap-6 text-center">
              <div>
                <p className="text-label text-ink-muted mb-1">Revenue</p>
                <p className="text-section font-bold text-ink-primary tabular-nums">{formatCurrency(revenue)}</p>
              </div>
              <div>
                <p className="text-label text-ink-muted mb-1">Total Expenses</p>
                <p className="text-section font-bold text-ink-primary tabular-nums">{formatCurrency(expenses)}</p>
              </div>
              <div>
                <p className="text-label text-ink-muted mb-1">Net Profit</p>
                <p className={`text-section font-bold tabular-nums ${netProfit >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                  {formatCurrency(netProfit)}
                </p>
              </div>
            </div>
            {!latestPnl && (
              <p className="text-label text-ink-muted mt-4 text-center">No P&L snapshot. Go to P&L → Generate.</p>
            )}
          </div>

          {/* 3. Partner Apportionment Table */}
          <SectionHeader title="3. Partner Apportionment Table" />
          <div className="card p-0 overflow-hidden">
            <table className="data-table w-full">
              <thead>
                <tr className="border-b border-border bg-panel">
                  <th className="px-4 py-3 text-left text-label text-ink-muted">Partner Name</th>
                  <th className="px-4 py-3 text-left text-label text-ink-muted">IC No.</th>
                  <th className="px-4 py-3 text-right text-label text-ink-muted">Share %</th>
                  <th className="px-4 py-3 text-right text-label text-ink-muted">Share of Profit (RM)</th>
                  <th className="px-4 py-3 text-left text-label text-ink-muted">Form B/BE Required</th>
                </tr>
              </thead>
              <tbody>
                {entity.partners.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-ink-muted text-body">No partners recorded.</td>
                  </tr>
                ) : (
                  entity.partners.map(p => {
                    const sharePct = Number(p.profit_share_percentage)
                    const shareAmt = netProfit * (sharePct / 100)
                    return (
                      <tr key={p.id} className="border-b border-border">
                        <td className="px-4 py-2.5 text-body text-ink-primary font-medium">{p.partner_name}</td>
                        <td className="px-4 py-2.5 text-body text-ink-secondary">{p.identification_no ?? '—'}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-body text-ink-secondary">{sharePct.toFixed(2)}%</td>
                        <AmountCell amount={shareAmt} />
                        <td className="px-4 py-2.5">
                          <Badge variant="info">Yes — Form B</Badge>
                        </td>
                      </tr>
                    )
                  })
                )}
                {entity.partners.length > 0 && (
                  <tr className="border-t-2 border-border bg-panel">
                    <td className="px-4 py-2.5 font-semibold text-body text-ink-primary" colSpan={2}>Total</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-body text-ink-primary">
                      {entity.partners.reduce((s, p) => s + Number(p.profit_share_percentage), 0).toFixed(2)}%
                    </td>
                    <AmountCell amount={netProfit} />
                    <td />
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 4. Supporting Schedules */}
          <SectionHeader title="4. Supporting Schedules" />
          <div className="card grid grid-cols-2 gap-6">
            <div>
              <p className="text-label text-ink-muted mb-1">Capital Accounts</p>
              <p className="text-body text-ink-secondary">
                {categoryBreakdown.filter(c => c.group === 'BALANCE_SHEET_EQUITY').length} equity category lines
              </p>
            </div>
            <div>
              <p className="text-label text-ink-muted mb-1">Fixed Assets</p>
              <p className="text-body text-ink-secondary">
                {categoryBreakdown.filter(c => c.group === 'BALANCE_SHEET_ASSET').length} asset category lines
              </p>
            </div>
          </div>

          {/* 5. Outstanding Items */}
          <SectionHeader title="5. Outstanding Items" />
          <OutstandingItems
            unresolvedIssues={unresolvedIssues}
            unclassifiedCount={unclassifiedCount}
            missingDocsCount={missingDocsCount}
          />

          {/* 6. Pack Status */}
          <SectionHeader title="6. Pack Status — Ready for Tax Agent?" />
          <div className="card space-y-1">
            <CheckItem label="All transactions classified" ok={allClassified} />
            <CheckItem label="P&L snapshot generated" ok={latestPnl !== null} />
            <CheckItem label="Partner profit shares sum to 100%" ok={Math.abs(entity.partners.reduce((s, p) => s + Number(p.profit_share_percentage), 0) - 100) < 0.01} />
            <CheckItem label="No missing supporting documents" ok={noMissingDocs} />
            <CheckItem label="No unresolved issues" ok={noOpenIssues} />
          </div>
        </>
      )}

      {/* ================================================================
          COMPANY — Auditor / Licensed Team Package
          ================================================================ */}
      {entity.flow_type === 'COMPANY' && (
        <>
          {/* 1. Company Profile */}
          <SectionHeader title="1. Company Profile" />
          <div className="card grid grid-cols-2 sm:grid-cols-3 gap-6">
            <div>
              <p className="text-label text-ink-muted">Company Name</p>
              <p className="text-body text-ink-primary font-medium">{entity.entity_name}</p>
            </div>
            <div>
              <p className="text-label text-ink-muted">Registration No. (SSM)</p>
              <p className="text-body text-ink-primary">{entity.registration_no ?? '—'}</p>
            </div>
            <div>
              <p className="text-label text-ink-muted">Tax Reference No.</p>
              <p className="text-body text-ink-primary">{entity.tax_reference_no ?? '—'}</p>
            </div>
            <div>
              <p className="text-label text-ink-muted">Financial Year End</p>
              <p className="text-body text-ink-primary tabular-nums">{entity.financial_year_end}</p>
            </div>
            <div>
              <p className="text-label text-ink-muted">Reporting Framework</p>
              <p className="text-body text-ink-primary">{entity.reporting_framework}</p>
            </div>
            <div>
              <p className="text-label text-ink-muted">SST No.</p>
              <p className="text-body text-ink-primary">{entity.sst_no ?? '—'}</p>
            </div>
          </div>

          {/* 2. P&L Summary */}
          <SectionHeader title="2. P&L Summary (Latest Period)" />
          <div className="card">
            {latestPnl ? (
              <>
                <p className="text-label text-ink-muted mb-4">
                  Period: {formatDate(latestPnl.period_start, 'medium')} – {formatDate(latestPnl.period_end, 'medium')}
                  {latestPnl.is_final && <Badge variant="success" className="ml-3">Final</Badge>}
                </p>
                <div className="grid grid-cols-3 gap-6 text-center">
                  <div>
                    <p className="text-label text-ink-muted mb-1">Revenue</p>
                    <p className="text-section font-bold text-ink-primary tabular-nums">{formatCurrency(revenue)}</p>
                  </div>
                  <div>
                    <p className="text-label text-ink-muted mb-1">Expenses (Opex + CoS)</p>
                    <p className="text-section font-bold text-ink-primary tabular-nums">{formatCurrency(expenses)}</p>
                  </div>
                  <div>
                    <p className="text-label text-ink-muted mb-1">Net Profit</p>
                    <p className={`text-section font-bold tabular-nums ${netProfit >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                      {formatCurrency(netProfit)}
                    </p>
                  </div>
                </div>
              </>
            ) : (
              <p className="text-body text-ink-muted text-center py-4">No P&L snapshot generated yet.</p>
            )}
          </div>

          {/* 3. Unresolved Issues Register */}
          <SectionHeader title="3. Unresolved Issues Register" />
          <div className="card p-0 overflow-hidden">
            <table className="data-table w-full">
              <thead>
                <tr className="border-b border-border bg-panel">
                  <th className="px-4 py-3 text-left text-label text-ink-muted">Title</th>
                  <th className="px-4 py-3 text-left text-label text-ink-muted">Type</th>
                  <th className="px-4 py-3 text-left text-label text-ink-muted">Priority</th>
                  <th className="px-4 py-3 text-left text-label text-ink-muted">Status</th>
                  <th className="px-4 py-3 text-left text-label text-ink-muted">Period</th>
                </tr>
              </thead>
              <tbody>
                {unresolvedIssues.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-ink-muted text-body">No open issues.</td>
                  </tr>
                ) : (
                  unresolvedIssues.map(issue => (
                    <tr key={issue.id} className="border-b border-border">
                      <td className="px-4 py-2.5 text-body text-ink-primary">{issue.title}</td>
                      <td className="px-4 py-2.5 text-label text-ink-secondary">{issue.issue_type.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-2.5">
                        <Badge variant={issue.priority === 'HIGH' ? 'error' : issue.priority === 'MEDIUM' ? 'warning' : 'neutral'}>
                          {issue.priority}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={issue.status === 'OPEN' ? 'warning' : issue.status === 'IN_PROGRESS' ? 'info' : 'neutral'}>
                          {issue.status.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-label text-ink-secondary tabular-nums">{issue.period ?? '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 4. Supporting Documents Register */}
          <SectionHeader title="4. Supporting Documents Register" />
          <div className="card p-0 overflow-hidden">
            <table className="data-table w-full">
              <thead>
                <tr className="border-b border-border bg-panel">
                  <th className="px-4 py-3 text-left text-label text-ink-muted">Document Type</th>
                  <th className="px-4 py-3 text-right text-label text-ink-muted">Count</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(docsByType).length === 0 ? (
                  <tr>
                    <td colSpan={2} className="px-4 py-6 text-center text-ink-muted text-body">No supporting documents uploaded.</td>
                  </tr>
                ) : (
                  Object.entries(docsByType)
                    .sort((a, b) => a[0].localeCompare(b[0]))
                    .map(([type, count]) => (
                      <tr key={type} className="border-b border-border">
                        <td className="px-4 py-2.5 text-body text-ink-primary">{type.replace(/_/g, ' ')}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-body text-ink-secondary">{count}</td>
                      </tr>
                    ))
                )}
                {Object.keys(docsByType).length > 0 && (
                  <tr className="border-t-2 border-border bg-panel">
                    <td className="px-4 py-2.5 font-semibold text-body text-ink-primary">Total</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-body text-ink-primary">
                      {supportingDocs.length}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* 5. Monthly Close Status */}
          <SectionHeader title="5. Monthly Close Status" />
          <div className="card p-0 overflow-hidden">
            <table className="data-table w-full">
              <thead>
                <tr className="border-b border-border bg-panel">
                  <th className="px-4 py-3 text-left text-label text-ink-muted">Period</th>
                  <th className="px-4 py-3 text-left text-label text-ink-muted">Status</th>
                  <th className="px-4 py-3 text-left text-label text-ink-muted">Closed By</th>
                  <th className="px-4 py-3 text-left text-label text-ink-muted">Closed At</th>
                </tr>
              </thead>
              <tbody>
                {monthlyCloses.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-ink-muted text-body">No monthly closes found.</td>
                  </tr>
                ) : (
                  monthlyCloses.map(mc => (
                    <tr key={mc.id} className="border-b border-border">
                      <td className="px-4 py-2.5 text-body text-ink-secondary tabular-nums">
                        {formatDate(mc.period_start, 'medium')} – {formatDate(mc.period_end, 'medium')}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant={
                          mc.status === 'CLOSED'    ? 'success' :
                          mc.status === 'IN_REVIEW' ? 'info' :
                          mc.status === 'REOPENED'  ? 'warning' : 'neutral'
                        }>
                          {mc.status.replace(/_/g, ' ')}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-body text-ink-secondary">{mc.closed_by ?? '—'}</td>
                      <td className="px-4 py-2.5 text-body text-ink-secondary">
                        {mc.closed_at ? formatDate(mc.closed_at, 'medium') : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 6. Outstanding Items */}
          <SectionHeader title="6. Outstanding Items" />
          <div className="card space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-body text-ink-primary">Unclassified transactions</span>
              <span className={`tabular-nums font-semibold text-body ${unclassifiedCount > 0 ? 'text-status-error' : 'text-status-success'}`}>
                {unclassifiedCount}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-border">
              <span className="text-body text-ink-primary">Transactions with missing documents</span>
              <span className={`tabular-nums font-semibold text-body ${missingDocsCount > 0 ? 'text-status-error' : 'text-status-success'}`}>
                {missingDocsCount}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-body text-ink-primary">Open unresolved issues</span>
              <span className={`tabular-nums font-semibold text-body ${unresolvedIssues.length > 0 ? 'text-status-error' : 'text-status-success'}`}>
                {unresolvedIssues.length}
              </span>
            </div>
          </div>

          {/* 7. Pack Status */}
          <SectionHeader title="7. Pack Status" />
          <div className="card space-y-1">
            <CheckItem label="All transactions classified" ok={allClassified} />
            <CheckItem label="All monthly closes completed" ok={allClosed} />
            <CheckItem label="No unresolved issues" ok={noOpenIssues} />
            <CheckItem label="No missing supporting documents" ok={noMissingDocs} />
            <CheckItem label="Audited financials ready" ok={supportingDocs.some(d => d.document_type === 'AUDIT_REPORT' && d.verification_status === 'VERIFIED')} />
            <CheckItem label="CP204 instalments reconciled" ok={entity.filing_profiles.some(fp => fp.filing_type === 'TAX_ESTIMATE' && fp.is_active)} />
          </div>
        </>
      )}

      {/* Export Button (all flow types) */}
      <div className="mt-10 flex justify-end print:hidden">
        <button
          className="btn-primary"
          onClick={() => {
            if (typeof window !== 'undefined') window.print()
          }}
        >
          Export to PDF
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Shared Sub-components
// ---------------------------------------------------------------------------
function OutstandingItems({
  unresolvedIssues,
  unclassifiedCount,
  missingDocsCount,
}: {
  unresolvedIssues: Array<{ id: string; title: string; priority: string; status: string; issue_type: string }>
  unclassifiedCount: number
  missingDocsCount: number
}) {
  const hasAny = unresolvedIssues.length > 0 || unclassifiedCount > 0 || missingDocsCount > 0

  if (!hasAny) {
    return (
      <div className="card text-center">
        <p className="text-body text-status-success font-medium">No outstanding items. Pack is clean.</p>
      </div>
    )
  }

  return (
    <div className="card space-y-3">
      {unclassifiedCount > 0 && (
        <div className="flex items-center gap-3 py-2 border-b border-border">
          <Badge variant="error">Action Required</Badge>
          <span className="text-body text-ink-primary">
            {unclassifiedCount} unclassified transaction{unclassifiedCount !== 1 ? 's' : ''}
          </span>
        </div>
      )}
      {missingDocsCount > 0 && (
        <div className="flex items-center gap-3 py-2 border-b border-border">
          <Badge variant="warning">Missing Docs</Badge>
          <span className="text-body text-ink-primary">
            {missingDocsCount} transaction{missingDocsCount !== 1 ? 's' : ''} with missing documents
          </span>
        </div>
      )}
      {unresolvedIssues.map(issue => (
        <div key={issue.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
          <Badge variant={issue.priority === 'HIGH' ? 'error' : issue.priority === 'MEDIUM' ? 'warning' : 'neutral'}>
            {issue.priority}
          </Badge>
          <span className="text-body text-ink-primary flex-1">{issue.title}</span>
          <span className="text-label text-ink-muted">{issue.issue_type.replace(/_/g, ' ')}</span>
        </div>
      ))}
    </div>
  )
}

function CategoryBreakdownTable({
  categories,
}: {
  categories: Array<{ name: string; code: string; group: string; total: number }>
}) {
  const expenseGroups = ['COST_OF_SALES', 'OPERATING_EXPENSE', 'FINANCE_COST']
  const expenseCategories = categories.filter(c => expenseGroups.includes(c.group))

  return (
    <div className="card p-0 overflow-hidden">
      <table className="data-table w-full">
        <thead>
          <tr className="border-b border-border bg-panel">
            <th className="px-4 py-3 text-left text-label text-ink-muted">Category</th>
            <th className="px-4 py-3 text-left text-label text-ink-muted">Group</th>
            <th className="px-4 py-3 text-right text-label text-ink-muted">Total (RM)</th>
          </tr>
        </thead>
        <tbody>
          {expenseCategories.length === 0 ? (
            <tr>
              <td colSpan={3} className="px-4 py-6 text-center text-ink-muted text-body">No categorised expenses yet.</td>
            </tr>
          ) : (
            <>
              {expenseCategories.map(c => (
                <tr key={c.code} className="border-b border-border">
                  <td className="px-4 py-2.5 text-body text-ink-primary">{c.name}</td>
                  <td className="px-4 py-2.5 text-label text-ink-secondary">{c.group.replace(/_/g, ' ')}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-body text-ink-primary">
                    {formatCurrency(Math.abs(c.total))}
                  </td>
                </tr>
              ))}
              <tr className="border-t-2 border-border bg-panel">
                <td className="px-4 py-2.5 font-semibold text-body text-ink-primary" colSpan={2}>Total Expenses</td>
                <td className="px-4 py-2.5 text-right tabular-nums font-semibold text-body text-ink-primary">
                  {formatCurrency(Math.abs(expenseCategories.reduce((s, c) => s + c.total, 0)))}
                </td>
              </tr>
            </>
          )}
        </tbody>
      </table>
    </div>
  )
}

function TaxSensitiveTable({
  items,
}: {
  items: Array<{
    id: string
    txn_date: Date
    description: string
    amount: { toString(): string }
    direction: string
    tax_category: { name: string; deductible_type: string } | null
    management_note: string | null
  }>
}) {
  if (items.length === 0) {
    return (
      <div className="card text-center">
        <p className="text-body text-ink-secondary">No tax-sensitive items flagged.</p>
      </div>
    )
  }

  return (
    <div className="card p-0 overflow-hidden">
      <table className="data-table w-full">
        <thead>
          <tr className="border-b border-border bg-panel">
            <th className="px-4 py-3 text-left text-label text-ink-muted">Date</th>
            <th className="px-4 py-3 text-left text-label text-ink-muted">Description</th>
            <th className="px-4 py-3 text-right text-label text-ink-muted">Amount (RM)</th>
            <th className="px-4 py-3 text-left text-label text-ink-muted">Tax Treatment</th>
            <th className="px-4 py-3 text-left text-label text-ink-muted">Notes</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id} className="border-b border-border">
              <td className="px-4 py-2.5 text-body text-ink-secondary tabular-nums">
                {formatDate(item.txn_date, 'medium')}
              </td>
              <td className="px-4 py-2.5 text-body text-ink-primary max-w-xs truncate">{item.description}</td>
              <td className={`px-4 py-2.5 text-right tabular-nums text-body ${item.direction === 'DEBIT' ? 'text-status-error' : 'text-ink-primary'}`}>
                {item.direction === 'DEBIT' ? '-' : ''}{formatCurrency(Number(item.amount.toString()))}
              </td>
              <td className="px-4 py-2.5 text-label text-ink-secondary">
                {item.tax_category?.deductible_type?.replace(/_/g, ' ') ?? '—'}
              </td>
              <td className="px-4 py-2.5 text-label text-ink-muted max-w-xs truncate">
                {item.management_note ?? '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
