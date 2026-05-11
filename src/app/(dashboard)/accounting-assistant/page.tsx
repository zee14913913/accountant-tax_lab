export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { prisma } from '@/lib/prisma'
import { MarkReviewedButton } from '@/components/accounting-assistant/MarkReviewedButton'

// ─── helpers ────────────────────────────────────────────────────────────────

function fmtDate(d: Date): string {
  return new Date(d).toLocaleDateString('en-MY', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

function fmtAmt(n: { toNumber?: () => number } | number | null | undefined): string {
  if (n == null) return '—'
  const num = typeof n === 'number' ? n : n.toNumber?.() ?? 0
  return num.toLocaleString('en-MY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// ─── sub-components (inline, no colour, server-side) ─────────────────────────

function SectionHeader({
  title,
  count,
  description,
}: {
  title: string
  count: number
  description?: string
}) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <h2
          style={{
            margin: 0,
            fontSize: '15px',
            fontWeight: 600,
            color: '#111111',
            fontFamily: "'Avenir Next', system-ui, sans-serif",
          }}
        >
          {title}
        </h2>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: '22px',
            height: '22px',
            padding: '0 6px',
            borderRadius: '11px',
            background: count > 0 ? '#111111' : '#DDDDDA',
            color: count > 0 ? '#FFFFFF' : '#5E5E5E',
            fontSize: '11px',
            fontWeight: 600,
            fontFamily: "'Avenir Next', system-ui, sans-serif",
          }}
        >
          {count}
        </span>
      </div>
      {description && (
        <p
          style={{
            margin: '4px 0 0',
            fontSize: '13px',
            color: '#5E5E5E',
            fontFamily: "'Avenir Next', system-ui, sans-serif",
          }}
        >
          {description}
        </p>
      )}
    </div>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: '20px 24px',
        background: '#FFFFFF',
        border: '1px solid #DDDDDA',
        borderRadius: '8px',
        textAlign: 'center',
        color: '#5E5E5E',
        fontSize: '13px',
        fontFamily: "'Avenir Next', system-ui, sans-serif",
      }}
    >
      {message}
    </div>
  )
}

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  background: '#FFFFFF',
  border: '1px solid #DDDDDA',
  borderRadius: '8px',
  overflow: 'hidden',
  fontSize: '13px',
  fontFamily: "'Avenir Next', system-ui, sans-serif",
}

const thStyle: React.CSSProperties = {
  padding: '10px 16px',
  textAlign: 'left',
  fontSize: '11px',
  fontWeight: 600,
  color: '#5E5E5E',
  background: '#F7F7F5',
  borderBottom: '1px solid #DDDDDA',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  whiteSpace: 'nowrap',
}

const thRightStyle: React.CSSProperties = {
  ...thStyle,
  textAlign: 'right',
}

const tdStyle: React.CSSProperties = {
  padding: '11px 16px',
  color: '#111111',
  borderBottom: '1px solid #F0F0EE',
  verticalAlign: 'middle',
}

const tdRightStyle: React.CSSProperties = {
  ...tdStyle,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
}

const tdMutedStyle: React.CSSProperties = {
  ...tdStyle,
  color: '#5E5E5E',
}

const actionLinkStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 500,
  color: '#111111',
  textDecoration: 'none',
  border: '1px solid #DDDDDA',
  borderRadius: '4px',
  padding: '4px 10px',
  display: 'inline-block',
  whiteSpace: 'nowrap',
  fontFamily: "'Avenir Next', system-ui, sans-serif",
}

// ─── page ────────────────────────────────────────────────────────────────────

export default async function AccountingAssistantPage() {
  // Run all queries in parallel
  const [
    unclassified,
    missingDocs,
    highRisk,
    pendingReview,
    entities,
    // Count totals for stat bar
    unclassifiedCount,
    missingDocsCount,
    highRiskCount,
    pendingReviewCount,
  ] = await Promise.all([
    // Unclassified transactions (no category)
    prisma.transaction.findMany({
      where: {
        accounting_category_id: null,
        archived_at: null,
        entity: { archived_at: null },
      },
      include: { entity: { select: { entity_name: true } } },
      orderBy: { txn_date: 'desc' },
      take: 50,
    }),

    // Missing documents
    prisma.transaction.findMany({
      where: {
        document_status: 'REQUIRED_MISSING',
        archived_at: null,
        entity: { archived_at: null },
      },
      include: { entity: { select: { entity_name: true } } },
      orderBy: { txn_date: 'desc' },
      take: 50,
    }),

    // High risk (risk_flag is an enum, not null = flagged)
    prisma.transaction.findMany({
      where: {
        risk_flag: { not: null },
        archived_at: null,
        entity: { archived_at: null },
      },
      include: { entity: { select: { entity_name: true } } },
      orderBy: { txn_date: 'desc' },
      take: 50,
    }),

    // Pending review — IN_REVIEW status means sent for review
    prisma.transaction.findMany({
      where: {
        review_status: 'IN_REVIEW',
        archived_at: null,
        entity: { archived_at: null },
      },
      include: {
        entity: { select: { entity_name: true } },
        accounting_category: { select: { name: true } },
      },
      orderBy: { txn_date: 'desc' },
      take: 50,
    }),

    // Entities with their latest monthly close
    prisma.entity.findMany({
      where: { archived_at: null, is_active: true },
      include: {
        client: { select: { legal_name: true } },
        monthly_closes: {
          orderBy: { period_end: 'desc' },
          take: 1,
        },
      },
      orderBy: { entity_name: 'asc' },
    }),

    // Counts for stat bar
    prisma.transaction.count({
      where: { accounting_category_id: null, archived_at: null, entity: { archived_at: null } },
    }),
    prisma.transaction.count({
      where: { document_status: 'REQUIRED_MISSING', archived_at: null, entity: { archived_at: null } },
    }),
    prisma.transaction.count({
      where: { risk_flag: { not: null }, archived_at: null, entity: { archived_at: null } },
    }),
    prisma.transaction.count({
      where: { review_status: 'IN_REVIEW', archived_at: null, entity: { archived_at: null } },
    }),
  ])

  const allClear =
    unclassifiedCount === 0 &&
    missingDocsCount === 0 &&
    highRiskCount === 0 &&
    pendingReviewCount === 0

  return (
    <div
      style={{
        fontFamily: "'Avenir Next', system-ui, sans-serif",
        color: '#111111',
        minHeight: '100vh',
      }}
    >
      {/* Page header */}
      <div className="page-header">
        <h1 className="page-title">Accounting Assistant</h1>
        <p className="page-subtitle">Cross-entity workbench — pending items requiring action</p>
      </div>

      {/* ── Top Summary Bar ── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '16px',
          marginBottom: '32px',
        }}
      >
        {[
          { label: 'Unclassified Transactions', count: unclassifiedCount },
          { label: 'Missing Documents',         count: missingDocsCount },
          { label: 'High Risk Items',           count: highRiskCount },
          { label: 'Pending Review',            count: pendingReviewCount },
        ].map(({ label, count }) => (
          <div
            key={label}
            style={{
              background: '#FFFFFF',
              border: '1px solid #DDDDDA',
              borderRadius: '8px',
              padding: '24px',
            }}
          >
            <p
              style={{
                margin: '0 0 8px',
                fontSize: '11px',
                fontWeight: 600,
                color: '#5E5E5E',
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              {label}
            </p>
            <p
              style={{
                margin: 0,
                fontSize: '32px',
                fontWeight: 700,
                color: '#111111',
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1,
              }}
            >
              {count.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      {/* ── All-clear state ── */}
      {allClear && (
        <div
          style={{
            background: '#FFFFFF',
            border: '1px solid #DDDDDA',
            borderRadius: '8px',
            padding: '48px 24px',
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontSize: '16px',
              fontWeight: 600,
              color: '#111111',
              margin: '0 0 8px',
            }}
          >
            All clear — no pending items
          </p>
          <p style={{ fontSize: '13px', color: '#5E5E5E', margin: 0 }}>
            All transactions are classified, documents are uploaded, and no items need review.
          </p>
        </div>
      )}

      {/* ── Section 1: Unclassified Transactions ── */}
      {!allClear && (
        <section style={{ marginBottom: '40px' }}>
          <SectionHeader
            title="Unclassified Transactions"
            count={unclassifiedCount}
            description="Transactions without an accounting category — classify before closing"
          />
          {unclassified.length === 0 ? (
            <EmptyState message="No items — all clear" />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Entity</th>
                    <th style={thStyle}>Description</th>
                    <th style={thRightStyle}>Amount (MYR)</th>
                    <th style={thStyle}>Direction</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {unclassified.map((txn) => (
                    <tr key={txn.id}>
                      <td style={tdMutedStyle}>{fmtDate(txn.txn_date)}</td>
                      <td style={tdStyle}>{txn.entity.entity_name}</td>
                      <td style={{ ...tdStyle, maxWidth: '320px' }}>
                        <span
                          style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {txn.description}
                        </span>
                      </td>
                      <td style={tdRightStyle}>{fmtAmt(txn.amount)}</td>
                      <td style={tdMutedStyle}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            letterSpacing: '0.04em',
                          }}
                        >
                          {txn.direction}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <Link href={`/transactions/${txn.id}`} style={actionLinkStyle}>
                          Classify
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ── Section 2: Missing Documents ── */}
      {!allClear && (
        <section style={{ marginBottom: '40px' }}>
          <SectionHeader
            title="Missing Documents"
            count={missingDocsCount}
            description="Transactions requiring supporting documents before the file is audit-ready"
          />
          {missingDocs.length === 0 ? (
            <EmptyState message="No items — all clear" />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Entity</th>
                    <th style={thStyle}>Description</th>
                    <th style={thRightStyle}>Amount (MYR)</th>
                    <th style={thStyle}>Document Status</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {missingDocs.map((txn) => (
                    <tr key={txn.id}>
                      <td style={tdMutedStyle}>{fmtDate(txn.txn_date)}</td>
                      <td style={tdStyle}>{txn.entity.entity_name}</td>
                      <td style={{ ...tdStyle, maxWidth: '320px' }}>
                        <span
                          style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {txn.description}
                        </span>
                      </td>
                      <td style={tdRightStyle}>{fmtAmt(txn.amount)}</td>
                      <td style={tdMutedStyle}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            letterSpacing: '0.04em',
                          }}
                        >
                          {txn.document_status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <Link
                          href={`/documents?transaction_id=${txn.id}`}
                          style={actionLinkStyle}
                        >
                          Upload Doc
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ── Section 3: High Risk Items ── */}
      {!allClear && (
        <section style={{ marginBottom: '40px' }}>
          <SectionHeader
            title="High Risk Items"
            count={highRiskCount}
            description="Transactions flagged for risk review — round numbers, related parties, unusual counterparties"
          />
          {highRisk.length === 0 ? (
            <EmptyState message="No items — all clear" />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Entity</th>
                    <th style={thStyle}>Description</th>
                    <th style={thRightStyle}>Amount (MYR)</th>
                    <th style={thStyle}>Risk Flag</th>
                    <th style={thStyle}>Management Note</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {highRisk.map((txn) => (
                    <tr key={txn.id}>
                      <td style={tdMutedStyle}>{fmtDate(txn.txn_date)}</td>
                      <td style={tdStyle}>{txn.entity.entity_name}</td>
                      <td style={{ ...tdStyle, maxWidth: '260px' }}>
                        <span
                          style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {txn.description}
                        </span>
                      </td>
                      <td style={tdRightStyle}>{fmtAmt(txn.amount)}</td>
                      <td style={tdMutedStyle}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            letterSpacing: '0.04em',
                          }}
                        >
                          {txn.risk_flag?.replace(/_/g, ' ') ?? '—'}
                        </span>
                      </td>
                      <td style={{ ...tdMutedStyle, maxWidth: '200px', fontSize: '12px' }}>
                        {txn.management_note ?? (
                          <span style={{ color: '#AAAAAA' }}>No note</span>
                        )}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <Link href={`/transactions/${txn.id}`} style={actionLinkStyle}>
                          Review
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ── Section 4: Pending Review ── */}
      {!allClear && (
        <section style={{ marginBottom: '40px' }}>
          <SectionHeader
            title="Pending Review"
            count={pendingReviewCount}
            description="Transactions currently in review — mark as reviewed once approved"
          />
          {pendingReview.length === 0 ? (
            <EmptyState message="No items — all clear" />
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Entity</th>
                    <th style={thStyle}>Description</th>
                    <th style={thRightStyle}>Amount (MYR)</th>
                    <th style={thStyle}>Category</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingReview.map((txn) => (
                    <tr key={txn.id}>
                      <td style={tdMutedStyle}>{fmtDate(txn.txn_date)}</td>
                      <td style={tdStyle}>{txn.entity.entity_name}</td>
                      <td style={{ ...tdStyle, maxWidth: '320px' }}>
                        <span
                          style={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {txn.description}
                        </span>
                      </td>
                      <td style={tdRightStyle}>{fmtAmt(txn.amount)}</td>
                      <td style={tdMutedStyle}>
                        {txn.accounting_category?.name ?? (
                          <span style={{ color: '#AAAAAA', fontStyle: 'italic' }}>
                            Unclassified
                          </span>
                        )}
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <MarkReviewedButton transactionId={txn.id} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ── Section 5: Monthly Close Status ── */}
      <section style={{ marginBottom: '40px' }}>
        <SectionHeader
          title="Monthly Close Status"
          count={entities.length}
          description="Latest monthly close period per entity"
        />
        {entities.length === 0 ? (
          <EmptyState message="No active entities found" />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Entity</th>
                  <th style={thStyle}>Client</th>
                  <th style={thStyle}>Flow Type</th>
                  <th style={thStyle}>Latest Period</th>
                  <th style={thStyle}>Close Status</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {entities.map((entity) => {
                  const latestClose = entity.monthly_closes[0] ?? null
                  const statusLabel = latestClose
                    ? latestClose.status.replace(/_/g, ' ')
                    : 'Not Started'
                  const periodLabel = latestClose
                    ? `${fmtDate(latestClose.period_start)} – ${fmtDate(latestClose.period_end)}`
                    : '—'
                  const isClosed = latestClose?.status === 'CLOSED'
                  const isArchived = latestClose?.status === 'ARCHIVED'

                  return (
                    <tr key={entity.id}>
                      <td style={{ ...tdStyle, fontWeight: 500 }}>{entity.entity_name}</td>
                      <td style={tdMutedStyle}>{entity.client.legal_name}</td>
                      <td style={tdMutedStyle}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            letterSpacing: '0.04em',
                          }}
                        >
                          {entity.flow_type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td style={{ ...tdMutedStyle, fontVariantNumeric: 'tabular-nums' }}>
                        {periodLabel}
                      </td>
                      <td style={tdStyle}>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            letterSpacing: '0.04em',
                            color: isClosed || isArchived ? '#5E5E5E' : '#111111',
                          }}
                        >
                          {statusLabel}
                        </span>
                      </td>
                      <td style={{ ...tdStyle, textAlign: 'center' }}>
                        <Link href="/monthly-close" style={actionLinkStyle}>
                          Open Monthly Close
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
