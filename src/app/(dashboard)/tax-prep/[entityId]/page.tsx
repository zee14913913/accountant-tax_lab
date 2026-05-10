'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatMYR(val: number | string | null | undefined): string {
  const n = Number(val ?? 0)
  return `RM ${n.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function progressiveTax(income: number): number {
  if (income <= 0) return 0
  const brackets = [
    { limit:    5000, rate: 0.00 },
    { limit:   20000, rate: 0.01 },
    { limit:   35000, rate: 0.03 },
    { limit:   50000, rate: 0.08 },
    { limit:   70000, rate: 0.13 },
    { limit:  100000, rate: 0.21 },
    { limit:  250000, rate: 0.24 },
    { limit:  400000, rate: 0.245 },
    { limit:  600000, rate: 0.25 },
    { limit: 1000000, rate: 0.26 },
    { limit: Infinity, rate: 0.30 },
  ]
  let tax = 0, prev = 0
  for (const b of brackets) {
    if (income <= prev) break
    tax += (Math.min(income, b.limit) - prev) * b.rate
    prev = b.limit
  }
  return tax
}

const FLOW_LABELS: Record<string, string> = {
  INDIVIDUAL_ONLY:     'Individual Only',
  INDIVIDUAL_BUSINESS: 'Individual + Business',
  PARTNERSHIP:         'Partnership',
  COMPANY:             'Company / Sdn Bhd',
}

const FLOW_BADGE: Record<string, 'neutral' | 'info' | 'warning' | 'success'> = {
  INDIVIDUAL_ONLY:     'neutral',
  INDIVIDUAL_BUSINESS: 'info',
  PARTNERSHIP:         'warning',
  COMPANY:             'success',
}

const FLOW_FORM: Record<string, string> = {
  INDIVIDUAL_ONLY:     'Form BE',
  INDIVIDUAL_BUSINESS: 'Form B',
  PARTNERSHIP:         'Form P',
  COMPANY:             'Form C',
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface TaxAdjustment {
  id:              string
  adjustment_type: string
  label:           string
  amount:          number
  is_deduction:    boolean
  lhdn_ref:        string | null
  notes:           string | null
  status:          string
}

interface TaxReliefItem {
  id:               string
  relief_category:  string
  claimed_amount:   number
  max_allowed:      number | null
  status:           string
  notes:            string | null
}

interface FixedAsset {
  id:                     string
  asset_name:             string
  asset_category:         string
  cost:                   number
  ca_rate_percentage:     number | null
  ca_initial_allowance:   number | null
  ca_annual_allowance:    number | null
  ca_accumulated_claimed: number | null
}

interface Partner {
  id:                     string
  partner_name:           string
  profit_share_percentage: number
}

interface PartnerShare {
  partner_id:    string
  partner_name:  string
  share_pct:     number
  income_share:  number
  estimated_tax: number
}

interface PnlSnapshot {
  id:                 string
  period_start:       string
  period_end:         string
  revenue_total:      number
  cogs_total:         number
  gross_profit:       number
  opex_total:         number
  other_income_total: number
  finance_cost_total: number
  net_profit:         number
  is_final:           boolean
  apportionment_json: unknown
}

interface Computation {
  net_profit:         number
  add_back_total:     number
  deduction_total:    number
  adjusted_income:    number
  total_reliefs:      number
  chargeable_income:  number
  estimated_tax:      number
  total_ca:           number
  partner_shares:     PartnerShare[]
  cp204_installments: { installment_number: number; month_offset: number; amount: number; note: string }[]
}

interface TaxPrepData {
  entity: {
    id:          string
    entity_name: string
    flow_type:   string
    client:      { legal_name: string; display_name: string | null }
  }
  assessment_year:  number
  pnl_snapshot:     PnlSnapshot | null
  tax_adjustments:  TaxAdjustment[]
  tax_relief_items: TaxReliefItem[]
  fixed_assets:     FixedAsset[]
  partners:         Partner[]
  computation:      Computation
  form_info:        { form: string; due_date: string; description: string }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function AmountCell({ amount, bold = false, negative = false }: { amount: number; bold?: boolean; negative?: boolean }) {
  const display = negative ? -amount : amount
  return (
    <span className={`tabular-nums text-right ${bold ? 'font-semibold' : ''} ${display < 0 ? 'text-status-error' : ''}`}>
      {formatMYR(display)}
    </span>
  )
}

function ComputationRow({
  label, amount, indent = false, bold = false, borderTop = false, isDeduction = false,
}: {
  label: string; amount: number; indent?: boolean; bold?: boolean; borderTop?: boolean; isDeduction?: boolean
}) {
  return (
    <div className={`flex justify-between py-2.5 ${borderTop ? 'border-t border-divider mt-1 pt-3' : ''}`}>
      <span className={`text-body ${indent ? 'pl-6 text-ink-secondary' : ''} ${bold ? 'font-semibold text-ink-primary' : 'text-ink-primary'}`}>
        {label}
      </span>
      <span className={`tabular-nums text-body ${bold ? 'font-semibold' : ''} ${amount < 0 || isDeduction ? 'text-status-error' : 'text-ink-primary'}`}>
        {isDeduction ? `(${formatMYR(amount)})` : formatMYR(amount)}
      </span>
    </div>
  )
}

function TaxAdjustmentsTable({
  adjustments,
  onUpdate,
}: {
  adjustments: TaxAdjustment[]
  onUpdate: () => void
}) {
  const [showForm,  setShowForm]  = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // New adjustment form state
  const [form, setForm] = useState({
    adjustment_type: 'ADD_BACK_NON_DEDUCTIBLE',
    label:           '',
    amount:          '',
    is_deduction:    false,
    lhdn_ref:        '',
    notes:           '',
  })

  const addBacks   = adjustments.filter(a => !a.is_deduction)
  const deductions = adjustments.filter(a => a.is_deduction)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/tax-adjustments', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          ...form,
          amount:      parseFloat(form.amount),
          is_deduction: form.is_deduction,
          created_by:  'user',
        }),
      })
      if (!res.ok) throw new Error('Failed to save')
      setShowForm(false)
      setForm({ adjustment_type: 'ADD_BACK_NON_DEDUCTIBLE', label: '', amount: '', is_deduction: false, lhdn_ref: '', notes: '' })
      onUpdate()
    } catch (err) {
      console.error(err)
    } finally {
      setSubmitting(false)
    }
  }

  function AdjGroup({ title, items }: { title: string; items: TaxAdjustment[] }) {
    if (items.length === 0) return null
    return (
      <div className="mb-4">
        <p className="text-label text-ink-muted uppercase tracking-wide mb-2">{title}</p>
        <table className="data-table w-full">
          <thead>
            <tr>
              <th className="text-left">Label</th>
              <th className="text-left">Type</th>
              <th className="text-left">LHDN Ref</th>
              <th className="text-right">Amount</th>
              <th className="text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map(a => (
              <tr key={a.id}>
                <td className="text-body text-ink-primary">{a.label}</td>
                <td className="text-label text-ink-muted">{a.adjustment_type.replace(/_/g, ' ')}</td>
                <td className="text-label text-ink-muted">{a.lhdn_ref ?? '—'}</td>
                <td className="text-right tabular-nums text-body">{formatMYR(Number(a.amount))}</td>
                <td>
                  <Badge variant={a.status === 'CONFIRMED' ? 'success' : a.status === 'SUBMITTED' ? 'info' : 'neutral'}>
                    {a.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div>
      <AdjGroup title="Add-back (Non-deductible)" items={addBacks} />
      <AdjGroup title="Deductions & Allowances"   items={deductions} />

      {adjustments.length === 0 && !showForm && (
        <p className="text-label text-ink-muted py-4 text-center">No tax adjustments recorded yet.</p>
      )}

      {!showForm ? (
        <button className="btn-secondary text-label mt-2" onClick={() => setShowForm(true)}>
          + Add Adjustment
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 card-sm p-4 space-y-3">
          <p className="text-card-title text-ink-primary font-semibold">New Tax Adjustment</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="form-label">Label *</label>
              <input
                className="form-input w-full"
                value={form.label}
                onChange={e => setForm(f => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Entertainment (non-deductible)"
                required
              />
            </div>
            <div>
              <label className="form-label">Amount (RM) *</label>
              <input
                className="form-input w-full text-right tabular-nums"
                type="number"
                step="0.01"
                min="0"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="form-label">Adjustment Type *</label>
              <select
                className="form-input w-full"
                value={form.adjustment_type}
                onChange={e => setForm(f => ({ ...f, adjustment_type: e.target.value }))}
              >
                <option value="ADD_BACK_NON_DEDUCTIBLE">Add-back: Non-deductible Expense</option>
                <option value="DEDUCT_CAPITAL_ALLOWANCE">Deduct: Capital Allowance</option>
                <option value="DEDUCT_INDUSTRIAL_BUILDING_ALLOWANCE">Deduct: Industrial Building Allowance</option>
                <option value="DEDUCT_ACCELERATED_CA">Deduct: Accelerated CA</option>
                <option value="DEDUCT_REINVESTMENT_ALLOWANCE">Deduct: Reinvestment Allowance</option>
                <option value="DEDUCT_PIONEER_STATUS_EXEMPTION">Deduct: Pioneer Status Exemption</option>
                <option value="ADD_DEEMED_INCOME">Add: Deemed Income</option>
                <option value="DEDUCT_LOSS_CARRIED_FORWARD">Deduct: Loss Carried Forward</option>
                <option value="DEDUCT_UNABSORBED_CA">Deduct: Unabsorbed CA b/f</option>
                <option value="DIRECTOR_REMUNERATION">Director Remuneration</option>
                <option value="PARTNERSHIP_APPORTIONMENT">Partnership Apportionment</option>
                <option value="OTHER_ADJUSTMENT">Other Adjustment</option>
              </select>
            </div>
            <div>
              <label className="form-label">LHDN Reference (optional)</label>
              <input
                className="form-input w-full"
                value={form.lhdn_ref}
                onChange={e => setForm(f => ({ ...f, lhdn_ref: e.target.value }))}
                placeholder="e.g. S33(1) ITA 1967"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="is_deduction"
              checked={form.is_deduction}
              onChange={e => setForm(f => ({ ...f, is_deduction: e.target.checked }))}
              className="w-4 h-4"
            />
            <label htmlFor="is_deduction" className="form-label mb-0 cursor-pointer">
              This is a deduction (reduces taxable income)
            </label>
          </div>

          <div>
            <label className="form-label">Notes (optional)</label>
            <textarea
              className="form-input w-full"
              rows={2}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            />
          </div>

          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save Adjustment'}
            </button>
            <button type="button" className="btn-ghost" onClick={() => setShowForm(false)}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

function CAScheduleTable({ assets }: { assets: FixedAsset[] }) {
  if (assets.length === 0) {
    return <p className="text-label text-ink-muted py-4 text-center">No fixed assets recorded.</p>
  }
  const totalIA    = assets.reduce((s, a) => s + Number(a.ca_initial_allowance ?? 0), 0)
  const totalAA    = assets.reduce((s, a) => s + Number(a.ca_annual_allowance   ?? 0), 0)
  const totalCA    = totalIA + totalAA
  return (
    <table className="data-table w-full">
      <thead>
        <tr>
          <th className="text-left">Asset</th>
          <th className="text-left">Category</th>
          <th className="text-right">Cost</th>
          <th className="text-right">CA Rate</th>
          <th className="text-right">Initial Allowance</th>
          <th className="text-right">Annual Allowance</th>
          <th className="text-right">Accumulated</th>
        </tr>
      </thead>
      <tbody>
        {assets.map(a => (
          <tr key={a.id}>
            <td className="text-body text-ink-primary">{a.asset_name}</td>
            <td className="text-label text-ink-muted">{a.asset_category}</td>
            <td className="text-right tabular-nums">{formatMYR(Number(a.cost))}</td>
            <td className="text-right tabular-nums">{a.ca_rate_percentage != null ? `${a.ca_rate_percentage}%` : '—'}</td>
            <td className="text-right tabular-nums">{formatMYR(Number(a.ca_initial_allowance ?? 0))}</td>
            <td className="text-right tabular-nums">{formatMYR(Number(a.ca_annual_allowance  ?? 0))}</td>
            <td className="text-right tabular-nums text-ink-muted">{formatMYR(Number(a.ca_accumulated_claimed ?? 0))}</td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t border-divider font-semibold">
          <td colSpan={4} className="text-body text-ink-primary pt-2">Total Capital Allowance (this year)</td>
          <td className="text-right tabular-nums pt-2">{formatMYR(totalIA)}</td>
          <td className="text-right tabular-nums pt-2">{formatMYR(totalAA)}</td>
          <td className="text-right tabular-nums pt-2 text-ink-primary">{formatMYR(totalCA)}</td>
        </tr>
      </tfoot>
    </table>
  )
}

function ReliefItemsTable({ items, onConfirm }: { items: TaxReliefItem[]; onConfirm: (id: string) => void }) {
  if (items.length === 0) {
    return <p className="text-label text-ink-muted py-4 text-center">No tax relief items recorded.</p>
  }
  return (
    <table className="data-table w-full">
      <thead>
        <tr>
          <th className="text-left">Relief Category</th>
          <th className="text-right">Claimed (RM)</th>
          <th className="text-right">Max Allowed (RM)</th>
          <th className="text-left">Status</th>
          <th className="text-left">Action</th>
        </tr>
      </thead>
      <tbody>
        {items.map(r => (
          <tr key={r.id}>
            <td className="text-body text-ink-primary">{r.relief_category.replace(/_/g, ' ')}</td>
            <td className="text-right tabular-nums">{formatMYR(Number(r.claimed_amount))}</td>
            <td className="text-right tabular-nums text-ink-muted">
              {r.max_allowed != null ? formatMYR(Number(r.max_allowed)) : '—'}
            </td>
            <td>
              <Badge variant={r.status === 'CONFIRMED' ? 'success' : r.status === 'SUBMITTED' ? 'info' : 'neutral'}>
                {r.status}
              </Badge>
            </td>
            <td>
              {r.status === 'DRAFT' && (
                <button
                  className="btn-ghost text-label"
                  onClick={() => onConfirm(r.id)}
                >
                  Confirm
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t border-divider font-semibold">
          <td className="text-body text-ink-primary pt-2">Total Reliefs</td>
          <td className="text-right tabular-nums pt-2">
            {formatMYR(items.reduce((s, r) => s + Number(r.claimed_amount), 0))}
          </td>
          <td colSpan={3} />
        </tr>
      </tfoot>
    </table>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TaxPrepWorkbenchPage({ params }: { params: { entityId: string } }) {
  const router = useRouter()

  const [assessmentYear, setAssessmentYear] = useState(new Date().getFullYear())
  const [data,           setData]           = useState<TaxPrepData | null>(null)
  const [loading,        setLoading]        = useState(true)
  const [error,          setError]          = useState<string | null>(null)
  const [generating,     setGenerating]     = useState(false)
  const [genSuccess,     setGenSuccess]     = useState(false)

  // INDIVIDUAL_ONLY: manual employment income input
  const [employmentIncome, setEmploymentIncome] = useState<string>('')

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/tax-prep/${params.entityId}?assessment_year=${assessmentYear}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(json => setData(json.data ?? null))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [params.entityId, assessmentYear])

  useEffect(() => { load() }, [load])

  async function handleGenerateTaxPack() {
    setGenerating(true)
    setGenSuccess(false)
    try {
      const res = await fetch(`/api/tax-prep/${params.entityId}/generate`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ assessment_year: assessmentYear, actor_id: 'user' }),
      })
      if (!res.ok) throw new Error('Failed to queue')
      setGenSuccess(true)
    } catch (err) {
      console.error(err)
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="page-content">
        <div className="p-12 text-center text-ink-muted">Loading tax prep data…</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="page-content">
        <div className="p-12 text-center">
          <p className="text-body text-status-error mb-4">{error ?? 'Entity not found'}</p>
          <button className="btn-secondary" onClick={() => router.push('/tax-prep')}>← Back</button>
        </div>
      </div>
    )
  }

  const { entity, computation, pnl_snapshot, tax_adjustments, tax_relief_items, fixed_assets, partners, form_info } = data
  const flowType = entity.flow_type

  const clientName = entity.client.display_name ?? entity.client.legal_name

  // INDIVIDUAL_ONLY: EPF deduction (11%, capped RM4,000)
  const empInc       = parseFloat(employmentIncome) || 0
  const epfDeduction = Math.min(empInc * 0.11, 4000)
  const indReliefsTotal = tax_relief_items.reduce((s, r) => s + Number(r.claimed_amount), 0)
  const beChargeableIncome = Math.max(empInc - epfDeduction - indReliefsTotal, 0)
  const beTax              = progressiveTax(beChargeableIncome)

  // Year selector options
  const yearOptions = Array.from({ length: 7 }, (_, i) => new Date().getFullYear() - 3 + i)

  return (
    <div className="page-content">
      {/* ── Page Header ───────────────────────────────────────────────── */}
      <div className="page-header flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <button
              className="btn-ghost text-label"
              onClick={() => router.push('/tax-prep')}
            >
              ← Back
            </button>
          </div>
          <h1 className="page-title">{entity.entity_name}</h1>
          <p className="text-label text-ink-muted mt-1">
            {clientName} · {FLOW_LABELS[flowType] ?? flowType}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <Badge variant={FLOW_BADGE[flowType] ?? 'neutral'}>{FLOW_FORM[flowType] ?? flowType}</Badge>
          <select
            className="form-input w-36"
            value={assessmentYear}
            onChange={e => setAssessmentYear(parseInt(e.target.value))}
          >
            {yearOptions.map(y => (
              <option key={y} value={y}>YA {y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Filing Info Banner ───────────────────────────────────────── */}
      <div className="card-sm p-3 mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-label font-semibold text-ink-primary">{form_info.form}&ensp;</span>
          <span className="text-label text-ink-muted">·&ensp;Due: {form_info.due_date}&ensp;·&ensp;{form_info.description}</span>
        </div>
        <Badge variant="neutral">YA {assessmentYear}</Badge>
      </div>

      {/* ══════════════════════════════════════════════════════════════
          FLOW: INDIVIDUAL_ONLY → Form BE
      ══════════════════════════════════════════════════════════════ */}
      {flowType === 'INDIVIDUAL_ONLY' && (
        <div className="space-y-5">
          {/* Section A: Employment Income */}
          <Card>
            <CardHeader><CardTitle>Section A — Employment Income</CardTitle></CardHeader>
            <CardContent>
              <div className="card-sm p-3 mb-4">
                <p className="text-label text-ink-muted">
                  Individual-only entities: income is from employment only. Ensure EA Form (Form E) is
                  obtained from employer before proceeding. Enter your total gross employment income below.
                </p>
              </div>
              <div className="max-w-xs">
                <label className="form-label">Total Gross Employment Income (RM)</label>
                <input
                  className="form-input w-full text-right tabular-nums"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={employmentIncome}
                  onChange={e => setEmploymentIncome(e.target.value)}
                />
                <p className="text-label text-ink-muted mt-1">From EA Form / payslips</p>
              </div>
            </CardContent>
          </Card>

          {/* Section B: Personal Reliefs */}
          <Card>
            <CardHeader><CardTitle>Section B — Personal Reliefs</CardTitle></CardHeader>
            <CardContent>
              <ReliefItemsTable
                items={tax_relief_items}
                onConfirm={id => {
                  fetch(`/api/tax-relief-items/${id}`, {
                    method:  'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({ status: 'CONFIRMED' }),
                  }).then(() => load())
                }}
              />
            </CardContent>
          </Card>

          {/* Section C: Chargeable Income Computation */}
          <Card>
            <CardHeader><CardTitle>Section C — Chargeable Income Computation</CardTitle></CardHeader>
            <CardContent className="max-w-md">
              <ComputationRow label="Gross Employment Income"         amount={empInc} bold />
              <ComputationRow label="Less: EPF (11%, capped RM4,000)" amount={epfDeduction} indent isDeduction />
              <ComputationRow label="Less: Personal Reliefs"          amount={indReliefsTotal} indent isDeduction />
              <div className="divider" />
              <ComputationRow label="Chargeable Income"               amount={beChargeableIncome} bold borderTop />
              <div className="divider mt-2" />
              <ComputationRow label="Estimated Tax Payable"           amount={beTax} bold borderTop />
              <p className="text-label text-ink-muted mt-3">
                Progressive rates 0%–30% applied on chargeable income. Excludes rebates, zakat, and
                tax credits which reduce final tax payable.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          FLOW: INDIVIDUAL_BUSINESS → Form B
      ══════════════════════════════════════════════════════════════ */}
      {flowType === 'INDIVIDUAL_BUSINESS' && (
        <div className="space-y-5">
          {/* Section A: Schedule B Business Income */}
          <Card>
            <CardHeader><CardTitle>Section A — Schedule B: Business Income</CardTitle></CardHeader>
            <CardContent>
              {!pnl_snapshot ? (
                <p className="text-label text-ink-muted py-4">No finalised P&L found for YA {assessmentYear}. Generate P&L first.</p>
              ) : (
                <div className="max-w-md">
                  <ComputationRow label="Gross Business Income (Revenue)" amount={Number(pnl_snapshot.revenue_total)} bold />
                  <ComputationRow label="Less: Allowable Expenses (OPEX)" amount={Number(pnl_snapshot.opex_total)} indent isDeduction />
                  <div className="divider" />
                  <ComputationRow label="Adjusted Business Income"        amount={Number(pnl_snapshot.net_profit)} bold borderTop />
                  <p className="text-label text-ink-muted mt-2">
                    Period: {new Date(pnl_snapshot.period_start).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })} –{' '}
                    {new Date(pnl_snapshot.period_end).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {pnl_snapshot.is_final && <span className="ml-2"><Badge variant="success">Final</Badge></span>}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section B: Tax Adjustments */}
          <Card>
            <CardHeader><CardTitle>Section B — Tax Adjustments</CardTitle></CardHeader>
            <CardContent>
              <TaxAdjustmentsTable
                adjustments={tax_adjustments}
                onUpdate={load}
              />
              {tax_adjustments.length > 0 && (
                <div className="mt-4 max-w-xs">
                  <div className="divider" />
                  <ComputationRow label="Net Profit"         amount={computation.net_profit} bold />
                  <ComputationRow label="Add: Add-backs"     amount={computation.add_back_total}   indent />
                  <ComputationRow label="Less: Deductions"   amount={computation.deduction_total}   indent isDeduction />
                  <ComputationRow label="Adjusted Income"    amount={computation.adjusted_income}   bold borderTop />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section C: Capital Allowance */}
          <Card>
            <CardHeader><CardTitle>Section C — Capital Allowance Schedule</CardTitle></CardHeader>
            <CardContent>
              <CAScheduleTable assets={fixed_assets} />
            </CardContent>
          </Card>

          {/* Section D: Personal Reliefs */}
          <Card>
            <CardHeader><CardTitle>Section D — Personal Reliefs</CardTitle></CardHeader>
            <CardContent>
              <ReliefItemsTable
                items={tax_relief_items}
                onConfirm={id => {
                  fetch(`/api/tax-relief-items/${id}`, {
                    method:  'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({ status: 'CONFIRMED' }),
                  }).then(() => load())
                }}
              />
            </CardContent>
          </Card>

          {/* Section E: Chargeable Income */}
          <Card>
            <CardHeader><CardTitle>Section E — Chargeable Income Computation</CardTitle></CardHeader>
            <CardContent className="max-w-md">
              <ComputationRow label="Adjusted Business Income"            amount={computation.adjusted_income} bold />
              <ComputationRow label="Less: Capital Allowances"            amount={computation.total_ca}         indent isDeduction />
              <ComputationRow label="Less: Losses Brought Forward"        amount={0}                            indent isDeduction />
              <div className="divider" />
              <ComputationRow label="Statutory Business Income"           amount={Math.max(computation.adjusted_income - computation.total_ca, 0)} bold borderTop />
              <ComputationRow label="Less: Personal Reliefs"              amount={computation.total_reliefs}    indent isDeduction />
              <div className="divider" />
              <ComputationRow label="Chargeable Income"                   amount={computation.chargeable_income} bold borderTop />
              <div className="divider mt-2" />
              <ComputationRow label="Estimated Tax Payable (progressive)" amount={computation.estimated_tax}    bold borderTop />
              <p className="text-label text-ink-muted mt-3">
                Progressive rates 0%–30%. Form B due 30 June {assessmentYear + 1}.
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          FLOW: PARTNERSHIP → Form P
      ══════════════════════════════════════════════════════════════ */}
      {flowType === 'PARTNERSHIP' && (
        <div className="space-y-5">
          {/* Section A: Partnership P&L */}
          <Card>
            <CardHeader><CardTitle>Section A — Partnership P&L Summary</CardTitle></CardHeader>
            <CardContent>
              {!pnl_snapshot ? (
                <p className="text-label text-ink-muted py-4">No finalised P&L found for YA {assessmentYear}. Generate P&L first.</p>
              ) : (
                <div className="max-w-md">
                  <ComputationRow label="Revenue"                    amount={Number(pnl_snapshot.revenue_total)} bold />
                  <ComputationRow label="Less: Cost of Sales"        amount={Number(pnl_snapshot.cogs_total)} indent isDeduction />
                  <ComputationRow label="Gross Profit"               amount={Number(pnl_snapshot.gross_profit)} bold borderTop />
                  <ComputationRow label="Less: Operating Expenses"   amount={Number(pnl_snapshot.opex_total)} indent isDeduction />
                  {Number(pnl_snapshot.other_income_total) !== 0 && (
                    <ComputationRow label="Plus: Other Income"       amount={Number(pnl_snapshot.other_income_total)} indent />
                  )}
                  {Number(pnl_snapshot.finance_cost_total) !== 0 && (
                    <ComputationRow label="Less: Finance Cost"       amount={Number(pnl_snapshot.finance_cost_total)} indent isDeduction />
                  )}
                  <div className="divider" />
                  <ComputationRow label="Net Profit"                 amount={Number(pnl_snapshot.net_profit)} bold borderTop />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section B: Tax Adjustments */}
          <Card>
            <CardHeader><CardTitle>Section B — Tax Adjustments</CardTitle></CardHeader>
            <CardContent>
              <TaxAdjustmentsTable adjustments={tax_adjustments} onUpdate={load} />
              {tax_adjustments.length > 0 && (
                <div className="mt-4 max-w-xs">
                  <div className="divider" />
                  <ComputationRow label="Net Profit"      amount={computation.net_profit}       bold />
                  <ComputationRow label="Add: Add-backs"  amount={computation.add_back_total}    indent />
                  <ComputationRow label="Less: Deductions" amount={computation.deduction_total}   indent isDeduction />
                  <ComputationRow label="Adjusted Income" amount={computation.adjusted_income}   bold borderTop />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section C: Capital Allowance */}
          <Card>
            <CardHeader><CardTitle>Section C — Capital Allowance Schedule</CardTitle></CardHeader>
            <CardContent>
              <CAScheduleTable assets={fixed_assets} />
            </CardContent>
          </Card>

          {/* Section D: Apportionment */}
          <Card>
            <CardHeader><CardTitle>Section D — Partnership Income Apportionment</CardTitle></CardHeader>
            <CardContent>
              {partners.length === 0 ? (
                <p className="text-label text-ink-muted py-4">No partners configured for this entity.</p>
              ) : (
                <>
                  <table className="data-table w-full">
                    <thead>
                      <tr>
                        <th className="text-left">Partner Name</th>
                        <th className="text-right">Share %</th>
                        <th className="text-right">Net Profit Share</th>
                        <th className="text-right">Adjusted Income Share</th>
                        <th className="text-left">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {computation.partner_shares.map(p => (
                        <tr key={p.partner_id}>
                          <td className="text-body text-ink-primary">{p.partner_name}</td>
                          <td className="text-right tabular-nums">{p.share_pct.toFixed(2)}%</td>
                          <td className="text-right tabular-nums">{formatMYR(computation.net_profit * p.share_pct / 100)}</td>
                          <td className="text-right tabular-nums">{formatMYR(p.income_share)}</td>
                          <td className="text-label text-ink-muted">Files Form B/BE separately</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="card-sm p-3 mt-4">
                    <p className="text-label text-ink-muted">
                      Total partner shares must equal 100%. Each partner includes their share in their
                      personal Form B (if business) or Form BE (if employment only).
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Section E: Note */}
          <Card>
            <CardHeader><CardTitle>Section E — Filing Note</CardTitle></CardHeader>
            <CardContent>
              <div className="card-sm p-3">
                <p className="text-body text-ink-secondary">
                  <strong>Form P</strong> shows the partnership-level income computation. It is not a tax
                  return on which tax is assessed at the partnership level.
                </p>
                <p className="text-label text-ink-muted mt-2">
                  Each partner <strong>files their own Form B or Form BE</strong> separately, including
                  their apportioned share of partnership income. Form P due 30 June {assessmentYear + 1}.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════
          FLOW: COMPANY → Form C + CP204
      ══════════════════════════════════════════════════════════════ */}
      {flowType === 'COMPANY' && (
        <div className="space-y-5">
          {/* Section A: Accounting Profit */}
          <Card>
            <CardHeader><CardTitle>Section A — Accounting Profit (P&L)</CardTitle></CardHeader>
            <CardContent>
              {!pnl_snapshot ? (
                <p className="text-label text-ink-muted py-4">No finalised P&L found for YA {assessmentYear}. Generate P&L first.</p>
              ) : (
                <div className="max-w-md">
                  <ComputationRow label="Revenue"                  amount={Number(pnl_snapshot.revenue_total)} bold />
                  <ComputationRow label="Less: Cost of Sales"      amount={Number(pnl_snapshot.cogs_total)} indent isDeduction />
                  <ComputationRow label="Gross Profit"             amount={Number(pnl_snapshot.gross_profit)} bold borderTop />
                  <ComputationRow label="Less: Operating Expenses" amount={Number(pnl_snapshot.opex_total)} indent isDeduction />
                  {Number(pnl_snapshot.other_income_total) !== 0 && (
                    <ComputationRow label="Plus: Other Income"     amount={Number(pnl_snapshot.other_income_total)} indent />
                  )}
                  {Number(pnl_snapshot.finance_cost_total) !== 0 && (
                    <ComputationRow label="Less: Finance Cost"     amount={Number(pnl_snapshot.finance_cost_total)} indent isDeduction />
                  )}
                  <div className="divider" />
                  <ComputationRow label="Net Profit (Accounting)"  amount={Number(pnl_snapshot.net_profit)} bold borderTop />
                  <p className="text-label text-ink-muted mt-2">
                    Period: {new Date(pnl_snapshot.period_start).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })} –{' '}
                    {new Date(pnl_snapshot.period_end).toLocaleDateString('en-MY', { day: 'numeric', month: 'short', year: 'numeric' })}
                    {pnl_snapshot.is_final && <span className="ml-2"><Badge variant="success">Final</Badge></span>}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section B: Tax Adjustments */}
          <Card>
            <CardHeader><CardTitle>Section B — Tax Adjustments</CardTitle></CardHeader>
            <CardContent>
              <TaxAdjustmentsTable adjustments={tax_adjustments} onUpdate={load} />
              {(pnl_snapshot || tax_adjustments.length > 0) && (
                <div className="mt-4 max-w-xs">
                  <div className="divider" />
                  <ComputationRow label="Net Profit (Accounting)"   amount={computation.net_profit}      bold />
                  <ComputationRow label="Add: Non-deductible items" amount={computation.add_back_total}   indent />
                  <ComputationRow label="Less: Deductions / CA"     amount={computation.deduction_total}  indent isDeduction />
                  <ComputationRow label="Adjusted Income"           amount={computation.adjusted_income}  bold borderTop />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section C: CA Schedule */}
          <Card>
            <CardHeader><CardTitle>Section C — Capital Allowance Schedule</CardTitle></CardHeader>
            <CardContent>
              <CAScheduleTable assets={fixed_assets} />
            </CardContent>
          </Card>

          {/* Section D: Tax Computation */}
          <Card>
            <CardHeader><CardTitle>Section D — Corporate Tax Computation</CardTitle></CardHeader>
            <CardContent className="max-w-md">
              <ComputationRow label="Adjusted Income"                     amount={computation.adjusted_income}  bold />
              <ComputationRow label="Less: Unabsorbed Losses b/f"         amount={0}                            indent isDeduction />
              <ComputationRow label="Less: Unabsorbed Capital Allowances" amount={0}                            indent isDeduction />
              <div className="divider" />
              <ComputationRow label="Chargeable Income"                   amount={computation.chargeable_income} bold borderTop />
              <div className="divider mt-3" />

              {/* Tax breakdown */}
              <p className="text-label text-ink-muted uppercase tracking-wide mt-3 mb-2">Tax Computation (SME Rates)</p>
              {computation.chargeable_income > 0 && (
                <>
                  <ComputationRow
                    label={`17% on first RM150,000`}
                    amount={Math.min(computation.chargeable_income, 150000) * 0.17}
                    indent
                  />
                  {computation.chargeable_income > 150000 && (
                    <ComputationRow
                      label={`24% on RM${(computation.chargeable_income - 150000).toLocaleString('en-MY', { minimumFractionDigits: 2 })}`}
                      amount={(computation.chargeable_income - 150000) * 0.24}
                      indent
                    />
                  )}
                </>
              )}
              <div className="divider" />
              <ComputationRow label="Estimated Tax Payable"               amount={computation.estimated_tax}    bold borderTop />
              <div className="card-sm p-2 mt-3">
                <p className="text-label text-ink-muted">
                  SME rate applies where paid-up capital ≤ RM2.5M and is not related / controlled by
                  a company with paid-up capital exceeding RM2.5M (s.2C ITA 1967).
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Section E: CP204 Installment Schedule */}
          <Card>
            <CardHeader><CardTitle>Section E — CP204 Installment Schedule</CardTitle></CardHeader>
            <CardContent>
              <div className="card-sm p-3 mb-4">
                <p className="text-label text-ink-muted">
                  CP204 installments are due every 2 months, starting from the 2nd month of the
                  financial year. Total annual tax divided into 12 monthly installments, paid
                  bi-monthly (6 payments).
                </p>
              </div>
              {computation.estimated_tax === 0 ? (
                <p className="text-label text-ink-muted py-2">No estimated tax — CP204 not required.</p>
              ) : (
                <table className="data-table w-full">
                  <thead>
                    <tr>
                      <th className="text-left">Installment</th>
                      <th className="text-left">Due (Month Offset)</th>
                      <th className="text-right">Amount (RM)</th>
                      <th className="text-left">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {computation.cp204_installments.map(inst => (
                      <tr key={inst.installment_number}>
                        <td className="text-body text-ink-primary">Installment {inst.installment_number}</td>
                        <td className="text-label text-ink-muted">Month {inst.month_offset} of FY</td>
                        <td className="text-right tabular-nums">{formatMYR(inst.amount)}</td>
                        <td className="text-label text-ink-muted">{inst.note}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-divider font-semibold">
                      <td colSpan={2} className="pt-2 text-body text-ink-primary">Total Annual Tax</td>
                      <td className="text-right tabular-nums pt-2">{formatMYR(computation.estimated_tax)}</td>
                      <td />
                    </tr>
                  </tfoot>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Bottom Actions ─────────────────────────────────────────── */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button
          className="btn-primary"
          onClick={handleGenerateTaxPack}
          disabled={generating}
        >
          {generating ? 'Queuing…' : 'Generate Tax Pack'}
        </button>
        <button
          className="btn-secondary"
          onClick={() => router.push('/auditor-pack')}
        >
          View Auditor Pack
        </button>
        {genSuccess && (
          <span className="text-label text-status-success">
            Tax pack generation queued successfully.
          </span>
        )}
      </div>
    </div>
  )
}
