'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

interface EntityOption {
  id:          string
  entity_name: string
  flow_type:   string
  client:      { display_name: string | null; legal_name: string }
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

// Malaysia 2026 tax forms per flow type
const FLOW_FORM: Record<string, string> = {
  INDIVIDUAL_ONLY:     'Form BE',
  INDIVIDUAL_BUSINESS: 'Form B',
  PARTNERSHIP:         'Form P',
  COMPANY:             'Form C',
}

const FLOW_DUE: Record<string, string> = {
  INDIVIDUAL_ONLY:     '30 April',
  INDIVIDUAL_BUSINESS: '30 June',
  PARTNERSHIP:         '30 June',
  COMPANY:             '7 months after FY end',
}

export default function TaxPrepSelectorPage() {
  const router   = useRouter()
  const [entities,   setEntities]   = useState<EntityOption[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [filterFlow, setFilterFlow] = useState('')

  useEffect(() => {
    setLoading(true)
    fetch('/api/entities?is_active=true&limit=200')
      .then(r => r.json())
      .then(json => setEntities(json.data ?? []))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const filtered = entities.filter(e => {
    const q         = search.toLowerCase()
    const nameMatch = e.entity_name.toLowerCase().includes(q) ||
      (e.client.display_name ?? e.client.legal_name).toLowerCase().includes(q)
    const flowMatch = !filterFlow || e.flow_type === filterFlow
    return nameMatch && flowMatch
  })

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tax Preparation</h1>
          <p className="text-label text-ink-muted mt-1">
            Malaysia Assessment Year 2025 — All entity types eligible (Form BE / B / P / C)
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-5">
        <CardContent className="py-3">
          <div className="flex flex-wrap gap-3 items-center">
            <input
              type="search"
              placeholder="Search entities or clients…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="form-input w-64"
            />
            <select
              value={filterFlow}
              onChange={e => setFilterFlow(e.target.value)}
              className="form-input w-56"
            >
              <option value="">All Types</option>
              <option value="INDIVIDUAL_ONLY">Individual Only (Form BE)</option>
              <option value="INDIVIDUAL_BUSINESS">Individual + Business (Form B)</option>
              <option value="PARTNERSHIP">Partnership (Form P)</option>
              <option value="COMPANY">Company / Sdn Bhd (Form C)</option>
            </select>
            {(search || filterFlow) && (
              <button
                onClick={() => { setSearch(''); setFilterFlow('') }}
                className="btn-ghost text-label"
              >
                Clear
              </button>
            )}
            <span className="text-label text-ink-muted ml-auto">
              {filtered.length} {filtered.length === 1 ? 'entity' : 'entities'}
            </span>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="p-10 text-center text-ink-muted">Loading entities…</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-ink-muted text-body">
            No entities found matching your filters.
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(e => (
            <button
              key={e.id}
              onClick={() => router.push(`/tax-prep/${e.id}`)}
              className="card text-left hover:shadow-card-hover transition-shadow cursor-pointer"
            >
              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-body leading-tight">{e.entity_name}</p>
                  <Badge variant={FLOW_BADGE[e.flow_type] ?? 'neutral'} className="flex-shrink-0">
                    {FLOW_FORM[e.flow_type] ?? e.flow_type}
                  </Badge>
                </div>
                <p className="text-label text-ink-muted">
                  {e.client.display_name ?? e.client.legal_name}
                </p>
                <p className="text-label text-ink-secondary">
                  {FLOW_LABELS[e.flow_type] ?? e.flow_type}
                </p>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-label text-ink-muted">
                    Due: {FLOW_DUE[e.flow_type] ?? '—'}
                  </span>
                  <span className="text-label text-ink-muted">→ Open Workbench</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Guide */}
      <Card className="mt-6">
        <CardHeader><CardTitle>Malaysia 2026 Tax Form Guide</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                flow:  'INDIVIDUAL_ONLY',
                form:  'Form BE',
                badge: 'neutral' as const,
                due:   '30 April 2026',
                desc:  'Employment income only. EA Form from employer required. No business income.',
              },
              {
                flow:  'INDIVIDUAL_BUSINESS',
                form:  'Form B',
                badge: 'info' as const,
                due:   '30 June 2026',
                desc:  'Sole proprietor / freelance / enterprise. Schedule B business income + personal reliefs.',
              },
              {
                flow:  'PARTNERSHIP',
                form:  'Form P',
                badge: 'warning' as const,
                due:   '30 June 2026',
                desc:  'Partnership-level return. Profit apportioned per partner %. Each partner files Form B separately.',
              },
              {
                flow:  'COMPANY',
                form:  'Form C + CP204',
                badge: 'success' as const,
                due:   '7 months after FY end',
                desc:  'Sdn Bhd / Bhd / LLP. SME rates 17% (≤RM150k) / 24%. CP204 bi-monthly installments.',
              },
            ].map(item => (
              <div key={item.flow} className="card-sm p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Badge variant={item.badge}>{item.form}</Badge>
                </div>
                <p className="text-label font-medium text-ink-primary">{item.due}</p>
                <p className="text-label text-ink-muted">{item.desc}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
