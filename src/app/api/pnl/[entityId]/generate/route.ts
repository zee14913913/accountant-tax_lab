/**
 * POST /api/pnl/[entityId]/generate
 *
 * Generates a P&L snapshot for a given entity and period
 * by aggregating classified transactions.
 *
 * Logic is flow_type-aware:
 * - INDIVIDUAL_ONLY: No P&L (returns 400)
 * - INDIVIDUAL_BUSINESS: Revenue + Expenses (no COGS)
 * - PARTNERSHIP: Full P&L + profit apportionment per partner
 * - COMPANY: Full P&L (Revenue, COGS, Gross Profit, OPEX, Other Income, Finance Cost, Net Profit)
 */
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeAuditLog } from '@/lib/audit'
import { z } from 'zod'

const GeneratePnlSchema = z.object({
  period_start:   z.string(),  // ISO date
  period_end:     z.string(),  // ISO date
  basis:          z.enum(['CASH', 'ACCRUAL', 'MANAGEMENT']).default('CASH'),
  month_close_id: z.string().optional(),
  generated_by:   z.string().default('system'),
})

export async function POST(
  request: NextRequest,
  { params }: { params: { entityId: string } }
) {
  try {
    const body      = await request.json()
    const validated = GeneratePnlSchema.parse(body)

    const entity = await prisma.entity.findFirst({
      where:   { id: params.entityId, archived_at: null },
      include: { partners: { where: { is_active: true } } },
    })

    if (!entity) return NextResponse.json({ error: 'Entity not found' }, { status: 404 })

    if (entity.flow_type === 'INDIVIDUAL_ONLY') {
      return NextResponse.json({
        error: 'P&L is not applicable for INDIVIDUAL_ONLY entities. Use Tax Prep for personal income summary.',
      }, { status: 400 })
    }

    const periodStart = new Date(validated.period_start)
    const periodEnd   = new Date(validated.period_end)

    // Aggregate transactions by report_group (only classified, not archived)
    const transactions = await prisma.transaction.findMany({
      where: {
        entity_id:   params.entityId,
        archived_at: null,
        txn_date:    { gte: periodStart, lte: periodEnd },
        accounting_category_id: { not: null },
      },
      include: {
        accounting_category: { select: { report_group: true } },
      },
    })

    // Group by report_group and direction
    const totals: Record<string, number> = {
      REVENUE:                 0,
      COST_OF_SALES:           0,
      OPERATING_EXPENSE:       0,
      OTHER_INCOME:            0,
      FINANCE_COST:            0,
      TAX_EXPENSE:             0,
    }

    for (const txn of transactions) {
      const group = txn.accounting_category?.report_group
      if (!group || !(group in totals)) continue

      const amount = Number(txn.amount)
      // Income groups: CREDIT is positive, DEBIT is negative
      // Expense groups: DEBIT is positive, CREDIT is negative (reversal)
      const incomeGroups = ['REVENUE', 'OTHER_INCOME']
      if (incomeGroups.includes(group)) {
        totals[group] += txn.direction === 'CREDIT' ? amount : -amount
      } else {
        totals[group] += txn.direction === 'DEBIT' ? amount : -amount
      }
    }

    // Build P&L structure
    const revenue_total      = totals.REVENUE
    const cogs_total         = entity.flow_type === 'INDIVIDUAL_BUSINESS' ? 0 : totals.COST_OF_SALES
    const gross_profit       = revenue_total - cogs_total
    const opex_total         = totals.OPERATING_EXPENSE
    const other_income_total = totals.OTHER_INCOME
    const finance_cost_total = totals.FINANCE_COST
    const net_profit         = gross_profit - opex_total + other_income_total - finance_cost_total

    // PARTNERSHIP: apportionment
    let apportionment_json = null
    if (entity.flow_type === 'PARTNERSHIP' && entity.partners.length > 0) {
      const totalSharePct = entity.partners.reduce((s, p) => s + Number(p.profit_share_percentage), 0)
      apportionment_json = {
        partners: entity.partners.map(p => ({
          partner_id:       p.id,
          name:             p.partner_name,
          share_pct:        Number(p.profit_share_percentage),
          allocated_profit: totalSharePct > 0
            ? (net_profit * Number(p.profit_share_percentage)) / totalSharePct
            : 0,
        })),
      }
    }

    // Upsert snapshot (one per entity + period)
    const snapshot = await prisma.pnlSnapshot.create({
      data: {
        entity_id:          params.entityId,
        month_close_id:     validated.month_close_id ?? null,
        period_start:       periodStart,
        period_end:         periodEnd,
        flow_type:          entity.flow_type,
        basis:              validated.basis,
        revenue_total,
        cogs_total,
        gross_profit,
        opex_total,
        other_income_total,
        finance_cost_total,
        net_profit,
        apportionment_json,
        generated_by:       validated.generated_by,
        is_final:           false,
      },
    })

    await writeAuditLog({
      table_name: 'pnl_snapshots',
      record_id:  snapshot.id,
      action:     'CREATE',
      after_json: { net_profit, period: `${validated.period_start}~${validated.period_end}` },
      actor_id:   validated.generated_by,
    })

    return NextResponse.json({ data: snapshot }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: err.errors }, { status: 400 })
    }
    console.error('[POST /api/pnl/generate]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
