'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'

interface EntityOption {
  id: string
  entity_name: string
  flow_type: string
  client: { display_name: string | null; legal_name: string }
  _count?: { pnl_snapshots: number }
}

const FLOW_LABELS: Record<string, string> = {
  INDIVIDUAL_ONLY: 'Individual Only',
  INDIVIDUAL_BUSINESS: 'Individual + Business',
  PARTNERSHIP: 'Partnership',
  COMPANY: 'Company / Sdn Bhd',
}

const FLOW_BADGE: Record<string, 'neutral' | 'info' | 'warning' | 'success'> = {
  INDIVIDUAL_ONLY: 'neutral',
  INDIVIDUAL_BUSINESS: 'info',
  PARTNERSHIP: 'warning',
  COMPANY: 'success',
}

export default function PnlSelectorPage() {
  const router = useRouter()
  const [entities, setEntities] = useState<EntityOption[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
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
    const q = search.toLowerCase()
    const nameMatch = e.entity_name.toLowerCase().includes(q) ||
      (e.client.display_name ?? e.client.legal_name).toLowerCase().includes(q)
    const flowMatch = !filterFlow || e.flow_type === filterFlow
    return nameMatch && flowMatch
  })

  // INDIVIDUAL_ONLY cannot generate P&L
  const eligible = filtered.filter(e => e.flow_type !== 'INDIVIDUAL_ONLY')
  const excluded = filtered.filter(e => e.flow_type === 'INDIVIDUAL_ONLY')

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Profit & Loss</h1>
          <p className="text-label text-ink-muted mt-1">
            Select an entity to view or generate P&amp;L statements
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
              className="form-input w-52"
            >
              <option value="">All Types</option>
              <option value="INDIVIDUAL_BUSINESS">Individual + Business</option>
              <option value="PARTNERSHIP">Partnership</option>
              <option value="COMPANY">Company / Sdn Bhd</option>
            </select>
            {(search || filterFlow) && (
              <button
                onClick={() => { setSearch(''); setFilterFlow('') }}
                className="btn-ghost text-label"
              >
                Clear
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <div className="p-10 text-center text-ink-muted">Loading entities…</div>
      ) : (
        <div className="space-y-5">
          {/* Eligible entities */}
          {eligible.length > 0 && (
            <div>
              <h2 className="section-title mb-3">P&amp;L Eligible Entities ({eligible.length})</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {eligible.map(e => (
                  <button
                    key={e.id}
                    onClick={() => router.push(`/pnl/${e.id}`)}
                    className="card text-left hover:shadow-card-hover transition-shadow cursor-pointer"
                  >
                    <div className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-body leading-tight">{e.entity_name}</p>
                        <Badge variant={FLOW_BADGE[e.flow_type] ?? 'neutral'} className="flex-shrink-0">
                          {FLOW_LABELS[e.flow_type]?.split(' ')[0] ?? e.flow_type}
                        </Badge>
                      </div>
                      <p className="text-label text-ink-muted">
                        {e.client.display_name ?? e.client.legal_name}
                      </p>
                      <p className="text-label text-ink-muted">
                        {FLOW_LABELS[e.flow_type] ?? e.flow_type}
                      </p>
                      <p className="text-label text-ink-body/50">
                        → View P&amp;L Statements
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Individual-only entities — no P&L */}
          {excluded.length > 0 && !filterFlow && (
            <div>
              <h2 className="section-title mb-3 text-ink-muted">
                Not Applicable — Individual Only ({excluded.length})
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {excluded.map(e => (
                  <div key={e.id} className="card opacity-50 cursor-not-allowed">
                    <div className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-body leading-tight">{e.entity_name}</p>
                        <Badge variant="neutral">Individual</Badge>
                      </div>
                      <p className="text-label text-ink-muted">
                        {e.client.display_name ?? e.client.legal_name}
                      </p>
                      <p className="text-label text-ink-muted">
                        Individual-only entities do not require a P&amp;L statement. Use Tax Prep for Form BE.
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {eligible.length === 0 && excluded.length === 0 && (
            <Card>
              <CardContent className="py-10 text-center text-ink-muted text-body">
                No entities found matching your filters.
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Info panel */}
      <Card className="mt-6">
        <CardHeader><CardTitle>Entity Type Guide</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                flow: 'INDIVIDUAL_ONLY',
                label: 'Individual Only',
                badge: 'neutral' as const,
                desc: 'Employment income only. No P&L required. Use Tax Prep → Form BE.',
                pnl: false,
              },
              {
                flow: 'INDIVIDUAL_BUSINESS',
                label: 'Individual + Business',
                badge: 'info' as const,
                desc: 'Sole prop / enterprise / freelance. Business Schedule B income. Form B.',
                pnl: true,
              },
              {
                flow: 'PARTNERSHIP',
                label: 'Partnership',
                badge: 'warning' as const,
                desc: 'Partnership entity. Per-partner apportionment shown. Form P.',
                pnl: true,
              },
              {
                flow: 'COMPANY',
                label: 'Company / Sdn Bhd',
                badge: 'success' as const,
                desc: 'Sdn Bhd / Bhd / LLP. SME tax rates 17%/24%. Form C + CP204.',
                pnl: true,
              },
            ].map(item => (
              <div key={item.flow} className="card-sm p-3 space-y-2">
                <Badge variant={item.badge}>{item.label}</Badge>
                <p className="text-label text-ink-muted">{item.desc}</p>
                <p className={`text-label font-medium ${item.pnl ? 'text-status-success' : 'text-ink-muted'}`}>
                  {item.pnl ? '✓ P&L Generated' : '✗ No P&L Required'}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
