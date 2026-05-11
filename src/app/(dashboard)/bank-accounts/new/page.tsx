'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Card } from '@/components/ui/Card'

interface Entity {
  id: string
  entity_name: string
  flow_type: string
  client: { id: string; legal_name: string; display_name: string | null; client_code: string }
}

const BANK_OPTIONS = [
  'Maybank', 'CIMB Bank', 'Public Bank', 'RHB Bank', 'Hong Leong Bank',
  'AmBank', 'OCBC Bank', 'UOB Bank', 'Bank Islam', 'Bank Muamalat',
  'Alliance Bank', 'Affin Bank', 'HSBC Bank Malaysia', 'Standard Chartered',
  'Citibank Malaysia', 'Bank Rakyat', 'BSN', 'Agro Bank', 'Bank Simpanan Nasional',
]

function NewBankAccountForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const preselectedEntityId = searchParams.get('entity_id') ?? ''

  const [entities, setEntities] = useState<Entity[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [customBank, setCustomBank] = useState(false)

  const [form, setForm] = useState({
    entity_id:       preselectedEntityId,
    bank_name:       '',
    account_name:    '',
    account_no:      '',
    currency:        'MYR',
    account_type:    'CURRENT',
    opening_balance: '',
    opening_date:    '',
  })

  useEffect(() => {
    fetch('/api/entities?limit=200')
      .then(r => r.json())
      .then(d => setEntities(d.data ?? []))
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.entity_id || !form.bank_name || !form.account_no) {
      setError('Entity, bank name, and account number are required.')
      return
    }
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/bank-accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          account_name:    form.account_name || form.bank_name,
          opening_balance: form.opening_balance ? parseFloat(form.opening_balance) : undefined,
          opening_date:    form.opening_date ? new Date(form.opening_date).toISOString() : undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create bank account')
      }

      const selectedEntity = entities.find(e => e.id === form.entity_id)
      router.push(`/clients/${selectedEntity?.client.id ?? ''}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="page-header">
        <div className="flex items-center gap-3 mb-1">
          <Link href="/bank-accounts" className="text-ink-muted hover:text-ink-primary transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="page-title">Add Bank Account</h1>
        </div>
        <p className="page-subtitle pl-7">Link a bank account to an entity for statement imports</p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <div className="space-y-5">
            {/* Entity */}
            <div>
              <label className="block text-label font-medium text-ink-primary mb-1.5">
                Entity <span className="text-status-error">*</span>
              </label>
              <select
                name="entity_id"
                value={form.entity_id}
                onChange={handleChange}
                required
                className="form-input w-full"
              >
                <option value="">Select entity…</option>
                {entities.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.entity_name} — {e.client.display_name ?? e.client.legal_name} ({e.client.client_code})
                  </option>
                ))}
              </select>
            </div>

            {/* Bank Name */}
            <div>
              <label className="block text-label font-medium text-ink-primary mb-1.5">
                Bank Name <span className="text-status-error">*</span>
              </label>
              {!customBank ? (
                <div className="flex gap-2">
                  <select
                    name="bank_name"
                    value={form.bank_name}
                    onChange={handleChange}
                    required
                    className="form-input flex-1"
                  >
                    <option value="">Select bank…</option>
                    {BANK_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => { setCustomBank(true); setForm(prev => ({ ...prev, bank_name: '' })) }}
                    className="btn-secondary text-label whitespace-nowrap"
                  >
                    Other…
                  </button>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    name="bank_name"
                    value={form.bank_name}
                    onChange={handleChange}
                    required
                    className="form-input flex-1"
                    placeholder="Enter bank name"
                  />
                  <button
                    type="button"
                    onClick={() => { setCustomBank(false); setForm(prev => ({ ...prev, bank_name: '' })) }}
                    className="btn-ghost text-label"
                  >
                    List
                  </button>
                </div>
              )}
            </div>

            {/* Account Name */}
            <div>
              <label className="block text-label font-medium text-ink-primary mb-1.5">
                Account Name
              </label>
              <input
                type="text"
                name="account_name"
                value={form.account_name}
                onChange={handleChange}
                className="form-input w-full"
                placeholder="Name as shown on bank statement (leave blank to use bank name)"
              />
            </div>

            {/* Account No */}
            <div>
              <label className="block text-label font-medium text-ink-primary mb-1.5">
                Account Number <span className="text-status-error">*</span>
              </label>
              <input
                type="text"
                name="account_no"
                value={form.account_no}
                onChange={handleChange}
                required
                className="form-input w-full font-mono"
                placeholder="e.g. 1234-5678-9012"
              />
            </div>

            {/* Account Type + Currency */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-label font-medium text-ink-primary mb-1.5">
                  Account Type <span className="text-status-error">*</span>
                </label>
                <select
                  name="account_type"
                  value={form.account_type}
                  onChange={handleChange}
                  className="form-input w-full"
                >
                  <option value="CURRENT">Current Account</option>
                  <option value="SAVINGS">Savings Account</option>
                  <option value="FIXED_DEPOSIT">Fixed Deposit</option>
                  <option value="CREDIT_CARD">Credit Card</option>
                  <option value="E_WALLET">e-Wallet</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-label font-medium text-ink-primary mb-1.5">
                  Currency
                </label>
                <select
                  name="currency"
                  value={form.currency}
                  onChange={handleChange}
                  className="form-input w-full"
                >
                  <option value="MYR">MYR</option>
                  <option value="USD">USD</option>
                  <option value="SGD">SGD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
            </div>

            {/* Opening Balance */}
            <div className="border-t border-divider pt-5">
              <p className="text-label font-medium text-ink-muted uppercase tracking-wide mb-4">Opening Balance (Optional)</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-label font-medium text-ink-primary mb-1.5">
                    Opening Balance
                  </label>
                  <input
                    type="number"
                    name="opening_balance"
                    value={form.opening_balance}
                    onChange={handleChange}
                    className="form-input w-full tabular-nums"
                    placeholder="0.00"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-label font-medium text-ink-primary mb-1.5">
                    As of Date
                  </label>
                  <input
                    type="date"
                    name="opening_date"
                    value={form.opening_date}
                    onChange={handleChange}
                    className="form-input w-full"
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
            <Link href="/bank-accounts" className="btn-secondary">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Adding…' : 'Add Bank Account →'}
            </button>
          </div>
        </Card>
      </form>
    </div>
  )
}

export default function NewBankAccountPage() {
  return (
    <Suspense fallback={<div className="page-content p-10 text-center text-ink-muted">Loading…</div>}>
      <NewBankAccountForm />
    </Suspense>
  )
}
