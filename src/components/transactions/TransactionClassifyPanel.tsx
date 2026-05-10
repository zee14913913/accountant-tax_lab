'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Check, AlertCircle, ChevronDown } from 'lucide-react'

interface AccountingCategory {
  id: string; code: string; name: string; report_group: string
}
interface TaxCategory {
  id: string; code: string; name: string; deductible_type: string
}
interface Counterparty {
  id: string; name: string; type: string
}

interface TxnProps {
  id:                     string
  accounting_category_id: string | null
  accounting_category:    AccountingCategory | null
  tax_category_id:        string | null
  tax_category:           TaxCategory | null
  counterparty_id:        string | null
  counterparty:           Counterparty | null
  document_status:        string
  review_status:          string
  risk_flag:              string | null
  management_note:        string | null
  direction:              string
  amount:                 number
  flow_type:              string
}

interface Props {
  txn:                  TxnProps
  accountingCategories: AccountingCategory[]
  taxCategories:        TaxCategory[]
  counterparties:       Counterparty[]
}

// Group accounting categories by report_group for display
function groupByReportGroup(cats: AccountingCategory[]) {
  const groups: Record<string, AccountingCategory[]> = {}
  for (const cat of cats) {
    if (!groups[cat.report_group]) groups[cat.report_group] = []
    groups[cat.report_group].push(cat)
  }
  return groups
}

const REPORT_GROUP_LABELS: Record<string, string> = {
  REVENUE:                  'Revenue',
  COST_OF_SALES:            'Cost of Sales',
  OPERATING_EXPENSE:        'Operating Expense',
  OTHER_INCOME:             'Other Income',
  FINANCE_COST:             'Finance Cost',
  TAX_EXPENSE:              'Tax Expense',
  BALANCE_SHEET_ASSET:      'Balance Sheet — Asset',
  BALANCE_SHEET_LIABILITY:  'Balance Sheet — Liability',
  BALANCE_SHEET_EQUITY:     'Balance Sheet — Equity',
}

const DEDUCTIBLE_TYPE_LABELS: Record<string, string> = {
  FULLY_DEDUCTIBLE:     'Fully Deductible',
  PARTIALLY_DEDUCTIBLE: 'Partially Deductible (50% Rule)',
  NON_DEDUCTIBLE:       'Non-Deductible',
  CAPITAL_ALLOWANCE:    'Capital Allowance',
  PERSONAL_RELIEF:      'Personal Relief',
  NOT_APPLICABLE:       'N/A',
}

export function TransactionClassifyPanel({ txn, accountingCategories, taxCategories, counterparties }: Props) {
  const router = useRouter()

  const [state, setState] = useState({
    accounting_category_id: txn.accounting_category_id ?? '',
    tax_category_id:        txn.tax_category_id ?? '',
    counterparty_id:        txn.counterparty_id ?? '',
    document_status:        txn.document_status,
    review_status:          txn.review_status,
    risk_flag:              txn.risk_flag ?? '',
    management_note:        txn.management_note ?? '',
  })

  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const grouped = groupByReportGroup(accountingCategories)

  // Determine which report groups are relevant based on direction + flow_type
  const relevantGroups = txn.direction === 'DEBIT'
    ? ['COST_OF_SALES', 'OPERATING_EXPENSE', 'FINANCE_COST', 'TAX_EXPENSE', 'BALANCE_SHEET_ASSET', 'BALANCE_SHEET_LIABILITY']
    : ['REVENUE', 'OTHER_INCOME', 'BALANCE_SHEET_ASSET', 'BALANCE_SHEET_LIABILITY', 'BALANCE_SHEET_EQUITY']

  // For INDIVIDUAL_ONLY, exclude COGS
  const finalGroups = txn.flow_type === 'INDIVIDUAL_ONLY'
    ? relevantGroups.filter(g => g !== 'COST_OF_SALES')
    : relevantGroups

  const handleSave = async () => {
    setSaving(true)
    setSaved(false)
    setError(null)

    try {
      const res = await fetch(`/api/transactions/${txn.id}/classify`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accounting_category_id: state.accounting_category_id || null,
          tax_category_id:        state.tax_category_id || null,
          counterparty_id:        state.counterparty_id || null,
          document_status:        state.document_status,
          review_status:          state.review_status,
          risk_flag:              state.risk_flag || null,
          management_note:        state.management_note,
          actor_id:               'system',
        }),
      })

      if (!res.ok) {
        const j = await res.json()
        setError(j.error ?? 'Save failed')
        return
      }

      setSaved(true)
      router.refresh()
      setTimeout(() => setSaved(false), 3000)
    } catch {
      setError('Network error.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Classification Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Classification</CardTitle>
            <div className="flex items-center gap-2">
              {saved && (
                <span className="flex items-center gap-1.5 text-label text-status-success">
                  <Check size={14} /> Saved
                </span>
              )}
              {error && (
                <span className="flex items-center gap-1.5 text-label text-status-error">
                  <AlertCircle size={14} /> {error}
                </span>
              )}
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </CardHeader>

        <div className="space-y-5">
          {/* Accounting Category */}
          <div className="form-group">
            <label className="form-label">Accounting Category *</label>
            <select
              className="form-input"
              value={state.accounting_category_id}
              onChange={e => setState(s => ({ ...s, accounting_category_id: e.target.value }))}
            >
              <option value="">— Select category —</option>
              {finalGroups.map(group => (
                grouped[group] && grouped[group].length > 0 && (
                  <optgroup key={group} label={REPORT_GROUP_LABELS[group] ?? group}>
                    {grouped[group].map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.code} · {cat.name}
                      </option>
                    ))}
                  </optgroup>
                )
              ))}
              {/* Show all other groups collapsed */}
              <optgroup label="── All Other Categories ──">
                {accountingCategories
                  .filter(c => !finalGroups.includes(c.report_group))
                  .map(cat => (
                    <option key={cat.id} value={cat.id}>
                      [{REPORT_GROUP_LABELS[cat.report_group]?.slice(0, 10)}] {cat.code} · {cat.name}
                    </option>
                  ))}
              </optgroup>
            </select>
            <p className="text-label text-ink-muted mt-1">
              Recommended groups for {txn.direction} transactions are shown first.
            </p>
          </div>

          {/* Tax Category */}
          <div className="form-group">
            <label className="form-label">Tax Category</label>
            <select
              className="form-input"
              value={state.tax_category_id}
              onChange={e => setState(s => ({ ...s, tax_category_id: e.target.value }))}
            >
              <option value="">— Select tax category (optional) —</option>
              {(['FULLY_DEDUCTIBLE', 'PARTIALLY_DEDUCTIBLE', 'NON_DEDUCTIBLE', 'CAPITAL_ALLOWANCE', 'PERSONAL_RELIEF'] as const).map(dtype => {
                const cats = taxCategories.filter(c => c.deductible_type === dtype)
                return cats.length > 0 && (
                  <optgroup key={dtype} label={DEDUCTIBLE_TYPE_LABELS[dtype]}>
                    {cats.map(tc => (
                      <option key={tc.id} value={tc.id}>{tc.code} · {tc.name}</option>
                    ))}
                  </optgroup>
                )
              })}
            </select>
          </div>

          {/* Counterparty */}
          <div className="form-group">
            <label className="form-label">Counterparty</label>
            <select
              className="form-input"
              value={state.counterparty_id}
              onChange={e => setState(s => ({ ...s, counterparty_id: e.target.value }))}
            >
              <option value="">— No counterparty —</option>
              {counterparties.map(cp => (
                <option key={cp.id} value={cp.id}>
                  [{cp.type}] {cp.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle>Status & Flags</CardTitle>
        </CardHeader>

        <div className="space-y-5">
          {/* Document Status */}
          <div className="form-group">
            <label className="form-label">Supporting Document Status</label>
            <div className="grid grid-cols-2 gap-2">
              {(['NOT_REQUIRED', 'REQUIRED_MISSING', 'UPLOADED', 'VERIFIED'] as const).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setState(st => ({ ...st, document_status: s }))}
                  className={`px-3 py-2 rounded-button text-label font-medium border transition-colors ${
                    state.document_status === s
                      ? 'bg-ink-primary text-white border-ink-primary'
                      : 'bg-white text-ink-secondary border-border hover:bg-panel'
                  }`}
                >
                  {s.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Review Status */}
          <div className="form-group">
            <label className="form-label">Review Status</label>
            <select
              className="form-input"
              value={state.review_status}
              onChange={e => setState(s => ({ ...s, review_status: e.target.value }))}
            >
              <option value="UNREVIEWED">Unreviewed</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="REVIEWED">Reviewed</option>
              <option value="FLAGGED">Flagged</option>
              <option value="APPROVED">Approved</option>
            </select>
          </div>

          {/* Risk Flag */}
          <div className="form-group">
            <label className="form-label">Risk Flag</label>
            <select
              className="form-input"
              value={state.risk_flag}
              onChange={e => setState(s => ({ ...s, risk_flag: e.target.value }))}
            >
              <option value="">No risk flag</option>
              <option value="ROUND_NUMBER">Round Number</option>
              <option value="HIGH_VALUE">High Value (≥RM10,000)</option>
              <option value="RELATED_PARTY">Related Party</option>
              <option value="UNUSUAL_COUNTERPARTY">Unusual Counterparty</option>
              <option value="DUPLICATE_SUSPECT">Possible Duplicate</option>
              <option value="MISSING_DOCS">Missing Documents</option>
              <option value="TAX_SENSITIVE">Tax Sensitive</option>
              <option value="DIRECTOR_RELATED">Director Related</option>
            </select>
          </div>

          {/* Management Note */}
          <div className="form-group">
            <label className="form-label">Management Note</label>
            <textarea
              className="form-input"
              rows={3}
              placeholder="Add a note for review or clarification..."
              value={state.management_note}
              onChange={e => setState(s => ({ ...s, management_note: e.target.value }))}
            />
          </div>
        </div>
      </Card>

      {/* Quick Guidance: Tax-Sensitive Rules */}
      {state.tax_category_id && (() => {
        const tc = taxCategories.find(t => t.id === state.tax_category_id)
        if (!tc) return null
        return (
          <Card size="sm" className="bg-panel border-divider">
            <p className="text-label text-ink-muted uppercase tracking-wide mb-2">Tax Note</p>
            <p className="text-label font-medium text-ink-primary">{tc.name}</p>
            <p className="text-label text-ink-secondary mt-1">{tc.deductible_type.replace(/_/g, ' ')}</p>
          </Card>
        )
      })()}
    </div>
  )
}
