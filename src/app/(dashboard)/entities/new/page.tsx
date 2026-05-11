'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Card } from '@/components/ui/Card'

interface Client {
  id: string
  legal_name: string
  display_name: string | null
  client_code: string
  primary_flow_type: string
}

const ENTITY_TYPE_OPTIONS = [
  { value: 'INDIVIDUAL_TAX',      label: 'Individual Tax',      flows: ['INDIVIDUAL_ONLY', 'INDIVIDUAL_BUSINESS'] },
  { value: 'SOLE_PROPRIETORSHIP', label: 'Sole Proprietorship',  flows: ['INDIVIDUAL_BUSINESS'] },
  { value: 'ENTERPRISE',          label: 'Enterprise',           flows: ['INDIVIDUAL_BUSINESS'] },
  { value: 'PARTNERSHIP',         label: 'Partnership',          flows: ['PARTNERSHIP'] },
  { value: 'SDN_BHD',             label: 'Sdn Bhd',              flows: ['COMPANY'] },
  { value: 'BHD',                 label: 'Bhd',                  flows: ['COMPANY'] },
  { value: 'LLP',                 label: 'LLP',                  flows: ['COMPANY'] },
  { value: 'FREELANCE',           label: 'Freelance',            flows: ['INDIVIDUAL_ONLY', 'INDIVIDUAL_BUSINESS'] },
]

const FLOW_LABELS: Record<string, string> = {
  INDIVIDUAL_ONLY:     'Individual Only',
  INDIVIDUAL_BUSINESS: 'Individual + Business',
  PARTNERSHIP:         'Partnership',
  COMPANY:             'Company / Sdn Bhd',
}

const E_INVOICE_OPTIONS = [
  { value: 'NOT_YET',   label: 'Not Yet' },
  { value: 'PHASE_1',   label: 'Phase 1' },
  { value: 'PHASE_2',   label: 'Phase 2' },
  { value: 'PHASE_3',   label: 'Phase 3' },
  { value: 'VOLUNTARY', label: 'Voluntary' },
  { value: 'EXEMPT',    label: 'Exempt' },
]

const FRAMEWORK_OPTIONS = [
  { value: 'MFRS_SME',   label: 'MFRS for SMEs' },
  { value: 'MFRS_FULL',  label: 'Full MFRS' },
  { value: 'CASH_BASIS', label: 'Cash Basis' },
  { value: 'NONE',       label: 'None' },
]

function NewEntityForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedClientId = searchParams.get('client_id') ?? ''

  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    client_id:           preselectedClientId,
    entity_name:         '',
    entity_type:         '',
    flow_type:           '',
    registration_no:     '',
    tax_reference_no:    '',
    sst_no:              '',
    e_invoice_phase:     'NOT_YET',
    e_invoice_mandatory: false,
    financial_year_end:  '12-31',
    reporting_framework: 'MFRS_SME',
    base_currency:       'MYR',
  })

  useEffect(() => {
    fetch('/api/clients?pageSize=200')
      .then(r => r.json())
      .then(d => setClients(d.data ?? []))
  }, [])

  // Auto-set flow_type when client changes
  useEffect(() => {
    if (form.client_id && clients.length > 0) {
      const client = clients.find(c => c.id === form.client_id)
      if (client) {
        setForm(prev => ({ ...prev, flow_type: client.primary_flow_type }))
      }
    }
  }, [form.client_id, clients])

  const selectedClient = clients.find(c => c.id === form.client_id)
  const availableEntityTypes = ENTITY_TYPE_OPTIONS.filter(
    t => !form.flow_type || t.flows.includes(form.flow_type)
  )

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value, type } = e.target
    setForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.client_id || !form.entity_name || !form.entity_type || !form.flow_type) {
      setError('Please fill in all required fields.')
      return
    }
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/entities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          registration_no:  form.registration_no || undefined,
          tax_reference_no: form.tax_reference_no || undefined,
          sst_no:           form.sst_no || undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create entity')
      }

      router.push(`/clients/${form.client_id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3 mb-1">
          <Link
            href={preselectedClientId ? `/clients/${preselectedClientId}` : '/entities'}
            className="text-ink-muted hover:text-ink-primary transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <h1 className="page-title">New Entity</h1>
        </div>
        <p className="page-subtitle pl-7">Create a tax/accounting entity under an existing client</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <div className="space-y-5">
            {/* Client Selection */}
            <div>
              <label className="block text-label font-medium text-ink-primary mb-1.5">
                Client <span className="text-status-error">*</span>
              </label>
              <select
                name="client_id"
                value={form.client_id}
                onChange={handleChange}
                required
                className="form-input w-full"
              >
                <option value="">Select a client…</option>
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.display_name ?? c.legal_name} ({c.client_code}) — {FLOW_LABELS[c.primary_flow_type] ?? c.primary_flow_type}
                  </option>
                ))}
              </select>
            </div>

            {/* Flow Type — auto-set from client, but editable */}
            <div>
              <label className="block text-label font-medium text-ink-primary mb-1.5">
                Flow Type <span className="text-status-error">*</span>
              </label>
              <select
                name="flow_type"
                value={form.flow_type}
                onChange={handleChange}
                required
                className="form-input w-full"
              >
                <option value="">Select flow type…</option>
                <option value="INDIVIDUAL_ONLY">Individual Only (Form BE)</option>
                <option value="INDIVIDUAL_BUSINESS">Individual + Business (Form B)</option>
                <option value="PARTNERSHIP">Partnership (Form P)</option>
                <option value="COMPANY">Company / Sdn Bhd (Form C + CP204)</option>
              </select>
              {selectedClient && (
                <p className="text-label text-ink-muted mt-1">
                  Auto-set from client: {FLOW_LABELS[selectedClient.primary_flow_type]}
                </p>
              )}
            </div>

            {/* Entity Type */}
            <div>
              <label className="block text-label font-medium text-ink-primary mb-1.5">
                Entity Type <span className="text-status-error">*</span>
              </label>
              <select
                name="entity_type"
                value={form.entity_type}
                onChange={handleChange}
                required
                className="form-input w-full"
              >
                <option value="">Select entity type…</option>
                {availableEntityTypes.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Entity Name */}
            <div>
              <label className="block text-label font-medium text-ink-primary mb-1.5">
                Entity Name <span className="text-status-error">*</span>
              </label>
              <input
                type="text"
                name="entity_name"
                value={form.entity_name}
                onChange={handleChange}
                required
                className="form-input w-full"
                placeholder="e.g. ABC SDN BHD or TAN AH KOW (Individual)"
              />
            </div>

            {/* Divider */}
            <div className="border-t border-divider pt-5">
              <p className="text-label font-medium text-ink-muted uppercase tracking-wide mb-4">Registration & Tax</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-label font-medium text-ink-primary mb-1.5">
                    Registration No (SSM)
                  </label>
                  <input
                    type="text"
                    name="registration_no"
                    value={form.registration_no}
                    onChange={handleChange}
                    className="form-input w-full font-mono"
                    placeholder="e.g. 202301234567"
                  />
                </div>
                <div>
                  <label className="block text-label font-medium text-ink-primary mb-1.5">
                    LHDN Tax Reference No
                  </label>
                  <input
                    type="text"
                    name="tax_reference_no"
                    value={form.tax_reference_no}
                    onChange={handleChange}
                    className="form-input w-full font-mono"
                    placeholder="e.g. C1234567890"
                  />
                </div>
                <div>
                  <label className="block text-label font-medium text-ink-primary mb-1.5">
                    SST No
                  </label>
                  <input
                    type="text"
                    name="sst_no"
                    value={form.sst_no}
                    onChange={handleChange}
                    className="form-input w-full font-mono"
                    placeholder="e.g. B16-1802-32011234"
                  />
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-divider pt-5">
              <p className="text-label font-medium text-ink-muted uppercase tracking-wide mb-4">Financial Settings</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-label font-medium text-ink-primary mb-1.5">
                    Financial Year End
                  </label>
                  <select
                    name="financial_year_end"
                    value={form.financial_year_end}
                    onChange={handleChange}
                    className="form-input w-full"
                  >
                    <option value="12-31">31 December</option>
                    <option value="03-31">31 March</option>
                    <option value="06-30">30 June</option>
                    <option value="09-30">30 September</option>
                    <option value="01-31">31 January</option>
                    <option value="02-28">28 February</option>
                    <option value="04-30">30 April</option>
                    <option value="05-31">31 May</option>
                    <option value="07-31">31 July</option>
                    <option value="08-31">31 August</option>
                    <option value="10-31">31 October</option>
                    <option value="11-30">30 November</option>
                  </select>
                </div>
                <div>
                  <label className="block text-label font-medium text-ink-primary mb-1.5">
                    Base Currency
                  </label>
                  <select
                    name="base_currency"
                    value={form.base_currency}
                    onChange={handleChange}
                    className="form-input w-full"
                  >
                    <option value="MYR">MYR — Malaysian Ringgit</option>
                    <option value="USD">USD — US Dollar</option>
                    <option value="SGD">SGD — Singapore Dollar</option>
                    <option value="EUR">EUR — Euro</option>
                  </select>
                </div>
                <div>
                  <label className="block text-label font-medium text-ink-primary mb-1.5">
                    Reporting Framework
                  </label>
                  <select
                    name="reporting_framework"
                    value={form.reporting_framework}
                    onChange={handleChange}
                    className="form-input w-full"
                  >
                    {FRAMEWORK_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-label font-medium text-ink-primary mb-1.5">
                    e-Invoice Phase
                  </label>
                  <select
                    name="e_invoice_phase"
                    value={form.e_invoice_phase}
                    onChange={handleChange}
                    className="form-input w-full"
                  >
                    {E_INVOICE_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-5 p-3 bg-red-50 border border-red-200 rounded-card text-label text-status-error">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between mt-6 pt-5 border-t border-divider">
            <Link
              href={preselectedClientId ? `/clients/${preselectedClientId}` : '/entities'}
              className="btn-secondary"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating…' : 'Create Entity →'}
            </button>
          </div>
        </Card>
      </form>
    </div>
  )
}

export default function NewEntityPage() {
  return (
    <Suspense fallback={<div className="page-content p-10 text-center text-ink-muted">Loading…</div>}>
      <NewEntityForm />
    </Suspense>
  )
}
