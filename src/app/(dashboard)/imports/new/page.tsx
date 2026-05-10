'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { ArrowLeft, Upload, AlertCircle } from 'lucide-react'

const BANKS = [
  'Maybank', 'CIMB Bank', 'Public Bank', 'RHB Bank',
  'Hong Leong Bank', 'AmBank', 'OCBC Bank', 'UOB Malaysia',
  'Bank Islam', 'Alliance Bank', 'Affin Bank', 'Bank Rakyat', 'Other',
]

const SOURCE_TYPES = [
  { value: 'PDF_STATEMENT',  label: 'PDF Bank Statement' },
  { value: 'CSV_EXPORT',     label: 'CSV Export' },
  { value: 'EXCEL_EXPORT',   label: 'Excel Export' },
  { value: 'MANUAL_ENTRY',   label: 'Manual Entry' },
]

export default function NewImportPage() {
  const router  = useRouter()
  const [step, setStep] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const [form, setForm] = useState({
    entity_id:       '',
    bank_account_id: '',
    source_type:     'PDF_STATEMENT',
    statement_month: '',
    notes:           '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!form.entity_id || !form.bank_account_id || !form.statement_month) {
      setError('Entity, bank account, and statement month are required.')
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/imports', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          source_file_name: `statement-${form.statement_month}.pdf`,
          source_file_url:  '/placeholder-url',  // File upload handled separately
          imported_by:      'system',
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to create import batch.')
        return
      }

      // Redirect to the batch detail page
      router.push(`/imports/${json.data.id}`)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {/* Back Nav */}
      <div className="mb-6">
        <Link href="/imports" className="btn-ghost text-ink-muted">
          <ArrowLeft size={16} />
          Back to Imports
        </Link>
      </div>

      <div className="page-header">
        <h1 className="page-title">New Import</h1>
        <p className="page-subtitle">Upload a bank statement to import transactions</p>
      </div>

      <div className="max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Import Details</CardTitle>
          </CardHeader>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Statement Month */}
            <div className="form-group">
              <label className="form-label">Statement Month *</label>
              <input
                type="month"
                className="form-input"
                value={form.statement_month}
                onChange={e => setForm(f => ({ ...f, statement_month: e.target.value }))}
                required
              />
              <p className="text-label text-ink-muted mt-1">The month this bank statement covers</p>
            </div>

            {/* Source Type */}
            <div className="form-group">
              <label className="form-label">File Type *</label>
              <select
                className="form-input"
                value={form.source_type}
                onChange={e => setForm(f => ({ ...f, source_type: e.target.value }))}
              >
                {SOURCE_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* File Upload Area */}
            <div className="form-group">
              <label className="form-label">Upload File *</label>
              <div className="border-2 border-dashed border-border rounded-card p-8 text-center hover:border-ink-muted transition-colors">
                <Upload size={32} className="mx-auto mb-3 text-ink-muted" />
                <p className="text-body text-ink-secondary mb-1">Drop your bank statement here</p>
                <p className="text-label text-ink-muted">PDF, CSV, or Excel · Max 20MB</p>
                <button type="button" className="btn-secondary mt-4">
                  Choose File
                </button>
              </div>
            </div>

            {/* Entity ID (simplified — in production would be a searchable select) */}
            <div className="form-group">
              <label className="form-label">Entity ID *</label>
              <input
                type="text"
                className="form-input font-mono"
                placeholder="Entity ID from /entities"
                value={form.entity_id}
                onChange={e => setForm(f => ({ ...f, entity_id: e.target.value }))}
                required
              />
            </div>

            {/* Bank Account ID */}
            <div className="form-group">
              <label className="form-label">Bank Account ID *</label>
              <input
                type="text"
                className="form-input font-mono"
                placeholder="Bank account ID from /bank-accounts"
                value={form.bank_account_id}
                onChange={e => setForm(f => ({ ...f, bank_account_id: e.target.value }))}
                required
              />
            </div>

            {/* Notes */}
            <div className="form-group">
              <label className="form-label">Notes</label>
              <textarea
                className="form-input"
                rows={3}
                placeholder="Any notes about this import..."
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              />
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-100 rounded-card">
                <AlertCircle size={16} className="text-status-error mt-0.5 flex-shrink-0" />
                <p className="text-body text-status-error">{error}</p>
              </div>
            )}

            {/* Submit */}
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                className="btn-primary"
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create Import Batch'}
              </button>
              <Link href="/imports" className="btn-secondary">
                Cancel
              </Link>
            </div>
          </form>
        </Card>

        {/* Info Card */}
        <Card size="sm" className="mt-4 bg-panel border-divider">
          <h3 className="text-card-title text-ink-primary mb-3">How Import Works</h3>
          <ol className="space-y-2 text-body text-ink-secondary list-decimal list-inside">
            <li>Upload your bank statement file (PDF or CSV)</li>
            <li>System creates an import batch in PENDING status</li>
            <li>Click &quot;Process Now&quot; on the batch detail page to trigger parsing</li>
            <li>n8n parser reads the file and creates transaction records</li>
            <li>Review and classify transactions in the batch detail view</li>
          </ol>
        </Card>
      </div>
    </div>
  )
}
