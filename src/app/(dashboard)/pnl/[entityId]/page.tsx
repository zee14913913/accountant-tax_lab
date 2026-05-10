export const dynamic = 'force-dynamic'

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { formatCurrency, FLOW_TYPE_LABELS } from '@/lib/utils'
import { ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react'

function PnlRow({ label, amount, indent = false, bold = false, borderTop = false }: {
  label: string; amount: number | null; indent?: boolean; bold?: boolean; borderTop?: boolean
}) {
  const value = amount ?? 0
  return (
    <div className={`flex items-center justify-between py-2.5 ${borderTop ? 'border-t border-divider mt-1 pt-3' : ''}`}>
      <span className={`text-body ${indent ? 'pl-6 text-ink-secondary' : ''} ${bold ? 'font-semibold text-ink-primary' : 'text-ink-primary'}`}>
        {label}
      </span>
      <span className={`tabular-nums text-body ${bold ? 'font-semibold' : ''} ${value < 0 ? 'text-status-error' : value > 0 ? 'text-ink-primary' : 'text-ink-muted'}`}>
        {value === 0 ? '—' : formatCurrency(value)}
      </span>
    </div>
  )
}

interface ApportionmentEntry {
  partner_id:       string
  name:             string
  share_pct:        number
  allocated_profit: number
}

export default async function PnlPage({ params, searchParams }: {
  params: { entityId: string }
  searchParams: { snapshot_id?: string }
}) {
  const entity = await prisma.entity.findFirst({
    where: { id: params.entityId, archived_at: null },
    include: { client: { select: { legal_name: true } } },
  })

  if (!entity) notFound()

  if (entity.flow_type === 'INDIVIDUAL_ONLY') {
    return (
      <div className="max-w-xl mx-auto mt-16 text-center">
        <p className="text-body text-ink-secondary">P&L is not applicable for Individual (Non-Business) entities.</p>
        <Link href={`/tax-prep/${entity.id}`} className="btn-primary mt-6 inline-flex">View Tax Prep →</Link>
      </div>
    )
  }

  // Get latest snapshot, or specific one
  const snapshot = searchParams.snapshot_id
    ? await prisma.pnlSnapshot.findFirst({ where: { id: searchParams.snapshot_id, entity_id: entity.id } })
    : await prisma.pnlSnapshot.findFirst({
        where:   { entity_id: entity.id },
        orderBy: { generated_at: 'desc' },
      })

  // Get all snapshots for period selector
  const allSnapshots = await prisma.pnlSnapshot.findMany({
    where:   { entity_id: entity.id },
    orderBy: { period_start: 'desc' },
    take:    24,
  })

  return (
    <div>
      {/* Back Nav */}
      <div className="mb-6">
        <Link href={`/accounting-assistant/${entity.id}`} className="btn-ghost text-ink-muted">
          <ArrowLeft size={16} />
          Back to Workbench
        </Link>
      </div>

      {/* Page Header */}
      <div className="page-header flex items-start justify-between">
        <div>
          <h1 className="page-title">Profit & Loss</h1>
          <p className="page-subtitle">{entity.entity_name} · {entity.client?.legal_name} · {FLOW_TYPE_LABELS[entity.flow_type]}</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Period Selector */}
          <select
            className="form-input w-56 py-1.5 text-label"
            defaultValue={snapshot?.id ?? ''}
            onChange={e => {
              if (e.target.value) window.location.href = `?snapshot_id=${e.target.value}`
            }}
          >
            <option value="">— Select period —</option>
            {allSnapshots.map(s => (
              <option key={s.id} value={s.id}>
                {new Date(s.period_start).toLocaleDateString('en-MY', { month: 'short', year: 'numeric' })} –
                {new Date(s.period_end).toLocaleDateString('en-MY', { month: 'short', year: 'numeric' })}
                {s.is_final ? ' ✓' : ' (draft)'}
              </option>
            ))}
          </select>

          {/* Generate Button */}
          <button className="btn-primary">Generate P&L</button>
        </div>
      </div>

      {!snapshot ? (
        <Card className="text-center py-16">
          <p className="text-body text-ink-secondary mb-4">No P&L generated yet for this entity.</p>
          <p className="text-label text-ink-muted">
            Classify transactions first, then click "Generate P&L" to compute the income statement.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* P&L Statement */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Income Statement</CardTitle>
                    <p className="text-label text-ink-muted mt-0.5">
                      {new Date(snapshot.period_start).toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' })} –
                      {new Date(snapshot.period_end).toLocaleDateString('en-MY', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="neutral">{snapshot.basis}</Badge>
                    {snapshot.is_final && <Badge variant="success">Final</Badge>}
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                {/* REVENUE */}
                <div className="mb-2">
                  <p className="text-label text-ink-muted uppercase tracking-wide mb-2">Revenue</p>
                  <PnlRow label="Total Revenue"         amount={Number(snapshot.revenue_total ?? 0)} bold />
                </div>

                {/* COGS (only for COMPANY and PARTNERSHIP) */}
                {entity.flow_type !== 'INDIVIDUAL_BUSINESS' && (
                  <div className="mb-2">
                    <div className="divider" />
                    <p className="text-label text-ink-muted uppercase tracking-wide mb-2">Cost of Sales</p>
                    <PnlRow label="Total Cost of Sales"  amount={-Number(snapshot.cogs_total ?? 0)} indent />
                    <PnlRow label="Gross Profit"         amount={Number(snapshot.gross_profit ?? 0)} bold borderTop />
                  </div>
                )}

                {/* OPEX */}
                <div className="mb-2">
                  <div className="divider" />
                  <p className="text-label text-ink-muted uppercase tracking-wide mb-2">Operating Expenses</p>
                  <PnlRow label="Total Operating Expenses" amount={-Number(snapshot.opex_total ?? 0)} indent />
                </div>

                {/* OTHER INCOME */}
                {Number(snapshot.other_income_total ?? 0) !== 0 && (
                  <div className="mb-2">
                    <div className="divider" />
                    <p className="text-label text-ink-muted uppercase tracking-wide mb-2">Other Income</p>
                    <PnlRow label="Total Other Income"    amount={Number(snapshot.other_income_total ?? 0)} indent />
                  </div>
                )}

                {/* FINANCE COST */}
                {Number(snapshot.finance_cost_total ?? 0) !== 0 && (
                  <div className="mb-2">
                    <div className="divider" />
                    <p className="text-label text-ink-muted uppercase tracking-wide mb-2">Finance Cost</p>
                    <PnlRow label="Total Finance Cost"    amount={-Number(snapshot.finance_cost_total ?? 0)} indent />
                  </div>
                )}

                {/* NET PROFIT */}
                <div className="divider" />
                <div className="flex items-center justify-between py-3 bg-panel px-4 rounded-card mt-2">
                  <span className="text-section font-bold text-ink-primary">Net Profit / (Loss)</span>
                  <div className="flex items-center gap-2">
                    {Number(snapshot.net_profit ?? 0) >= 0
                      ? <TrendingUp size={18} className="text-status-success" />
                      : <TrendingDown size={18} className="text-status-error" />
                    }
                    <span className={`text-section font-bold tabular-nums ${Number(snapshot.net_profit ?? 0) >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                      {formatCurrency(Number(snapshot.net_profit ?? 0))}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Info + Apportionment */}
          <div className="space-y-4">
            {/* Snapshot Info */}
            <Card size="sm">
              <h3 className="text-card-title text-ink-primary mb-3">Snapshot Info</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-label text-ink-muted">Generated</span>
                  <span className="text-label text-ink-secondary">
                    {new Date(snapshot.generated_at).toLocaleDateString('en-MY')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-label text-ink-muted">Basis</span>
                  <span className="text-label text-ink-secondary">{snapshot.basis}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-label text-ink-muted">Status</span>
                  <Badge variant={snapshot.is_final ? 'success' : 'neutral'}>
                    {snapshot.is_final ? 'Final' : 'Draft'}
                  </Badge>
                </div>
              </div>
            </Card>

            {/* PARTNERSHIP: Apportionment */}
            {entity.flow_type === 'PARTNERSHIP' && snapshot.apportionment_json && (
              <Card size="sm">
                <h3 className="text-card-title text-ink-primary mb-3">Profit Apportionment</h3>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th className="py-2 px-0">Partner</th>
                      <th className="py-2 px-2 text-right">Share</th>
                      <th className="py-2 px-2 text-right">Allocated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {((snapshot.apportionment_json as { partners: ApportionmentEntry[] }).partners ?? []).map((p: ApportionmentEntry) => (
                      <tr key={p.partner_id}>
                        <td className="py-2 px-0 text-body text-ink-primary">{p.name}</td>
                        <td className="py-2 px-2 text-right text-label tabular-nums">{p.share_pct.toFixed(2)}%</td>
                        <td className={`py-2 px-2 text-right text-label tabular-nums font-medium ${p.allocated_profit >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                          {formatCurrency(p.allocated_profit)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}

            {/* Quick Actions */}
            <Card size="sm">
              <h3 className="text-card-title text-ink-primary mb-3">Actions</h3>
              <div className="space-y-2">
                <Link href={`/tax-prep/${entity.id}`} className="btn-secondary w-full justify-center">
                  Go to Tax Prep →
                </Link>
                <Link href={`/monthly-close?entity_id=${entity.id}`} className="btn-secondary w-full justify-center">
                  Monthly Close →
                </Link>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
