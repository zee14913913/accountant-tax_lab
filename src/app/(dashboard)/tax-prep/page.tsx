export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { prisma } from '@/lib/prisma'

// ─── Types ────────────────────────────────────────────────────────────────────

type FlowType = 'INDIVIDUAL_ONLY' | 'INDIVIDUAL_BUSINESS' | 'PARTNERSHIP' | 'COMPANY'

const FLOW_LABELS: Record<FlowType, string> = {
  INDIVIDUAL_ONLY:     'Individual Only',
  INDIVIDUAL_BUSINESS: 'Individual + Business',
  PARTNERSHIP:         'Partnership',
  COMPANY:             'Company',
}

const FLOW_FORM: Record<FlowType, string> = {
  INDIVIDUAL_ONLY:     'Form BE',
  INDIVIDUAL_BUSINESS: 'Form B',
  PARTNERSHIP:         'Form P',
  COMPANY:             'Form C',
}

const FLOW_DEADLINE: Record<FlowType, string> = {
  INDIVIDUAL_ONLY:     '30 Apr 2026 (e-Filing: 15 May)',
  INDIVIDUAL_BUSINESS: '30 Jun 2026 (e-Filing: 15 Jul)',
  PARTNERSHIP:         '30 Jun 2026 (e-Filing: 15 Jul)',
  COMPANY:             '7 months from FYE',
}

const FLOW_ORDER: FlowType[] = [
  'INDIVIDUAL_ONLY',
  'INDIVIDUAL_BUSINESS',
  'PARTNERSHIP',
  'COMPANY',
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function TaxPrepPage() {
  const entities = await prisma.entity.findMany({
    where:   { is_active: true },
    include: { client: { select: { legal_name: true, display_name: true } } },
    orderBy: [{ flow_type: 'asc' }, { entity_name: 'asc' }],
  })

  // Summary counts
  const total              = entities.length
  const countByFlow = (ft: FlowType) => entities.filter(e => e.flow_type === ft).length

  const counts: Record<FlowType, number> = {
    INDIVIDUAL_ONLY:     countByFlow('INDIVIDUAL_ONLY'),
    INDIVIDUAL_BUSINESS: countByFlow('INDIVIDUAL_BUSINESS'),
    PARTNERSHIP:         countByFlow('PARTNERSHIP'),
    COMPANY:             countByFlow('COMPANY'),
  }

  // Group entities by flow_type
  const grouped: Record<FlowType, typeof entities> = {
    INDIVIDUAL_ONLY:     [],
    INDIVIDUAL_BUSINESS: [],
    PARTNERSHIP:         [],
    COMPANY:             [],
  }
  for (const e of entities) {
    const ft = e.flow_type as FlowType
    if (grouped[ft]) grouped[ft].push(e)
  }

  return (
    <div className="page-content">
      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Tax Preparation</h1>
          <p style={{ color: '#5E5E5E', fontSize: 13, marginTop: 4 }}>
            Malaysia Assessment Year 2025 — Form BE / B / P / C
          </p>
        </div>
      </div>

      {/* ── Summary Stats ───────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 16,
          marginBottom: 32,
        }}
      >
        {/* Total */}
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #DDDDDA',
            borderRadius: 8,
            padding: 24,
          }}
        >
          <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5E5E5E', marginBottom: 8 }}>
            Total Entities
          </p>
          <p style={{ fontSize: 28, fontWeight: 700, color: '#111111', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
            {total}
          </p>
        </div>

        {FLOW_ORDER.map(ft => (
          <div
            key={ft}
            style={{
              background: '#FFFFFF',
              border: '1px solid #DDDDDA',
              borderRadius: 8,
              padding: 24,
            }}
          >
            <p style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#5E5E5E', marginBottom: 4 }}>
              {FLOW_FORM[ft]}
            </p>
            <p style={{ fontSize: 11, color: '#5E5E5E', marginBottom: 8 }}>
              {FLOW_LABELS[ft]}
            </p>
            <p style={{ fontSize: 28, fontWeight: 700, color: '#111111', fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
              {counts[ft]}
            </p>
          </div>
        ))}
      </div>

      {/* ── Grouped Tables ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
        {FLOW_ORDER.map(ft => {
          const rows = grouped[ft]
          if (rows.length === 0) return null
          return (
            <div key={ft}>
              {/* Section heading */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
                <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111111' }}>
                  {FLOW_FORM[ft]} — {FLOW_LABELS[ft]}
                </h2>
                <span style={{ fontSize: 12, color: '#5E5E5E' }}>
                  {rows.length} {rows.length === 1 ? 'entity' : 'entities'} · Deadline: {FLOW_DEADLINE[ft]}
                </span>
              </div>

              {/* Table */}
              <div
                style={{
                  background: '#FFFFFF',
                  border: '1px solid #DDDDDA',
                  borderRadius: 8,
                  overflow: 'hidden',
                }}
              >
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #DDDDDA', background: '#F7F7F5' }}>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#5E5E5E', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Entity Name
                      </th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#5E5E5E', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Client
                      </th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#5E5E5E', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Flow Type
                      </th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#5E5E5E', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Financial Year End
                      </th>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: '#5E5E5E', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Tax Prep Status
                      </th>
                      <th style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: '#5E5E5E', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((entity, idx) => {
                      const clientName = entity.client.display_name ?? entity.client.legal_name
                      return (
                        <tr
                          key={entity.id}
                          style={{
                            borderBottom: idx < rows.length - 1 ? '1px solid #DDDDDA' : 'none',
                          }}
                        >
                          <td style={{ padding: '12px 16px', color: '#111111', fontWeight: 500 }}>
                            {entity.entity_name}
                          </td>
                          <td style={{ padding: '12px 16px', color: '#5E5E5E' }}>
                            {clientName}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: 4,
                                border: '1px solid #DDDDDA',
                                background: '#F7F7F5',
                                fontSize: 11,
                                fontWeight: 600,
                                color: '#111111',
                                letterSpacing: '0.03em',
                              }}
                            >
                              {FLOW_FORM[entity.flow_type as FlowType] ?? entity.flow_type}
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', color: '#5E5E5E', fontVariantNumeric: 'tabular-nums' }}>
                            {entity.financial_year_end ?? '—'}
                          </td>
                          <td style={{ padding: '12px 16px' }}>
                            <span
                              style={{
                                display: 'inline-block',
                                padding: '2px 8px',
                                borderRadius: 4,
                                border: '1px solid #DDDDDA',
                                background: '#F7F7F5',
                                fontSize: 11,
                                fontWeight: 500,
                                color: '#5E5E5E',
                              }}
                            >
                              Not Started
                            </span>
                          </td>
                          <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                            <Link
                              href={`/tax-prep/${entity.id}`}
                              style={{
                                display: 'inline-block',
                                padding: '6px 14px',
                                borderRadius: 6,
                                background: '#111111',
                                color: '#FFFFFF',
                                fontSize: 12,
                                fontWeight: 600,
                                textDecoration: 'none',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              Open Tax Prep
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )
        })}

        {total === 0 && (
          <div
            style={{
              background: '#FFFFFF',
              border: '1px solid #DDDDDA',
              borderRadius: 8,
              padding: 48,
              textAlign: 'center',
              color: '#5E5E5E',
              fontSize: 14,
            }}
          >
            No active entities found. Add entities via the Entities section.
          </div>
        )}
      </div>
    </div>
  )
}
