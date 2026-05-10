/**
 * GET /api/accounting-assistant/[entityId]
 *
 * Aggregates all workbench data for a specific entity.
 * Response is shaped differently per flow_type:
 * - INDIVIDUAL_ONLY: no bank/import data, only tax relief and personal income
 * - INDIVIDUAL_BUSINESS: business transactions + personal relief
 * - PARTNERSHIP: business transactions + partner drawings/capital
 * - COMPANY: full business data + CA schedule
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { entityId: string } }
) {
  const entity = await prisma.entity.findFirst({
    where:   { id: params.entityId, archived_at: null },
    include: {
      client:          { select: { id: true, legal_name: true, client_code: true } },
      filing_profiles: { where: { is_active: true } },
      bank_accounts:   { where: { is_active: true } },
      partners:        { where: { is_active: true } },
    },
  })

  if (!entity) return NextResponse.json({ error: 'Entity not found' }, { status: 404 })

  const { searchParams } = new URL(request.url)
  const period = searchParams.get('period') // YYYY-MM

  // Build period filter
  let periodFilter: { gte: Date; lt: Date } | undefined
  if (period) {
    const [year, mo] = period.split('-').map(Number)
    periodFilter = { gte: new Date(year, mo - 1, 1), lt: new Date(year, mo, 1) }
  }

  // ── Common aggregations ──
  const [
    totalTxns,
    unclassifiedTxns,
    unreviewed,
    flaggedTxns,
    missingDocsTxns,
    openIssues,
  ] = await Promise.all([
    prisma.transaction.count({
      where: { entity_id: entity.id, archived_at: null, ...(periodFilter ? { txn_date: periodFilter } : {}) },
    }),
    prisma.transaction.count({
      where: { entity_id: entity.id, archived_at: null, accounting_category_id: null, ...(periodFilter ? { txn_date: periodFilter } : {}) },
    }),
    prisma.transaction.count({
      where: { entity_id: entity.id, archived_at: null, review_status: 'UNREVIEWED', ...(periodFilter ? { txn_date: periodFilter } : {}) },
    }),
    prisma.transaction.count({
      where: { entity_id: entity.id, archived_at: null, risk_flag: { not: null }, ...(periodFilter ? { txn_date: periodFilter } : {}) },
    }),
    prisma.transaction.count({
      where: { entity_id: entity.id, archived_at: null, document_status: 'REQUIRED_MISSING', ...(periodFilter ? { txn_date: periodFilter } : {}) },
    }),
    prisma.unresolvedIssue.count({
      where: { entity_id: entity.id, status: { in: ['OPEN', 'IN_PROGRESS'] } },
    }),
  ])

  // ── Flow-type specific data ──
  let flowSpecific: Record<string, unknown> = {}

  if (entity.flow_type === 'INDIVIDUAL_ONLY') {
    const reliefItems = await prisma.taxReliefItem.findMany({
      where: { entity_id: entity.id },
      orderBy: { assessment_year: 'desc' },
    })
    flowSpecific = { relief_items: reliefItems }
  }

  if (entity.flow_type === 'INDIVIDUAL_BUSINESS' || entity.flow_type === 'COMPANY') {
    const fixedAssets = await prisma.fixedAsset.findMany({
      where:   { entity_id: entity.id, status: { not: 'DISPOSED' } },
      orderBy: { acquisition_date: 'desc' },
    })
    flowSpecific = { fixed_assets: fixedAssets }

    if (entity.flow_type === 'INDIVIDUAL_BUSINESS') {
      const reliefItems = await prisma.taxReliefItem.findMany({
        where: { entity_id: entity.id },
        orderBy: { assessment_year: 'desc' },
      })
      flowSpecific = { ...flowSpecific, relief_items: reliefItems }
    }
  }

  if (entity.flow_type === 'PARTNERSHIP') {
    const [partners, fixedAssets] = await Promise.all([
      prisma.partner.findMany({
        where:   { entity_id: entity.id, is_active: true },
        include: {
          ledger_entries: {
            where:   { ...(period ? { period } : {}) },
            orderBy: { entry_date: 'desc' },
            take:    20,
          },
        },
      }),
      prisma.fixedAsset.findMany({
        where:   { entity_id: entity.id, status: { not: 'DISPOSED' } },
        orderBy: { acquisition_date: 'desc' },
      }),
    ])
    flowSpecific = { partners, fixed_assets: fixedAssets }
  }

  // ── Checklist template ──
  const monthlyCloseTemplate = await prisma.checklistTemplate.findFirst({
    where: { flow_type: entity.flow_type, phase: 'MONTHLY_CLOSE', is_active: true },
  })

  // ── Compute ready state ──
  const readyState = computeReadyState({
    flow_type:          entity.flow_type,
    unclassified:       unclassifiedTxns,
    flagged:            flaggedTxns,
    missing_docs:       missingDocsTxns,
    open_issues:        openIssues,
    total_txns:         totalTxns,
  })

  return NextResponse.json({
    data: {
      entity:             { ...entity },
      period:             period ?? null,
      summary: {
        total_transactions:    totalTxns,
        unclassified:          unclassifiedTxns,
        unreviewed:            unreviewed,
        flagged:               flaggedTxns,
        missing_docs:          missingDocsTxns,
        open_issues:           openIssues,
      },
      ready_state:        readyState,
      checklist_template: monthlyCloseTemplate,
      flow_specific:      flowSpecific,
    },
  })
}

interface ReadyStateInput {
  flow_type:     string
  unclassified:  number
  flagged:       number
  missing_docs:  number
  open_issues:   number
  total_txns:    number
}

interface ReadyStateOutput {
  overall:  'READY' | 'NOT_READY' | 'NEEDS_ATTENTION'
  blockers: string[]
  warnings: string[]
}

function computeReadyState(input: ReadyStateInput): ReadyStateOutput {
  const blockers: string[] = []
  const warnings: string[] = []

  if (input.unclassified > 0) {
    blockers.push(`${input.unclassified} transactions not yet classified`)
  }

  if (input.missing_docs > 0) {
    blockers.push(`${input.missing_docs} transactions with missing supporting documents`)
  }

  if (input.flagged > 0) {
    warnings.push(`${input.flagged} risk-flagged transactions require review`)
  }

  if (input.open_issues > 0) {
    warnings.push(`${input.open_issues} unresolved issues open`)
  }

  if (input.total_txns === 0) {
    blockers.push('No transactions imported yet')
  }

  const overall = blockers.length > 0 ? 'NOT_READY' : warnings.length > 0 ? 'NEEDS_ATTENTION' : 'READY'

  return { overall, blockers, warnings }
}
