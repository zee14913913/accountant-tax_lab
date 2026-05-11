'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, User, Building2, Users, Briefcase } from 'lucide-react'
import { Card } from '@/components/ui/Card'

type FlowType = 'INDIVIDUAL_ONLY' | 'INDIVIDUAL_BUSINESS' | 'PARTNERSHIP' | 'COMPANY'
type ClientType = 'INDIVIDUAL' | 'BUSINESS_OWNER' | 'PARTNER' | 'DIRECTOR'

const FLOW_CONFIG: Record<FlowType, {
  label: string
  subtitle: string
  icon: React.ReactNode
  clientType: ClientType
  taxForm: string
  fields: string[]
}> = {
  INDIVIDUAL_ONLY: {
    label: 'Individual',
    subtitle: 'Personal income tax only (Form BE)',
    icon: <User size={20} />,
    clientType: 'INDIVIDUAL',
    taxForm: 'Form BE',
    fields: ['identification_no', 'tax_no'],
  },
  INDIVIDUAL_BUSINESS: {
    label: 'Individual + Business',
    subtitle: 'Sole prop / freelance / enterprise (Form B)',
    icon: <Briefcase size={20} />,
    clientType: 'BUSINESS_OWNER',
    taxForm: 'Form B',
    fields: ['identification_no', 'registration_no', 'tax_no'],
  },
  PARTNERSHIP: {
    label: 'Partnership',
    subtitle: 'Partnership firm with multiple partners (Form P)',
    icon: <Users size={20} />,
    clientType: 'PARTNER',
    taxForm: 'Form P',
    fields: ['registration_no', 'tax_no'],
  },
  COMPANY: {
    label: 'Company / Sdn Bhd',
    subtitle: 'Incorporated company, BHD or LLP (Form C + CP204)',
    icon: <Building2 size={20} />,
    clientType: 'DIRECTOR',
    taxForm: 'Form C + CP204',
    fields: ['registration_no', 'tax_no'],
  },
}

export default function NewClientPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [selectedFlow, setSelectedFlow] = useState<FlowType | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    legal_name: '',
    display_name: '',
    identification_no: '',
    registration_no: '',
    tax_no: '',
    phone: '',
    email: '',
  })

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedFlow) return
    setLoading(true)
    setError(null)

    const config = FLOW_CONFIG[selectedFlow]

    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          display_name: form.display_name || undefined,
          identification_no: form.identification_no || undefined,
          registration_no: form.registration_no || undefined,
          tax_no: form.tax_no || undefined,
          phone: form.phone || undefined,
          email: form.email || undefined,
          primary_flow_type: selectedFlow,
          client_type: config.clientType,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create client')
      }

      const { data } = await res.json()
      router.push(`/clients/${data.id}`)
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
          <Link href="/clients" className="text-ink-muted hover:text-ink-primary transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="page-title">New Client</h1>
        </div>
        <p className="page-subtitle pl-7">
          {step === 1 ? 'Step 1 of 2 — Select client type' : `Step 2 of 2 — ${selectedFlow ? FLOW_CONFIG[selectedFlow].label : ''} details`}
        </p>
      </div>

      {/* Step 1: Flow Type Selection */}
      {step === 1 && (
        <div className="space-y-3">
          {(Object.entries(FLOW_CONFIG) as [FlowType, typeof FLOW_CONFIG[FlowType]][]).map(([flow, config]) => (
            <button
              key={flow}
              onClick={() => { setSelectedFlow(flow); setStep(2) }}
              className="w-full text-left"
            >
              <Card className="hover:shadow-card-hover transition-all duration-150 border border-border hover:border-ink-secondary cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-ink-primary/5 flex items-center justify-center text-ink-primary flex-shrink-0">
                    {config.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="text-card-title text-ink-primary">{config.label}</p>
                      <span className="text-label font-mono text-ink-muted bg-ink-primary/5 px-2 py-0.5 rounded">
                        {config.taxForm}
                      </span>
                    </div>
                    <p className="text-label text-ink-muted mt-0.5">{config.subtitle}</p>
                  </div>
                  <span className="text-ink-muted ml-2">→</span>
                </div>
              </Card>
            </button>
          ))}
        </div>
      )}

      {/* Step 2: Client Details Form */}
      {step === 2 && selectedFlow && (
        <form onSubmit={handleSubmit}>
          <Card>
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-divider">
              <div className="w-8 h-8 rounded-lg bg-ink-primary/5 flex items-center justify-center text-ink-primary">
                {FLOW_CONFIG[selectedFlow].icon}
              </div>
              <div>
                <p className="text-card-title text-ink-primary">{FLOW_CONFIG[selectedFlow].label}</p>
                <p className="text-label text-ink-muted">{FLOW_CONFIG[selectedFlow].taxForm}</p>
              </div>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="ml-auto text-label text-ink-muted hover:text-ink-primary"
              >
                Change type
              </button>
            </div>

            <div className="space-y-5">
              {/* Legal Name */}
              <div>
                <label className="block text-label font-medium text-ink-primary mb-1.5">
                  Legal Name <span className="text-status-error">*</span>
                </label>
                <input
                  type="text"
                  name="legal_name"
                  value={form.legal_name}
                  onChange={handleChange}
                  required
                  className="form-input w-full"
                  placeholder={
                    selectedFlow === 'COMPANY' ? 'e.g. ACME SDN BHD' :
                    selectedFlow === 'PARTNERSHIP' ? 'e.g. ABC & PARTNERS' :
                    'e.g. TAN AH KOW'
                  }
                />
                <p className="text-label text-ink-muted mt-1">
                  As per SSM / LHDN registration. Use full legal name.
                </p>
              </div>

              {/* Display Name */}
              <div>
                <label className="block text-label font-medium text-ink-primary mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  name="display_name"
                  value={form.display_name}
                  onChange={handleChange}
                  className="form-input w-full"
                  placeholder="Short name for internal use (optional)"
                />
              </div>

              {/* Conditional fields based on flow type */}
              {FLOW_CONFIG[selectedFlow].fields.includes('identification_no') && (
                <div>
                  <label className="block text-label font-medium text-ink-primary mb-1.5">
                    IC / Passport No
                  </label>
                  <input
                    type="text"
                    name="identification_no"
                    value={form.identification_no}
                    onChange={handleChange}
                    className="form-input w-full font-mono"
                    placeholder="e.g. 800101-14-1234"
                  />
                </div>
              )}

              {FLOW_CONFIG[selectedFlow].fields.includes('registration_no') && (
                <div>
                  <label className="block text-label font-medium text-ink-primary mb-1.5">
                    SSM / Registration No
                  </label>
                  <input
                    type="text"
                    name="registration_no"
                    value={form.registration_no}
                    onChange={handleChange}
                    className="form-input w-full font-mono"
                    placeholder="e.g. 202301234567 (1234567-H)"
                  />
                </div>
              )}

              {FLOW_CONFIG[selectedFlow].fields.includes('tax_no') && (
                <div>
                  <label className="block text-label font-medium text-ink-primary mb-1.5">
                    LHDN Tax Reference No
                  </label>
                  <input
                    type="text"
                    name="tax_no"
                    value={form.tax_no}
                    onChange={handleChange}
                    className="form-input w-full font-mono"
                    placeholder="e.g. SG12345678000"
                  />
                </div>
              )}

              {/* Divider */}
              <div className="border-t border-divider pt-5">
                <p className="text-label font-medium text-ink-muted uppercase tracking-wide mb-4">
                  Contact Information
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-label font-medium text-ink-primary mb-1.5">
                      Phone
                    </label>
                    <input
                      type="tel"
                      name="phone"
                      value={form.phone}
                      onChange={handleChange}
                      className="form-input w-full"
                      placeholder="e.g. +60 12-345 6789"
                    />
                  </div>
                  <div>
                    <label className="block text-label font-medium text-ink-primary mb-1.5">
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={handleChange}
                      className="form-input w-full"
                      placeholder="e.g. client@example.com"
                    />
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
              <button
                type="button"
                onClick={() => setStep(1)}
                className="btn-secondary"
              >
                ← Back
              </button>
              <button
                type="submit"
                disabled={loading || !form.legal_name}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating…' : 'Create Client →'}
              </button>
            </div>
          </Card>
        </form>
      )}
    </div>
  )
}
