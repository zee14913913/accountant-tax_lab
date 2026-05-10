'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface Entity {
  id: string
  entity_name: string
  flow_type: string
  client: { display_name: string | null; legal_name: string }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function NewAuditorPackPage() {
  const router = useRouter()

  const [entities, setEntities]   = useState<Entity[]>([])
  const [loadingEnt, setLoadingEnt] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState<string | null>(null)

  // Form state
  const [entityId, setEntityId]         = useState('')
  const [packName, setPackName]         = useState('')
  const [periodStart, setPeriodStart]   = useState('')
  const [periodEnd, setPeriodEnd]       = useState('')
  const [assessYear, setAssessYear]     = useState('')
  const [notes, setNotes]               = useState('')

  // Fetch entities
  useEffect(() => {
    fetch('/api/entities?is_active=true')
      .then(r => r.json())
      .then(j => setEntities(j.data ?? []))
      .catch(() => {/* non-fatal */})
      .finally(() => setLoadingEnt(false))
  }, [])

  // Auto-suggest pack name when entity + period change
  useEffect(() => {
    if (!entityId || !periodStart || !periodEnd) return
    const ent = entities.find(e => e.id === entityId)
    if (!ent) return
    const startYear = new Date(periodStart).getFullYear()
    const endYear   = new Date(periodEnd).getFullYear()
    const period    = startYear === endYear ? String(startYear) : `${startYear}/${endYear}`
    setPackName(`${ent.entity_name} — ${period} Audit Pack`)
  }, [entityId, periodStart, periodEnd, entities])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/auditor-pack', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          entity_id:       entityId,
          period_start:    periodStart,
          period_end:      periodEnd,
          assessment_year: assessYear ? parseInt(assessYear, 10) : undefined,
          pack_name:       packName,
          prepared_by:     'current_user', // Replace with real auth session
          notes:           notes || undefined,
        }),
      })

      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to create package')
        return
      }

      router.push(`/auditor-pack/${json.data.id}`)
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="page-content max-w-2xl">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">New Auditor Package</h1>
        <p className="page-subtitle">Create a review pack for external audit or submission</p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-6">
        {/* Entity */}
        <div>
          <label className="form-label" htmlFor="entity">Entity *</label>
          {loadingEnt ? (
            <p className="text-label text-ink-muted">Loading entities…</p>
          ) : (
            <select
              id="entity"
              className="form-input w-full"
              value={entityId}
              onChange={e => setEntityId(e.target.value)}
              required
            >
              <option value="">Select an entity…</option>
              {entities.map(ent => (
                <option key={ent.id} value={ent.id}>
                  {ent.entity_name} — {ent.client.display_name ?? ent.client.legal_name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Period */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="form-label" htmlFor="period_start">Period Start *</label>
            <input
              id="period_start"
              type="date"
              className="form-input w-full"
              value={periodStart}
              onChange={e => setPeriodStart(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="form-label" htmlFor="period_end">Period End *</label>
            <input
              id="period_end"
              type="date"
              className="form-input w-full"
              value={periodEnd}
              onChange={e => setPeriodEnd(e.target.value)}
              required
            />
          </div>
        </div>

        {/* Pack Name */}
        <div>
          <label className="form-label" htmlFor="pack_name">Pack Name *</label>
          <input
            id="pack_name"
            type="text"
            className="form-input w-full"
            placeholder="e.g. Company Name — 2024 Audit Pack"
            value={packName}
            onChange={e => setPackName(e.target.value)}
            required
          />
          <p className="text-label text-ink-muted mt-1">Auto-suggested based on entity and period</p>
        </div>

        {/* Assessment Year */}
        <div>
          <label className="form-label" htmlFor="assess_year">Assessment Year</label>
          <input
            id="assess_year"
            type="number"
            className="form-input w-40"
            placeholder="e.g. 2024"
            min={2000}
            max={2099}
            value={assessYear}
            onChange={e => setAssessYear(e.target.value)}
          />
        </div>

        {/* Notes */}
        <div>
          <label className="form-label" htmlFor="notes">Notes</label>
          <textarea
            id="notes"
            className="form-input w-full min-h-[80px] resize-y"
            placeholder="Any remarks or special instructions…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-status-error text-body rounded-card px-4 py-3">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create Package'}
          </button>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => router.back()}
            disabled={submitting}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
